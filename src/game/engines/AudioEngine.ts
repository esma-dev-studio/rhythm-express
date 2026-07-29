import type { Difficulty, GameSettings, HitFeedback, StageDefinition, StageTheme } from "../types.ts";
import { cueSubdivisionsForChart } from "../rhythmGuide.ts";

type WindowWithAudio = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

type MixChannel = "music" | "sfx";

export interface AudioEngineOptions {
  contextFactory?: () => AudioContext;
  wait?: (milliseconds: number) => Promise<void>;
  progressProbeMs?: number;
  resumeTimeoutMs?: number;
  resumeAttempts?: number;
  clockStallGraceMs?: number;
}

interface VoiceShape {
  attack?: number;
  release?: number;
  detune?: number;
  filterType?: BiquadFilterType;
  filterFrequency?: number;
  filterQ?: number;
}

interface Arrangement {
  progression: number[];
  kickSteps: number[];
  bassSteps: number[];
  bassDegrees: number[];
  leadSteps: number[];
  leadDegrees: number[];
}

class AudioTransitionSupersededError extends Error {
  constructor() {
    super("Audio transition was superseded");
  }
}

const ARRANGEMENTS: Record<StageTheme, Arrangement> = {
  city: {
    progression: [0, 3, 4, 3],
    kickSteps: [0, 8],
    bassSteps: [0, 6, 8, 12],
    bassDegrees: [0, 4, 2, 4],
    leadSteps: [0, 2, 5, 6, 8, 10, 13, 14],
    leadDegrees: [0, 1, 2, 4, 2, 1, 4, 5],
  },
  jungle: {
    progression: [0, 2, 1, 4],
    kickSteps: [0, 6, 8, 14],
    bassSteps: [0, 3, 6, 8, 10, 14],
    bassDegrees: [0, 0, 4, 2, 4, 1],
    leadSteps: [0, 3, 4, 7, 8, 10, 12, 15],
    leadDegrees: [0, 2, 1, 3, 4, 2, 5, 3],
  },
  moon: {
    progression: [0, 3, 1, 4],
    kickSteps: [0, 8, 10],
    bassSteps: [0, 4, 7, 8, 12, 14],
    bassDegrees: [0, 4, 2, 1, 4, 5],
    leadSteps: [0, 2, 4, 7, 8, 11, 12, 14],
    leadDegrees: [0, 3, 2, 5, 4, 2, 1, 4],
  },
};

export function eventTimestampAgeSeconds(
  eventTimeMs: number,
  performanceNowMs: number,
  timeOriginMs: number,
): number {
  if (!Number.isFinite(eventTimeMs) || eventTimeMs <= 0) return 0;
  const normalizedTime = eventTimeMs >= timeOriginMs
    ? eventTimeMs - timeOriginMs
    : eventTimeMs;
  return Math.max(-0.05, Math.min(1, (performanceNowMs - normalizedTime) / 1000));
}

export interface AudioOutputTimestamp { contextTime?: number; performanceTime?: number }

export function presentationAudioTimeAt(
  performanceTimeMs: number,
  performanceNowMs: number,
  currentAudioTime: number,
  baseLatencySeconds = 0,
  outputLatencySeconds = 0,
  outputTimestamp?: AudioOutputTimestamp,
): number {
  const safeCurrentTime = Number.isFinite(currentAudioTime) ? Math.max(0, currentAudioTime) : 0;
  const safePerformanceNow = Number.isFinite(performanceNowMs) ? performanceNowMs : 0;
  const safePerformanceTime = Number.isFinite(performanceTimeMs) ? performanceTimeMs : safePerformanceNow;
  const latency = Math.min(0.25, Math.max(0, baseLatencySeconds) + Math.max(0, outputLatencySeconds));
  const outputContextTime = outputTimestamp?.contextTime;
  const outputPerformanceTime = outputTimestamp?.performanceTime;
  const timestampLag = safeCurrentTime - (outputContextTime ?? 0);
  const maximumPlausibleTimestampLag = Math.max(0.5, latency + 0.35);
  const timestampAtPerformanceNow = (outputContextTime ?? 0)
    + (safePerformanceNow - (outputPerformanceTime ?? safePerformanceNow)) / 1000;
  const mappedClockDrift = safeCurrentTime - timestampAtPerformanceNow;
  const hasOutputTimestamp = Boolean(
    Number.isFinite(outputContextTime)
      && (outputContextTime ?? -1) >= 0
      && Number.isFinite(outputPerformanceTime)
      && (outputPerformanceTime ?? -1) >= 0
      && timestampLag >= -0.1
      && timestampLag <= maximumPlausibleTimestampLag
      && mappedClockDrift >= -0.1
      && mappedClockDrift <= maximumPlausibleTimestampLag,
  );
  const mapped = hasOutputTimestamp
    ? (outputContextTime ?? 0) + (safePerformanceTime - (outputPerformanceTime ?? 0)) / 1000
    : safeCurrentTime - latency + (safePerformanceTime - safePerformanceNow) / 1000;
  return Math.max(0, Math.min(safeCurrentTime + 0.05, mapped));
}

export function mixSliderGain(value: number, channel: MixChannel): number {
  if (!Number.isFinite(value)) return 0;
  const normalized = Math.max(0, Math.min(1, value));
  if (channel === "music") return normalized * (1.42 - 0.42 * normalized);
  return normalized * 0.68;
}

export function scaleFrequency(scale: number[], degree: number, octaveShift = 0): number {
  if (scale.length === 0) return 440;
  const first = scale[0];
  const last = scale[scale.length - 1];
  const hasOctaveEndpoint = scale.length > 1
    && first > 0
    && Math.abs(last / first - 2) < 0.015;
  const period = hasOctaveEndpoint ? scale.length - 1 : scale.length;
  const wrappedDegree = ((degree % period) + period) % period;
  const octave = Math.floor(degree / period) + octaveShift;
  return scale[wrappedDegree] * 2 ** octave;
}

export class AudioEngine {
  private context: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private sessionGain: GainNode | null = null;
  private scheduler: ReturnType<typeof setInterval> | null = null;
  private stage: StageDefinition | null = null;
  private difficulty: Difficulty = "easy";
  private rhythmCueSteps = new Set<number>();
  private gameStartTime = 0;
  private nextSubdivision = 0;
  private noiseBuffer: AudioBuffer | null = null;
  private driveActive = false;
  private silentMode = false;
  private gameClockOriginSeconds = 0;
  private gameClockOriginPerformanceMs = 0;
  private gameClockActive = false;
  private readonly contextFactory?: () => AudioContext;
  private readonly wait: (milliseconds: number) => Promise<void>;
  private readonly progressProbeMs: number;
  private readonly resumeTimeoutMs: number;
  private readonly resumeAttempts: number;
  private readonly clockStallGraceMs: number;
  private transitionGeneration = 0;
  private desiredContextState: "idle" | "running" | "suspended" = "idle";
  private monitoredContext: AudioContext | null = null;
  private monitoredAudioTime = 0;
  private monitoredLastProgressMs = Number.NaN;
  private clockMonitorActive = false;

  constructor(options: AudioEngineOptions = {}) {
    this.contextFactory = options.contextFactory;
    this.wait = options.wait ?? ((milliseconds) => new Promise((resolve) => {
      setTimeout(resolve, milliseconds);
    }));
    this.progressProbeMs = Math.max(8, options.progressProbeMs ?? 32);
    this.resumeTimeoutMs = Math.max(50, options.resumeTimeoutMs ?? 450);
    this.resumeAttempts = Math.max(1, Math.min(5, options.resumeAttempts ?? 3));
    this.clockStallGraceMs = Math.max(100, options.clockStallGraceMs ?? 600);
  }

  async prepare(settings: GameSettings): Promise<void> {
    const generation = this.beginRunningTransition();
    if (!this.context) {
      this.createContext();
    }
    this.setVolumes(settings.musicVolume, settings.sfxVolume);
    const context = this.context;
    if (!context) throw new Error("Audio context could not be created");
    this.playSilentUnlockBuffer(context);
    await this.ensureClockIsAdvancing(context, generation);
    this.assertTransitionCurrent(context, generation);
    this.resetClockMonitor(context);
  }

  setVolumes(music: number, sfx: number): void {
    this.setGain(this.musicGain, mixSliderGain(music, "music"));
    this.setGain(this.sfxGain, mixSliderGain(sfx, "sfx"));
  }

  async start(stage: StageDefinition, difficulty: Difficulty, settings: GameSettings): Promise<number> {
    this.stop();
    try {
      await this.prepare(settings);
    } catch (initialError) {
      if (initialError instanceof AudioTransitionSupersededError) throw initialError;
      await this.recreateContextForStart(settings, initialError);
    }
    if (!this.context || !this.musicGain) {
      throw new Error("Audio could not be started");
    }
    this.stage = stage;
    this.difficulty = difficulty;
    this.rhythmCueSteps = cueSubdivisionsForChart(stage.notes[difficulty], stage.bpm);
    this.sessionGain = this.context.createGain();
    this.sessionGain.gain.value = 0.94;
    this.sessionGain.connect(this.musicGain);
    const beat = 60 / stage.bpm;
    this.gameStartTime = this.context.currentTime + beat * 4 + 0.12;
    this.nextSubdivision = 0;
    this.scheduleCountIn();
    this.scheduler = setInterval(() => this.scheduleAhead(), 25);
    this.scheduleAhead();
    this.resetClockMonitor(this.context);
    const performanceNowMs = performance.now();
    this.anchorGameClock(this.presentationTimeAt(performanceNowMs, performanceNowMs), performanceNowMs);
    return this.gameStartTime;
  }

  startSilent(stage: StageDefinition, difficulty: Difficulty): number {
    this.stop();
    this.silentMode = true;
    this.stage = stage;
    this.difficulty = difficulty;
    const performanceNowMs = performance.now();
    this.anchorGameClock(performanceNowMs / 1000, performanceNowMs);
    const beat = 60 / stage.bpm;
    this.gameStartTime = this.gameClockAt(performanceNowMs) + beat * 4 + 0.12;
    return this.gameStartTime;
  }

  /**
   * Keeps the current run moving when iPadOS stops Web Audio after launch.
   * The rhythm timeline changes to a monotonic performance clock without
   * restarting the stage or returning the countdown to four.
   */
  continueWithoutSound(performanceNowMs = performance.now()): number {
    if (this.silentMode) return this.gameClockAt(performanceNowMs);
    const fallbackTime = this.gameClockActive
      ? this.gameClockAt(performanceNowMs)
      : this.context
        ? this.presentationTimeAt(performanceNowMs, performanceNowMs)
        : performanceNowMs / 1000;
    this.anchorGameClock(fallbackTime, performanceNowMs);
    this.silentMode = true;
    this.disableClockMonitor();
    if (this.scheduler) clearInterval(this.scheduler);
    this.scheduler = null;
    this.driveActive = false;
    if (this.context && this.sessionGain) {
      try {
        const now = this.context.currentTime;
        this.sessionGain.gain.cancelScheduledValues(now);
        this.sessionGain.gain.setValueAtTime(0, now);
      } catch {
        // An interrupted iPad audio context may reject gain operations.
      }
    }
    return fallbackTime;
  }

  get isSilent(): boolean {
    return this.silentMode;
  }

  now(): number {
    if (this.silentMode) return this.gameClockAt(performance.now());
    return this.presentationTimeAt(performance.now());
  }

  /**
   * Call once per animation frame while playing. A true result means the
   * current run must be aborted; monitoring is intentionally off while paused or stopped.
   */
  hasClockStalled(performanceNowMs = globalThis.performance?.now() ?? Date.now()): boolean {
    if (this.silentMode) return false;
    if (!this.clockMonitorActive) return false;
    const context = this.context;
    if (!context || context !== this.monitoredContext) return true;
    if (String(context.state) !== "running") return true;
    const currentAudioTime = context.currentTime;
    if (!Number.isFinite(currentAudioTime)) return true;
    const currentPerformanceTime = Number.isFinite(performanceNowMs)
      ? performanceNowMs
      : Date.now();

    if (Math.abs(currentAudioTime - this.monitoredAudioTime) >= 0.0005) {
      this.monitoredAudioTime = currentAudioTime;
      this.monitoredLastProgressMs = currentPerformanceTime;
      return false;
    }
    if (!Number.isFinite(this.monitoredLastProgressMs)
      || currentPerformanceTime < this.monitoredLastProgressMs) {
      this.monitoredLastProgressMs = currentPerformanceTime;
      return false;
    }
    return currentPerformanceTime - this.monitoredLastProgressMs >= this.clockStallGraceMs;
  }

  eventTimeToAudioTime(eventTimeMs: number): number {
    const performanceNow = performance.now();
    const ageSeconds = eventTimestampAgeSeconds(
      eventTimeMs,
      performanceNow,
      performance.timeOrigin,
    );
    if (this.silentMode) {
      const eventPerformanceTime = performanceNow - ageSeconds * 1000;
      return Math.max(0, this.gameClockAt(eventPerformanceTime));
    }
    if (!this.context) return 0;
    return this.presentationTimeAt(performanceNow - ageSeconds * 1000, performanceNow);
  }

  private presentationTimeAt(performanceTimeMs: number, performanceNowMs = performance.now()): number {
    if (!this.context) return 0;
    let outputTimestamp: AudioOutputTimestamp | undefined;
    try {
      outputTimestamp = this.context.getOutputTimestamp?.();
    } catch {
      outputTimestamp = undefined;
    }
    return presentationAudioTimeAt(
      performanceTimeMs,
      performanceNowMs,
      this.context.currentTime,
      this.context.baseLatency ?? 0,
      this.context.outputLatency ?? 0,
      outputTimestamp,
    );
  }

  private anchorGameClock(audioTimeSeconds: number, performanceNowMs: number): void {
    this.gameClockOriginSeconds = Number.isFinite(audioTimeSeconds) ? Math.max(0, audioTimeSeconds) : 0;
    this.gameClockOriginPerformanceMs = Number.isFinite(performanceNowMs) ? performanceNowMs : 0;
    this.gameClockActive = true;
  }

  private gameClockAt(performanceTimeMs: number): number {
    if (!this.gameClockActive) {
      return Math.max(0, performanceTimeMs / 1000);
    }
    return Math.max(0, this.gameClockOriginSeconds
      + (performanceTimeMs - this.gameClockOriginPerformanceMs) / 1000);
  }

  async pause(): Promise<void> {
    if (this.silentMode) return;
    const context = this.context;
    if (!context) return;
    const generation = ++this.transitionGeneration;
    this.desiredContextState = "suspended";
    this.disableClockMonitor();
    if (String(context.state) === "suspended") return;
    if (String(context.state) !== "running") {
      this.poisonContext(context, generation);
      throw new Error(`Audio could not be suspended (state: ${String(context.state)})`);
    }
    const suspended = await this.runBounded(
      () => context.suspend(),
      () => this.reconcileLateTransition(context),
    );
    if (generation !== this.transitionGeneration || context !== this.context) return;
    if (!suspended || String(context.state) !== "suspended") {
      this.poisonContext(context, generation);
      throw new Error("Audio could not be suspended");
    }
  }

  async resume(): Promise<void> {
    if (this.silentMode) return;
    const context = this.context;
    if (!context) throw new Error("Audio context is not ready");
    const generation = this.beginRunningTransition();
    try {
      this.playSilentUnlockBuffer(context);
      await this.ensureClockIsAdvancing(context, generation);
      this.assertTransitionCurrent(context, generation);
      this.resetClockMonitor(context);
    } catch (error) {
      if (!(error instanceof AudioTransitionSupersededError)) {
        this.poisonContext(context, generation);
      }
      throw error;
    }
  }

  stop(): void {
    this.transitionGeneration += 1;
    this.desiredContextState = "idle";
    this.disableClockMonitor();
    this.silentMode = false;
    if (this.scheduler) clearInterval(this.scheduler);
    this.scheduler = null;
    const oldSessionGain = this.sessionGain;
    if (this.context && oldSessionGain) {
      oldSessionGain.gain.cancelScheduledValues(this.context.currentTime);
      oldSessionGain.gain.setValueAtTime(0, this.context.currentTime);
      oldSessionGain.disconnect();
    }
    this.driveActive = false;
    this.sessionGain = null;
    this.stage = null;
    this.rhythmCueSteps.clear();
  }

  feedback(feedback: HitFeedback): void {
    if (!this.context || !this.sfxGain) return;
    if (feedback.judgement === "perfect") this.tone(1046.5, 0.045, "sine", 0.052);
    else if (feedback.judgement === "great") this.tone(783.99, 0.042, "triangle", 0.043);
    else if (feedback.judgement === "good") this.tone(587.33, 0.04, "triangle", 0.034);
    else if (feedback.judgement === "miss") this.noise(0.035, 0.022);
    else if (feedback.noteType === "booster") this.tone(392, 0.026, "triangle", 0.02);
  }

  setDrive(active: boolean): void {
    if (this.driveActive === active) return;
    this.driveActive = active;
    if (this.context && this.sessionGain) {
      const now = this.context.currentTime;
      this.sessionGain.gain.cancelScheduledValues(now);
      this.sessionGain.gain.setTargetAtTime(active ? 1.08 : 0.94, now, 0.035);
    }
    if (active) {
      [523.25, 659.25, 783.99].forEach((frequency, index) => {
        this.tone(frequency, 0.14, "triangle", 0.045, index * 0.055);
      });
      this.tone(1046.5, 0.22, "sine", 0.034, 0.17);
    }
  }

  arrival(): void {
    [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
      this.tone(frequency, 0.22, "triangle", 0.058, index * 0.1);
    });
  }

  previewBeat(): void {
    this.tone(740, 0.07, "sine", 0.052);
  }

  private setGain(node: GainNode | null, value: number): void {
    if (!node) return;
    if (!this.context || this.context.state === "closed") {
      node.gain.value = value;
      return;
    }
    const now = this.context.currentTime;
    node.gain.cancelScheduledValues(now);
    node.gain.setTargetAtTime(value, now, 0.018);
  }

  private createContext(): void {
    const context = this.contextFactory?.() ?? this.createBrowserContext();
    this.context = context;
    this.noiseBuffer = null;

    const master = context.createGain();
    const limiter = context.createDynamicsCompressor();
    this.musicGain = context.createGain();
    this.sfxGain = context.createGain();

    master.gain.value = 0.92;
    limiter.threshold.value = -9;
    limiter.knee.value = 8;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.16;

    this.musicGain.connect(master);
    this.sfxGain.connect(master);
    master.connect(limiter);
    limiter.connect(context.destination);
  }

  private createBrowserContext(): AudioContext {
    const browserWindow = window as WindowWithAudio;
    const Constructor = browserWindow.AudioContext || browserWindow.webkitAudioContext;
    if (!Constructor) throw new Error("Web Audio API is not supported in this browser");
    return new Constructor();
  }

  private playSilentUnlockBuffer(context: AudioContext): void {
    if (context.state === "closed") return;
    try {
      const source = context.createBufferSource();
      source.buffer = context.createBuffer(1, 1, context.sampleRate);
      source.connect(context.destination);
      source.start(0);
    } catch {
      // Some Safari versions reject a source while interrupted. The bounded
      // resume path below still gets a chance to recover the same context.
    }
  }

  private async ensureClockIsAdvancing(context: AudioContext, generation: number): Promise<void> {
    let lastState = String(context.state);
    for (let attempt = 0; attempt < this.resumeAttempts; attempt += 1) {
      this.assertTransitionCurrent(context, generation);
      lastState = String(context.state);
      if (lastState === "closed") break;

      if (lastState !== "running") {
        this.playSilentUnlockBuffer(context);
        await this.runBounded(
          () => context.resume(),
          () => this.reconcileLateTransition(context),
        );
        this.assertTransitionCurrent(context, generation);
      }

      if (await this.isClockAdvancing(context)) return;
      this.assertTransitionCurrent(context, generation);

      if (String(context.state) === "running" && attempt + 1 < this.resumeAttempts) {
        await this.runBounded(
          () => context.suspend(),
          () => this.reconcileLateTransition(context),
        );
        this.assertTransitionCurrent(context, generation);
        this.playSilentUnlockBuffer(context);
        await this.runBounded(
          () => context.resume(),
          () => this.reconcileLateTransition(context),
        );
        this.assertTransitionCurrent(context, generation);
      }
    }
    throw new Error(`Audio clock did not start (state: ${lastState})`);
  }

  private async isClockAdvancing(context: AudioContext): Promise<boolean> {
    if (String(context.state) !== "running") return false;
    const before = context.currentTime;
    if (!Number.isFinite(before)) return false;
    await this.wait(this.progressProbeMs);
    if (this.context !== context || String(context.state) !== "running") return false;
    const after = context.currentTime;
    const minimumAdvance = Math.max(0.001, this.progressProbeMs / 10_000);
    return Number.isFinite(after) && after - before >= minimumAdvance;
  }

  private async runBounded(
    operation: () => Promise<void>,
    onLateSuccess?: () => void,
  ): Promise<boolean> {
    let operationPromise: Promise<void>;
    try {
      operationPromise = operation();
    } catch {
      return false;
    }
    const result = await Promise.race([
      operationPromise.then(
        () => ({ timedOut: false, succeeded: true }),
        () => ({ timedOut: false, succeeded: false }),
      ),
      this.wait(this.resumeTimeoutMs).then(() => ({ timedOut: true, succeeded: false })),
    ]);
    if (result.timedOut && onLateSuccess) {
      void operationPromise.then(onLateSuccess, () => undefined);
    }
    return result.succeeded;
  }

  private beginRunningTransition(): number {
    this.transitionGeneration += 1;
    this.desiredContextState = "running";
    this.disableClockMonitor();
    return this.transitionGeneration;
  }

  private assertTransitionCurrent(context: AudioContext, generation: number): void {
    if (context !== this.context || generation !== this.transitionGeneration) {
      throw new AudioTransitionSupersededError();
    }
  }

  private resetClockMonitor(context: AudioContext): void {
    this.monitoredContext = context;
    this.monitoredAudioTime = context.currentTime;
    this.monitoredLastProgressMs = Number.NaN;
    this.clockMonitorActive = true;
  }

  private disableClockMonitor(): void {
    this.clockMonitorActive = false;
    this.monitoredContext = null;
    this.monitoredLastProgressMs = Number.NaN;
  }

  private poisonContext(context: AudioContext, generation: number): void {
    if (context !== this.context || generation !== this.transitionGeneration) return;
    this.stop();
    this.context = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.noiseBuffer = null;
    if (String(context.state) !== "closed") {
      try {
        void context.close().catch(() => undefined);
      } catch {
        // The poisoned context is detached even when Safari rejects close().
      }
    }
  }

  private reconcileLateTransition(context: AudioContext): void {
    if (context !== this.context) return;
    const desiredState = this.desiredContextState;
    const actualState = String(context.state);
    if (desiredState === "running" && actualState === "suspended") {
      const generation = this.transitionGeneration;
      void this.runBounded(() => context.resume()).then((resumed) => {
        if (resumed
          && context === this.context
          && generation === this.transitionGeneration
          && String(context.state) === "running") {
          this.resetClockMonitor(context);
        }
      });
      return;
    }
    if (desiredState === "suspended" && actualState === "running") {
      void this.runBounded(() => context.suspend());
      return;
    }
    if (desiredState === "running" && actualState === "running") {
      this.resetClockMonitor(context);
    }
  }

  private async recreateContextForStart(settings: GameSettings, initialError: unknown): Promise<void> {
    const generation = this.beginRunningTransition();
    const oldContext = this.context;
    this.context = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.noiseBuffer = null;
    if (oldContext && oldContext.state !== "closed") {
      await this.runBounded(() => oldContext.close());
    }
    if (generation !== this.transitionGeneration) {
      throw new AudioTransitionSupersededError();
    }

    try {
      this.createContext();
      this.setVolumes(settings.musicVolume, settings.sfxVolume);
      const context = this.context;
      if (!context) throw new Error("Replacement audio context could not be created");
      this.playSilentUnlockBuffer(context);
      await this.ensureClockIsAdvancing(context, generation);
      this.assertTransitionCurrent(context, generation);
      this.resetClockMonitor(context);
    } catch (replacementError) {
      this.disableClockMonitor();
      if (replacementError instanceof AudioTransitionSupersededError) throw replacementError;
      throw new Error("Audio could not be unlocked on this device", {
        cause: replacementError instanceof Error ? replacementError : initialError,
      });
    }
  }

  private scheduleCountIn(): void {
    if (!this.context || !this.sessionGain) return;
    const beat = 60 / (this.stage?.bpm ?? 100);
    for (let index = 0; index < 4; index += 1) {
      const time = this.gameStartTime - beat * (4 - index);
      this.sessionToneAt(index === 3 ? 987.77 : 659.25, time, 0.085, "sine", index === 3 ? 0.058 : 0.045);
      this.sessionToneAt(index === 3 ? 180 : 150, time, 0.055, "triangle", index === 3 ? 0.045 : 0.032);
    }
  }

  private scheduleAhead(): void {
    if (!this.context || !this.stage || !this.sessionGain) return;
    const secondsPerSubdivision = 60 / this.stage.bpm / 4;
    const horizon = this.context.currentTime + 0.65;
    while (this.gameStartTime + this.nextSubdivision * secondsPerSubdivision < horizon) {
      const time = this.gameStartTime + this.nextSubdivision * secondsPerSubdivision;
      if (time >= this.context.currentTime - 0.02) {
        this.scheduleSubdivision(time, this.nextSubdivision, this.stage);
      }
      this.nextSubdivision += 1;
      if (this.nextSubdivision * secondsPerSubdivision > this.stage.duration + 1) {
        if (this.scheduler) clearInterval(this.scheduler);
        this.scheduler = null;
        break;
      }
    }
  }

  private scheduleSubdivision(time: number, subdivision: number, stage: StageDefinition): void {
    const arrangement = ARRANGEMENTS[stage.theme];
    const step = subdivision % 16;
    const bar = Math.floor(subdivision / 16);
    const elapsed = subdivision * (60 / stage.bpm / 4);
    const chorus = this.driveActive || (elapsed >= stage.duration * 0.7 && elapsed < stage.duration - 2);
    const rootDegree = arrangement.progression[bar % arrangement.progression.length];

    if (this.rhythmCueSteps.has(subdivision)) {
      this.scheduleRhythmGuide(time, subdivision, stage);
    }

    if (arrangement.kickSteps.includes(step)) {
      this.kick(time, step === 0 ? (chorus ? 0.16 : 0.14) : 0.11);
    }
    if (step === 4 || step === 12) {
      this.noiseAt(time, 0.075, chorus ? 0.072 : 0.06, "bandpass", 1850, 0.7);
      this.musicTone(190, time, 0.07, "triangle", 0.028, {
        attack: 0.002,
        release: 0.055,
        filterType: "lowpass",
        filterFrequency: 650,
      });
    }

    if (step % 2 === 0 || (chorus && step % 2 === 1)) {
      const strongHat = step % 4 === 2;
      this.noiseAt(
        time,
        strongHat ? 0.032 : 0.022,
        strongHat ? 0.018 : 0.011,
        "highpass",
        stage.theme === "moon" ? 7200 : 6200,
      );
    }

    if (step === 0) {
      const beatDuration = 60 / stage.bpm;
      this.padChord(stage, rootDegree, time, beatDuration * 3.86, chorus);
    }

    const bassIndex = arrangement.bassSteps.indexOf(step);
    if (bassIndex >= 0) {
      const degree = rootDegree + arrangement.bassDegrees[bassIndex];
      const frequency = scaleFrequency(stage.musicScale, degree, -1);
      this.bassTone(frequency, time, 60 / stage.bpm * (step === 0 ? 0.48 : 0.34), chorus);
    }

    const leadIndex = arrangement.leadSteps.indexOf(step);
    if (leadIndex >= 0) {
      const phraseLift = bar % 4 === 2 ? 1 : 0;
      const degree = arrangement.leadDegrees[leadIndex] + phraseLift;
      const frequency = scaleFrequency(stage.musicScale, degree);
      this.leadTone(stage.theme, frequency, time, 60 / stage.bpm * 0.34, chorus);
    }

    this.scheduleThemeTexture(stage, step, rootDegree, time, chorus);
  }

  private scheduleRhythmGuide(time: number, subdivision: number, stage: StageDefinition): void {
    const volume = this.difficulty === "easy" ? 0.036 : this.difficulty === "normal" ? 0.027 : 0.019;
    const degree = subdivision % 4 === 0 ? 4 : 2;
    const duration = Math.min(0.078, 60 / stage.bpm * 0.14);
    this.musicTone(
      scaleFrequency(stage.musicScale, degree, 1),
      time,
      duration,
      "sine",
      volume,
      {
        attack: 0.002,
        release: Math.max(0.025, duration * 0.72),
        filterType: "highpass",
        filterFrequency: 1100,
      },
    );
  }

  private padChord(
    stage: StageDefinition,
    rootDegree: number,
    time: number,
    duration: number,
    chorus: boolean,
  ): void {
    const chordDegrees = [rootDegree, rootDegree + 2, rootDegree + 4];
    chordDegrees.forEach((degree, index) => {
      this.musicTone(
        scaleFrequency(stage.musicScale, degree),
        time,
        duration,
        stage.theme === "moon" ? "sine" : "triangle",
        (chorus ? 0.024 : 0.019) * (index === 0 ? 1.1 : 1),
        {
          attack: stage.theme === "moon" ? 0.16 : 0.08,
          release: 0.32,
          detune: index === 1 ? -4 : index === 2 ? 4 : 0,
          filterType: "lowpass",
          filterFrequency: stage.theme === "jungle" ? 1500 : 2200,
        },
      );
    });
  }

  private bassTone(frequency: number, time: number, duration: number, chorus: boolean): void {
    this.musicTone(frequency, time, duration, "triangle", chorus ? 0.082 : 0.07, {
      attack: 0.005,
      release: Math.min(0.1, duration * 0.45),
      filterType: "lowpass",
      filterFrequency: 520,
    });
    this.musicTone(frequency * 2, time, duration * 0.72, "sine", chorus ? 0.022 : 0.017, {
      attack: 0.004,
      release: Math.min(0.08, duration * 0.4),
    });
  }

  private leadTone(
    theme: StageTheme,
    frequency: number,
    time: number,
    duration: number,
    chorus: boolean,
  ): void {
    const type: OscillatorType = theme === "jungle" ? "square" : theme === "moon" ? "sine" : "triangle";
    this.musicTone(frequency, time, duration, type, chorus ? 0.058 : 0.048, {
      attack: 0.007,
      release: Math.min(0.095, duration * 0.48),
      filterType: theme === "jungle" ? "lowpass" : undefined,
      filterFrequency: theme === "jungle" ? 2400 : undefined,
    });
    if (chorus) {
      this.musicTone(frequency * 2, time, duration * 0.82, "sine", 0.015, {
        attack: 0.01,
        release: Math.min(0.08, duration * 0.45),
      });
    }
    if (theme === "moon") {
      this.musicTone(frequency, time + 60 / 120 / 4, duration * 0.68, "sine", 0.014, {
        attack: 0.018,
        release: Math.min(0.09, duration * 0.5),
        detune: 7,
      });
    }
  }

  private scheduleThemeTexture(
    stage: StageDefinition,
    step: number,
    rootDegree: number,
    time: number,
    chorus: boolean,
  ): void {
    if (stage.theme === "city" && [2, 6, 10, 14].includes(step)) {
      this.noiseAt(time, 0.018, chorus ? 0.014 : 0.009, "highpass", 7600);
      return;
    }
    if (stage.theme === "jungle" && [3, 7, 11, 15].includes(step)) {
      const frequency = 155 + (step % 8) * 9;
      this.musicTone(frequency, time, 0.082, "triangle", chorus ? 0.034 : 0.027, {
        attack: 0.002,
        release: 0.065,
        filterType: "bandpass",
        filterFrequency: 680,
        filterQ: 1.2,
      });
      return;
    }
    if (stage.theme === "moon" && [1, 5, 9, 13].includes(step)) {
      const degree = rootDegree + Math.floor(step / 4) + 2;
      this.musicTone(scaleFrequency(stage.musicScale, degree, 1), time, 0.14, "sine", chorus ? 0.022 : 0.016, {
        attack: 0.012,
        release: 0.1,
        detune: step % 8 === 1 ? -6 : 6,
      });
    }
  }

  private musicTone(
    frequency: number,
    time: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    shape: VoiceShape = {},
  ): void {
    if (!this.context || !this.sessionGain) return;
    const safeDuration = Math.max(0.025, duration);
    const attack = Math.max(0.002, Math.min(shape.attack ?? 0.009, safeDuration * 0.38));
    const release = Math.max(0.012, Math.min(shape.release ?? 0.07, safeDuration * 0.58));
    const releaseStart = Math.max(time + attack + 0.002, time + safeDuration - release);
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, time);
    oscillator.detune.setValueAtTime(shape.detune ?? 0, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(volume, time + attack);
    gain.gain.linearRampToValueAtTime(volume * 0.72, releaseStart);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + safeDuration);

    if (shape.filterType && shape.filterFrequency) {
      const filter = this.context.createBiquadFilter();
      filter.type = shape.filterType;
      filter.frequency.setValueAtTime(shape.filterFrequency, time);
      filter.Q.value = shape.filterQ ?? 0.7;
      oscillator.connect(filter);
      filter.connect(gain);
    } else {
      oscillator.connect(gain);
    }
    gain.connect(this.sessionGain);
    oscillator.start(time);
    oscillator.stop(time + safeDuration + 0.025);
  }

  private kick(time: number, volume: number): void {
    if (!this.context || !this.sessionGain) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.frequency.setValueAtTime(135, time);
    oscillator.frequency.exponentialRampToValueAtTime(48, time + 0.095);
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.11);
    oscillator.connect(gain);
    gain.connect(this.sessionGain);
    oscillator.start(time);
    oscillator.stop(time + 0.115);
  }

  private noiseAt(
    time: number,
    duration: number,
    volume: number,
    filterType?: BiquadFilterType,
    filterFrequency?: number,
    filterQ = 0.7,
  ): void {
    if (!this.context || !this.sessionGain) return;
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = this.getNoiseBuffer();
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    if (filterType && filterFrequency) {
      const filter = this.context.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.setValueAtTime(filterFrequency, time);
      filter.Q.value = filterQ;
      source.connect(filter);
      filter.connect(gain);
    } else {
      source.connect(gain);
    }
    gain.connect(this.sessionGain);
    const maxOffset = Math.max(0, (this.noiseBuffer?.duration ?? duration) - duration);
    source.start(time, Math.random() * maxOffset, duration);
  }

  private tone(
    frequency: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    delay = 0,
  ): void {
    if (!this.context) return;
    this.toneAt(frequency, this.context.currentTime + delay, duration, type, volume);
  }

  private toneAt(
    frequency: number,
    time: number,
    duration: number,
    type: OscillatorType,
    volume: number,
  ): void {
    if (!this.context || !this.sfxGain) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(volume, time + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    oscillator.connect(gain);
    gain.connect(this.sfxGain);
    oscillator.start(time);
    oscillator.stop(time + duration + 0.02);
  }

  private sessionToneAt(
    frequency: number,
    time: number,
    duration: number,
    type: OscillatorType,
    volume: number,
  ): void {
    if (!this.context || !this.sessionGain) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(volume, time + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    oscillator.connect(gain);
    gain.connect(this.sessionGain);
    oscillator.start(time);
    oscillator.stop(time + duration + 0.02);
  }

  private noise(duration: number, volume: number): void {
    if (!this.context || !this.sfxGain) return;
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = this.getNoiseBuffer();
    gain.gain.value = volume;
    source.connect(gain);
    gain.connect(this.sfxGain);
    const maxOffset = Math.max(0, source.buffer.duration - duration);
    source.start(0, Math.random() * maxOffset, duration);
  }

  private getNoiseBuffer(): AudioBuffer {
    if (!this.context) throw new Error("Audio context is not ready");
    if (this.noiseBuffer && this.noiseBuffer.sampleRate === this.context.sampleRate) return this.noiseBuffer;
    const duration = 2;
    const sampleCount = Math.floor(this.context.sampleRate * duration);
    const buffer = this.context.createBuffer(1, sampleCount, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
    this.noiseBuffer = buffer;
    return buffer;
  }
}

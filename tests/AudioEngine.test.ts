import assert from "node:assert/strict";
import test from "node:test";
import {
  AudioEngine,
  eventTimestampAgeSeconds,
  mixSliderGain,
  presentationAudioTimeAt,
  scaleFrequency,
} from "../src/game/engines/AudioEngine.ts";
import { STAGES, getStage } from "../src/game/data/stages.ts";

test("event timestamp age supports relative and epoch based browser timestamps", () => {
  assert.equal(eventTimestampAgeSeconds(975, 1000, 10_000), 0.025);
  assert.equal(eventTimestampAgeSeconds(10_975, 1000, 10_000), 0.025);
});

test("event timestamp age is safely bounded", () => {
  assert.equal(eventTimestampAgeSeconds(1, 5000, 10_000), 1);
  assert.equal(eventTimestampAgeSeconds(1100, 1000, 10_000), -0.05);
  assert.equal(eventTimestampAgeSeconds(Number.NaN, 1000, 10_000), 0);
});

test("presentation clock maps visual and input time to the audio reaching the speaker", () => {
  const mapped = presentationAudioTimeAt(
    1025,
    1100,
    10.2,
    0.02,
    0.03,
    { contextTime: 10, performanceTime: 1000 },
  );
  assert.ok(Math.abs(mapped - 10.025) < 0.000_001);
});

test("presentation clock falls back to reported output latency", () => {
  const mapped = presentationAudioTimeAt(
    1025,
    1100,
    10.2,
    0.02,
    0.03,
  );
  assert.ok(Math.abs(mapped - 10.075) < 0.000_001);
});

test("presentation clock ignores an output timestamp inconsistent with raw currentTime", () => {
  const mapped = presentationAudioTimeAt(
    1025,
    1100,
    10.2,
    0.02,
    0.03,
    { contextTime: 0, performanceTime: 1000 },
  );

  assert.ok(Math.abs(mapped - 10.075) < 0.000_001);
});

test("presentation clock ignores an output timestamp with a bogus performance anchor", () => {
  const mapped = presentationAudioTimeAt(
    1025,
    1100,
    10.2,
    0.02,
    0.03,
    { contextTime: 10, performanceTime: 1_700_000_000_000 },
  );

  assert.ok(Math.abs(mapped - 10.075) < 0.000_001);
});

test("presentation clock safely rejects impossible future timestamps", () => {
  const mapped = presentationAudioTimeAt(
    5000,
    1000,
    10,
    0,
    0,
  );
  assert.equal(mapped, 10.05);
});

test("channel mix keeps music clear without letting feedback dominate", () => {
  assert.equal(mixSliderGain(0, "music"), 0);
  assert.equal(mixSliderGain(0, "sfx"), 0);
  assert.equal(mixSliderGain(1, "music"), 1);
  assert.equal(mixSliderGain(1, "sfx"), 0.68);
  assert.ok(mixSliderGain(0.58, "music") > mixSliderGain(0.72, "sfx"));
  assert.equal(mixSliderGain(Number.NaN, "music"), 0);
  assert.equal(mixSliderGain(2, "music"), 1);
  assert.equal(mixSliderGain(-1, "sfx"), 0);

  let previousMusicGain = -1;
  for (let index = 0; index <= 20; index += 1) {
    const sliderValue = index / 20;
    const musicGain = mixSliderGain(sliderValue, "music");
    assert.ok(musicGain > previousMusicGain, `music gain stalled at ${sliderValue}`);
    if (sliderValue > 0) assert.ok(musicGain > mixSliderGain(sliderValue, "sfx"));
    previousMusicGain = musicGain;
  }
});

test("scale degrees wrap predictably across octaves", () => {
  const scale = [220, 261.63, 293.66, 329.63, 392, 440];
  assert.equal(scaleFrequency(scale, 0), 220);
  assert.equal(scaleFrequency(scale, 4), 392);
  assert.equal(scaleFrequency(scale, 5), 440);
  assert.equal(scaleFrequency(scale, 6), 523.26);
  assert.notEqual(scaleFrequency(scale, 5), scaleFrequency(scale, 6));
  assert.equal(scaleFrequency(scale, -1), 196);
  assert.equal(scaleFrequency(scale, 2, -1), 146.83);
  assert.equal(scaleFrequency([100, 130, 170], 3), 200);
  assert.equal(scaleFrequency([], 4), 440);
});
test("every stage scale treats its terminal octave as an endpoint", () => {
  for (const stage of STAGES) {
    const period = stage.musicScale.length - 1;
    assert.equal(scaleFrequency(stage.musicScale, period), stage.musicScale[0] * 2);
    assert.notEqual(
      scaleFrequency(stage.musicScale, period),
      scaleFrequency(stage.musicScale, period + 1),
    );
  }
});
function fakeAudioParam(initialValue = 1) {
  return {
    value: initialValue,
    cancelScheduledValues() {},
    setValueAtTime(value: number) {
      this.value = value;
    },
    setTargetAtTime(value: number) {
      this.value = value;
    },
    linearRampToValueAtTime(value: number) {
      this.value = value;
    },
    exponentialRampToValueAtTime(value: number) {
      this.value = value;
    },
  };
}

function fakeGain() {
  return {
    gain: fakeAudioParam(),
    destination: null as unknown,
    disconnected: false,
    connect(destination: unknown) {
      this.destination = destination;
    },
    disconnect() {
      this.disconnected = true;
    },
  };
}

class FakeAudioContext {
  currentTime = 0;
  state = "running";
  sampleRate = 1000;
  destination = {};
  gainNodes: ReturnType<typeof fakeGain>[] = [];
  compressorCount = 0;
  filterCount = 0;
  detuneWrites = 0;
  oscillatorStarts = 0;
  bufferSourceStarts = 0;
  resumeCalls = 0;
  suspendCalls = 0;
  closeCalls = 0;
  advanceOnWait = true;
  recoverAfterSuspend = false;
  resumeNeverSettles = false;
  suspendNeverSettles = false;
  deferSuspend = false;
  completeSuspend: (() => void) | null = null;

  createGain() {
    const gain = fakeGain();
    this.gainNodes.push(gain);
    return gain;
  }

  createDynamicsCompressor() {
    this.compressorCount += 1;
    return {
      threshold: fakeAudioParam(),
      knee: fakeAudioParam(),
      ratio: fakeAudioParam(),
      attack: fakeAudioParam(),
      release: fakeAudioParam(),
      connect() {},
    };
  }

  createBiquadFilter() {
    this.filterCount += 1;
    return {
      type: "lowpass",
      frequency: fakeAudioParam(),
      Q: fakeAudioParam(),
      connect() {},
    };
  }

  createOscillator() {
    const detune = fakeAudioParam();
    const originalSetValue = detune.setValueAtTime.bind(detune);
    detune.setValueAtTime = (value: number) => {
      this.detuneWrites += 1;
      originalSetValue(value);
    };
    return {
      type: "sine",
      frequency: fakeAudioParam(),
      detune,
      connect() {},
      start: () => {
        this.oscillatorStarts += 1;
      },
      stop() {},
    };
  }

  createBuffer(_channels: number, sampleCount: number, sampleRate: number) {
    const data = new Float32Array(sampleCount);
    return {
      duration: sampleCount / sampleRate,
      sampleRate,
      getChannelData: () => data,
    };
  }

  createBufferSource() {
    return {
      buffer: null as { duration: number } | null,
      connect() {},
      start: () => {
        this.bufferSourceStarts += 1;
      },
    };
  }

  async resume() {
    this.resumeCalls += 1;
    if (this.resumeNeverSettles) return new Promise<void>(() => undefined);
    this.state = "running";
    if (this.recoverAfterSuspend && this.suspendCalls > 0) this.advanceOnWait = true;
  }

  async suspend() {
    this.suspendCalls += 1;
    if (this.suspendNeverSettles) return new Promise<void>(() => undefined);
    if (this.deferSuspend) {
      return new Promise<void>((resolve) => {
        this.completeSuspend = () => {
          this.state = "suspended";
          resolve();
        };
      });
    }
    this.state = "suspended";
  }

  async close() {
    this.closeCalls += 1;
    this.state = "closed";
  }

  advance(milliseconds: number) {
    if (this.state === "running" && this.advanceOnWait) {
      this.currentTime += milliseconds / 1000;
    }
  }
}

const SETTINGS = {
  musicVolume: 0.76,
  sfxVolume: 0.55,
  effectsStrength: 0.8,
  timingOffsetMs: 0,
  reducedMotion: false,
};

function audioForContexts(contexts: FakeAudioContext[]) {
  let activeContext = contexts[0];
  let factoryCalls = 0;
  const audio = new AudioEngine({
    contextFactory: () => {
      activeContext = contexts[Math.min(factoryCalls, contexts.length - 1)];
      factoryCalls += 1;
      return activeContext as unknown as AudioContext;
    },
    wait: (milliseconds) => {
      if (milliseconds <= 8) {
        activeContext.advance(milliseconds);
        return Promise.resolve();
      }
      return new Promise((resolve) => setImmediate(resolve));
    },
    progressProbeMs: 8,
    resumeTimeoutMs: 50,
    resumeAttempts: 2,
    clockStallGraceMs: 600,
  });
  return { audio, factoryCalls: () => factoryCalls };
}

test("audio output uses a limiter, silent unlock buffer, and calibrated channel gains", async () => {
  const context = new FakeAudioContext();
  const { audio } = audioForContexts([context]);

  await audio.prepare(SETTINGS);

  assert.equal(context.compressorCount, 1);
  assert.equal(context.gainNodes.length, 3);
  assert.equal(context.gainNodes[1].gain.value, mixSliderGain(0.76, "music"));
  assert.equal(context.gainNodes[2].gain.value, mixSliderGain(0.55, "sfx"));
  assert.equal(context.bufferSourceStarts, 1);
});

test("interrupted iPad audio context is resumed and its raw clock is probed", async () => {
  const context = new FakeAudioContext();
  context.state = "interrupted";
  const { audio } = audioForContexts([context]);

  const preparing = audio.prepare(SETTINGS);
  assert.equal(context.resumeCalls, 1, "resume must be invoked in the original user-gesture turn");
  assert.ok(context.bufferSourceStarts >= 2);
  await preparing;

  assert.equal(context.state, "running");
  assert.ok(context.currentTime > 0);
});

test("running but stalled iPad audio context recovers through suspend and resume", async () => {
  const context = new FakeAudioContext();
  context.advanceOnWait = false;
  context.recoverAfterSuspend = true;
  const { audio } = audioForContexts([context]);

  await audio.prepare(SETTINGS);

  assert.ok(context.suspendCalls >= 1);
  assert.ok(context.resumeCalls >= 1);
  assert.ok(context.currentTime > 0);
});

test("runtime watchdog detects a clock that freezes after prepare", async () => {
  const context = new FakeAudioContext();
  const { audio } = audioForContexts([context]);
  await audio.prepare(SETTINGS);

  assert.equal(audio.hasClockStalled(1000), false);
  context.advanceOnWait = false;
  assert.equal(audio.hasClockStalled(1599), false);
  assert.equal(audio.hasClockStalled(1600), true);

  context.state = "interrupted";
  assert.equal(audio.hasClockStalled(1601), true);
  audio.stop();
  assert.equal(audio.hasClockStalled(3000), false);
});

test("a runtime iPad clock freeze falls back to silent play without resetting the run", async () => {
  const context = new FakeAudioContext();
  const { audio } = audioForContexts([context]);
  const startTime = await audio.start(getStage("city"), "easy", SETTINGS);
  const performanceNow = performance.now();

  context.advanceOnWait = false;
  assert.equal(audio.hasClockStalled(performanceNow - 600), false);
  assert.equal(audio.hasClockStalled(performanceNow), true);

  const fallbackTime = audio.continueWithoutSound(performanceNow);
  assert.equal(audio.isSilent, true);
  assert.equal(audio.hasClockStalled(performanceNow + 10_000), false);
  assert.ok(fallbackTime < startTime, "the original count-in anchor must stay in the future");
  assert.ok(audio.now() >= fallbackTime, "the fallback clock must continue from the current run");
  assert.equal(
    (audio as unknown as { gameStartTime: number }).gameStartTime,
    startTime,
    "switching clocks must not restart the countdown",
  );
});

test("never-settling suspend throws and poisons the old context", async () => {
  const context = new FakeAudioContext();
  const replacementContext = new FakeAudioContext();
  const { audio, factoryCalls } = audioForContexts([context, replacementContext]);
  await audio.prepare(SETTINGS);
  context.suspendNeverSettles = true;

  await assert.rejects(audio.pause(), /Audio could not be suspended/);

  const internalContext = (audio as unknown as { context: AudioContext | null }).context;
  assert.equal(internalContext, null);
  assert.equal(context.closeCalls, 1);
  assert.equal(factoryCalls(), 1);

  await audio.start(getStage("city"), "easy", SETTINGS);
  assert.equal(factoryCalls(), 2);
  assert.equal(replacementContext.state, "running");
  audio.stop();
});

test("a late suspend completion cannot stop the replacement context", async () => {
  const oldContext = new FakeAudioContext();
  const replacementContext = new FakeAudioContext();
  const { audio, factoryCalls } = audioForContexts([oldContext, replacementContext]);
  await audio.prepare(SETTINGS);
  oldContext.deferSuspend = true;

  await assert.rejects(audio.pause(), /Audio could not be suspended/);
  await audio.start(getStage("city"), "easy", SETTINGS);
  assert.equal(factoryCalls(), 2);

  oldContext.completeSuspend?.();
  await Promise.resolve();

  const activeContext = (audio as unknown as { context: AudioContext | null }).context;
  assert.equal(activeContext, replacementContext as unknown as AudioContext);
  assert.equal(oldContext.state, "suspended");
  assert.equal(replacementContext.state, "running");
  assert.equal(audio.hasClockStalled(1000), false);
  audio.stop();
});

test("start recreates a context only after the original clock is unrecoverable", async () => {
  const stalledContext = new FakeAudioContext();
  stalledContext.advanceOnWait = false;
  const replacementContext = new FakeAudioContext();
  const { audio, factoryCalls } = audioForContexts([stalledContext, replacementContext]);

  const startTime = await audio.start(getStage("city"), "easy", SETTINGS);

  assert.equal(factoryCalls(), 2);
  assert.equal(stalledContext.closeCalls, 1);
  assert.ok(startTime > replacementContext.currentTime);
  audio.stop();
});

test("resume throws on an unrecoverable clock without recreating the context", async () => {
  const context = new FakeAudioContext();
  const { audio, factoryCalls } = audioForContexts([context, new FakeAudioContext()]);
  await audio.prepare(SETTINGS);
  context.state = "interrupted";
  context.advanceOnWait = false;

  await assert.rejects(audio.resume(), /Audio clock did not start/);

  assert.equal(factoryCalls(), 1);
});

test("bounded resume rejects when Safari never settles its resume promise", async () => {
  const context = new FakeAudioContext();
  const { audio, factoryCalls } = audioForContexts([context, new FakeAudioContext()]);
  await audio.prepare(SETTINGS);
  context.state = "interrupted";
  context.advanceOnWait = false;
  context.resumeNeverSettles = true;

  await assert.rejects(
    audio.resume(),
    /Audio clock did not start/,
  );

  assert.equal(context.resumeCalls, 2);
  assert.equal(factoryCalls(), 1);
});

test("start rejects instead of leaving the countdown at four when recovery fails", async () => {
  const firstContext = new FakeAudioContext();
  const replacementContext = new FakeAudioContext();
  firstContext.advanceOnWait = false;
  replacementContext.advanceOnWait = false;
  const { audio, factoryCalls } = audioForContexts([firstContext, replacementContext]);

  await assert.rejects(
    audio.start(getStage("city"), "easy", SETTINGS),
    /Audio could not be unlocked/,
  );

  assert.equal(factoryCalls(), 2);
});

test("silent driving mode advances on the performance clock without Web Audio", async () => {
  const audio = new AudioEngine();
  const before = performance.now() / 1000;
  const startTime = audio.startSilent(getStage("city"), "easy");

  assert.equal(audio.isSilent, true);
  assert.ok(startTime > before + 2);
  assert.ok(audio.now() >= before);
  assert.equal(audio.hasClockStalled(before * 1000 + 10_000), false);
  assert.ok(audio.eventTimeToAudioTime(performance.now()) > 0);

  await audio.pause();
  await audio.resume();
  audio.stop();
  assert.equal(audio.isSilent, false);
});

test("stage arrangement creates filtered, detuned instrument voices", () => {
  const context = new FakeAudioContext();
  const audio = new AudioEngine();
  const internals = audio as unknown as {
    context: AudioContext | null;
    sessionGain: GainNode | null;
    scheduleSubdivision(time: number, subdivision: number, stage: ReturnType<typeof getStage>): void;
  };
  internals.context = context as unknown as AudioContext;
  internals.sessionGain = fakeGain() as unknown as GainNode;

  internals.scheduleSubdivision(1, 0, getStage("city"));

  assert.ok(context.filterCount >= 4);
  assert.ok(context.detuneWrites >= 6);
  assert.ok(context.oscillatorStarts >= 7);
});
test("scheduled count-in tones are silenced with the old session", () => {
  const scheduledGains: ReturnType<typeof fakeGain>[] = [];
  const oscillatorStarts: number[] = [];
  const context = {
    currentTime: 3,
    createGain() {
      const gain = fakeGain();
      scheduledGains.push(gain);
      return gain;
    },
    createOscillator() {
      return {
        type: "sine",
        frequency: fakeAudioParam(),
        connect() {},
        start(time: number) {
          oscillatorStarts.push(time);
        },
        stop() {},
      };
    },
  };
  const oldSessionGain = fakeGain();
  const audio = new AudioEngine();
  const internals = audio as unknown as {
    context: AudioContext | null;
    sessionGain: GainNode | null;
    stage: ReturnType<typeof getStage> | null;
    gameStartTime: number;
    scheduleCountIn(): void;
  };
  internals.context = context as unknown as AudioContext;
  internals.sessionGain = oldSessionGain as unknown as GainNode;
  internals.stage = getStage("city");
  internals.gameStartTime = 10;

  internals.scheduleCountIn();
  assert.equal(oscillatorStarts.length, 8);
  assert.equal(scheduledGains.length, 8);
  assert.ok(scheduledGains.every((gain) => gain.destination === oldSessionGain));

  audio.stop();
  assert.equal(internals.sessionGain, null);
  assert.equal(oldSessionGain.disconnected, true);
});

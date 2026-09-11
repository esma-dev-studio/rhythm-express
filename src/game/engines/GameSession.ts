import type {
  Difficulty,
  GameAction,
  HitFeedback,
  Judgement,
  RuntimeNote,
  SessionResult,
  SessionStats,
  StageDefinition,
  PlayMode,
  RhythmTracePoint,
} from "../types.ts";
import { assignHands, handAtSlot, handForAction } from "../handPlay.ts";
import { ChartEngine } from "./ChartEngine.ts";
import {
  DIFFICULTIES,
  judgeTiming,
  judgementLabel,
  judgementScore,
  worseJudgement,
} from "./JudgementEngine.ts";
import { TimingEngine } from "./TimingEngine.ts";
import { completedGoalIds, getRunGoals } from "../runGoals.ts";

const EMPTY_COUNTS: SessionStats["counts"] = { perfect: 0, great: 0, good: 0, miss: 0 };

export class GameSession {
  readonly chart: ChartEngine;
  readonly timing = new TimingEngine();
  readonly stats: SessionStats;
  private forcedComplete = false;
  private driveActive = false;
  rhythmPoints = 0;
  private rhythmTrace: RhythmTracePoint[] = [];
  routeLane = 0;

  constructor(
    readonly stage: StageDefinition,
    readonly difficulty: Difficulty,
    readonly playMode: PlayMode = "one",
  ) {
    const chart = playMode === "duet" ? assignHands(stage.notes[difficulty]) : stage.notes[difficulty];
    this.chart = new ChartEngine(chart);
    this.stats = {
      score: 0,
      combo: 0,
      maxCombo: 0,
      counts: { ...EMPTY_COUNTS },
      offsets: [],
      quietSuccess: 0,
      quietTotal: chart.filter((note) => note.type === "quiet").length,
      beamSuccess: 0,
      beamTotal: chart.filter((note) => note.type === "beam").length,
      boosterSuccess: 0,
      boosterTotal: chart.filter((note) => note.type === "booster").length,
      switchSuccess: 0,
      switchTotal: chart.filter((note) => note.type === "switch").length,
      driveActivations: 0,
      flowPeak: 1,
      totalNotes: chart.length,
    };
  }

  start(audioAnchorTime: number, inputOffsetMs: number): void {
    this.timing.start(audioAnchorTime, inputOffsetMs);
  }

  playhead(audioTime: number): number {
    return this.timing.getPlayhead(audioTime);
  }

  get hasSwitch(): boolean {
    return this.chart.all().some((note) => note.type === "switch");
  }

  get flowMultiplier(): number {
    if (this.stats.combo >= 32) return 1.75;
    if (this.stats.combo >= 18) return 1.5;
    if (this.stats.combo >= 8) return 1.25;
    return 1;
  }

  get scoreMultiplier(): number {
    return this.flowMultiplier * (this.driveActive ? 2 : 1);
  }

  get isDriveActive(): boolean {
    return this.driveActive;
  }

  activateDrive(): boolean {
    if (this.driveActive) return false;
    this.driveActive = true;
    this.stats.driveActivations += 1;
    return true;
  }

  setDriveActive(active: boolean): void {
    this.driveActive = active;
  }

  addBonusScore(points: number): void {
    if (!Number.isFinite(points) || points <= 0) return;
    this.stats.score += Math.round(points);
  }

  pause(audioTime: number): void {
    this.timing.pause(audioTime);
  }

  resume(audioTime: number): void {
    this.timing.resume(audioTime);
  }

  input(action: GameAction, isDown: boolean, audioTime: number): HitFeedback | null {
    const feedback = this.resolveInput(action, isDown, audioTime);
    if (feedback?.performance && feedback.judgement && feedback.judgement !== "miss") {
      const hand = handForAction(action);
      if (hand) feedback.performance.hand = hand;
      this.rhythmPoints += feedback.judgement === "perfect" ? 100 : feedback.judgement === "great" ? 70 : 40;
      const note = this.chart.all().find(n => n.id === feedback.performance?.noteId)!;
      const time = note.time + (feedback.performance.phase === "release" ? note.duration : note.type === "booster" ? feedback.performance.slot * note.duration / Math.max(1, note.targetHits ?? 4) : 0);
      this.rhythmTrace.push({ time: Math.max(time, this.rhythmTrace.at(-1)?.time ?? 0), points: this.rhythmPoints });
    }
    return feedback;
  }

  private resolveInput(action: GameAction, isDown: boolean, audioTime: number): HitFeedback | null {
    const now = this.timing.getInputPlayhead(audioTime);
    if (now < 0 || this.isComplete(now)) return null;

    let duetTarget: RuntimeNote | undefined;
    const hand = handForAction(action);
    if (this.playMode === "duet") {
      if (!hand) return null;
      const held = this.chart.holdingBeam();
      if (!isDown && held?.hand !== hand) return null;
      if (isDown && !held && !this.chart.active("quiet", now)) {
        const roll = this.chart.active("booster", now) ?? this.chart.nearest(["booster"], now, this.difficulty);
        const activeRoll = roll && now < roll.time + roll.duration - .0002 ? roll : undefined;
        const target = activeRoll ?? this.chart.nearest(["spark", "beam", "switch"], now, this.difficulty);
        duetTarget = target;
        if (target) {
          let slot = 0;
          let targetTime = target.time;
          let eligible = true;
          if (target.type === "booster") {
            const count = Math.max(1, target.targetHits ?? 4), interval = target.duration / count;
            slot = Math.round((now - target.time) / interval); targetTime += slot * interval;
            eligible = slot >= 0 && slot < count && Math.abs(now - targetTime) <= Math.min(DIFFICULTIES[this.difficulty].goodMs / 1000, interval * .42)
              && !target.boosterHitSlots.includes(slot) && !target.boosterWrongSlots?.includes(slot);
          }
          const expectedHand = handAtSlot(target, slot);
          if (eligible && hand !== expectedHand) {
            const deltaMs = (now - targetTime) * 1000;
            const result = target.type === "booster"
              ? { judgement: "miss" as const, noteType: target.type, deltaMs, energyDelta: -3 }
              : this.finish(target, "miss", deltaMs);
            if (target.type === "booster") (target.boosterWrongSlots ??= []).push(slot);
            return { ...result, label: "はんたい！", expectedHand };
          }
          if (target.type === "switch") action = target.direction ?? "left";
          else action = "tap";
        } else action = "tap";
      } else action = "tap";
    } else if (hand) return null;

    if (action !== "tap" && !this.hasSwitch) return null;

    if (isDown) {
      const quiet = this.chart.active("quiet", now);
      if (quiet) {
        quiet.quietBroken = true;
        return { label: "しずかに とおろう", noteType: "quiet", energyDelta: -3 };
      }
    }

    if (action === "tap") {
      if (!isDown) return this.releaseBeam(now);

      const holdingBeam = this.chart.holdingBeam();
      if (holdingBeam) {
        return { label: "ながおしを つづけよう。おわりで はなしてね", noteType: "beam", energyDelta: 0 };
      }

      const booster = this.chart.active("booster", now) ?? this.chart.nearest(["booster"], now, this.difficulty);
      // Chart decimals can differ from the next bar by up to 0.1 ms.
      // Never let the tail of a roll steal that next playable note.
      if (booster && now < booster.time + booster.duration - .0002) {
        return this.hitBooster(booster, now);
      }

      const beam = this.playMode === "duet" ? duetTarget?.type === "beam" ? duetTarget : undefined : this.chart.nearest(["beam"], now, this.difficulty);
      if (beam) {
        const deltaMs = (now - beam.time) * 1000;
        const judgement = judgeTiming(deltaMs, this.difficulty);
        beam.state = judgement === "miss" ? "resolved" : "holding";
        beam.beamStartJudgement = judgement;
        beam.beamStartDeltaMs = deltaMs;
        if (judgement === "miss") return this.finish(beam, judgement, deltaMs);
        return { judgement, label: "そのままのばそう！", noteType: "beam", deltaMs, energyDelta: 4,
          performance: { noteId: beam.id, phase: "hold", slot: 0 } };
      }

      const spark = this.playMode === "duet" ? duetTarget?.type === "spark" ? duetTarget : undefined : this.chart.nearest(["spark"], now, this.difficulty);
      if (spark) {
        const deltaMs = (now - spark.time) * 1000;
        return { ...this.finish(spark, judgeTiming(deltaMs, this.difficulty), deltaMs),
          performance: { noteId: spark.id, phase: "strike", slot: 0 } };
      }

      return { label: "リズムを よく きこう", energyDelta: -1 };
    }

    if (!isDown) return null;
    const switchNote = this.chart.nearest(["switch"], now, this.difficulty);
    if (!switchNote) return { label: "つぎの わかれみちを みよう", energyDelta: -1 };
    const deltaMs = (now - switchNote.time) * 1000;
    if (switchNote.direction !== action) {
      const result = this.finish(switchNote, "miss", deltaMs);
      return { ...result, label: "はんたいの レバー！ つぎは やじるしを みよう" };
    }
    this.routeLane = action === "left" ? -1 : 1;
    const result = this.finish(switchNote, judgeTiming(deltaMs, this.difficulty), deltaMs);
    if (result.judgement !== "miss") this.stats.switchSuccess += 1;
    return { ...result, performance: { noteId: switchNote.id, phase: "strike", slot: 0 } };
  }

  update(audioTime: number): HitFeedback[] {
    const now = this.playhead(audioTime);
    const missWindow = DIFFICULTIES[this.difficulty].goodMs / 1000;
    const feedback: HitFeedback[] = [];
    for (const note of this.chart.all()) {
      if (note.state === "resolved") continue;
      const end = note.time + note.duration;

      if ((note.type === "spark" || note.type === "switch") && now > note.time + missWindow) {
        feedback.push(this.finish(note, "miss", (now - note.time) * 1000));
      } else if (note.type === "beam" && note.state === "pending" && now > note.time + missWindow) {
        feedback.push(this.finish(note, "miss", (now - note.time) * 1000));
      } else if (note.type === "beam" && note.state === "holding" && now > end + missWindow) {
        feedback.push(this.finish(note, "miss", (now - end) * 1000));
      } else if (note.type === "booster" && now >= end) {
        const ratio = note.boosterHitSlots.length / Math.max(1, note.targetHits ?? 4);
        const judgement: Judgement = ratio >= 1 ? "perfect" : ratio >= 0.65 ? "great" : ratio >= 0.4 ? "good" : "miss";
        const result = this.finish(note, judgement, 0);
        if (judgement !== "miss") this.stats.boosterSuccess += 1;
        feedback.push({ ...result, label: judgement === "miss" ? "つぎは おとに あわせて れんだ！" : "れんだ できた！" });
      } else if (note.type === "quiet" && now >= end) {
        const judgement: Judgement = note.quietBroken ? "miss" : "perfect";
        const result = this.finish(note, judgement, 0);
        if (!note.quietBroken) this.stats.quietSuccess += 1;
        feedback.push({ ...result, label: note.quietBroken ? "つぎは しずかに とおろう" : "しずかに とおれた！" });
      }
    }
    return feedback;
  }

  protectHeldBeam(audioTime?: number): HitFeedback | null {
    void audioTime;
    const beam = this.chart.holdingBeam();
    if (!beam) return null;
    return { label: "ながおしは だいじょうぶ。つづけたら「おす！」を おしなおそう", noteType: "beam", energyDelta: 0 };
  }

  private hitBooster(booster: RuntimeNote, now: number): HitFeedback {
    const targetHits = Math.max(1, booster.targetHits ?? 4);
    const interval = Math.max(0.001, booster.duration / targetHits);
    const slot = Math.round((now - booster.time) / interval);
    const slotTime = booster.time + slot * interval;
    const tolerance = Math.min(DIFFICULTIES[this.difficulty].goodMs / 1000, interval * 0.42);
    if (slot < 0 || slot >= targetHits || Math.abs(now - slotTime) > tolerance || booster.boosterHitSlots.includes(slot) || booster.boosterWrongSlots?.includes(slot)) {
      return { label: "ひかる おとに あわせよう", noteType: "booster", energyDelta: -1 };
    }
    booster.boosterHitSlots.push(slot);
    booster.tapCount = booster.boosterHitSlots.length;
    const deltaMs = (now - slotTime) * 1000;
    return { judgement: judgeTiming(deltaMs, this.difficulty), deltaMs, label: "ビート " + booster.tapCount + "/" + targetHits + "！", noteType: "booster", energyDelta: 1,
      performance: { noteId: booster.id, phase: "strike", slot } };
  }

  private releaseBeam(now: number): HitFeedback | null {
    const beam = this.chart.holdingBeam();
    if (!beam) return null;
    const end = beam.time + beam.duration;
    const deltaMs = (now - end) * 1000;
    const releaseJudgement = judgeTiming(deltaMs, this.difficulty);
    const startJudgement = beam.beamStartJudgement ?? "miss";
    const judgement = worseJudgement(startJudgement, releaseJudgement);
    const result = this.finish(beam, judgement, deltaMs);
    if (judgement !== "miss") this.stats.beamSuccess += 1;
    return { ...result, label: judgement === "miss" ? "おわりまで のばしてみよう" : "ながい おとを キープ！",
      performance: { noteId: beam.id, phase: "release", slot: 1 } };
  }

  private finish(note: RuntimeNote, judgement: Judgement, deltaMs: number): HitFeedback {
    const resolved = this.chart.resolve(note, judgement, deltaMs);
    if (resolved) {
      this.stats.counts[judgement] += 1;
      if (judgement === "miss") {
        this.stats.combo = 0;
      } else {
        this.stats.combo += 1;
        this.stats.maxCombo = Math.max(this.stats.maxCombo, this.stats.combo);
        if (note.type !== "quiet" && note.type !== "booster") this.stats.offsets.push(deltaMs);
      }
      const comboBonus = judgement === "miss" ? 0 : Math.min(300, this.stats.combo * 6);
      const multiplier = this.scoreMultiplier;
      this.stats.flowPeak = Math.max(this.stats.flowPeak, this.flowMultiplier);
      this.stats.score += Math.round((judgementScore(judgement) + comboBonus) * multiplier);
    }
    return {
      judgement,
      label: judgementLabel(judgement),
      noteType: note.type,
      deltaMs,
      energyDelta: judgement === "perfect" ? 8 : judgement === "great" ? 5 : judgement === "good" ? 2 : -7,
    };
  }

  isComplete(playhead: number): boolean {
    return this.forcedComplete || playhead >= this.stage.duration;
  }

  forceComplete(): void {
    this.forcedComplete = true;
  }

  result(): SessionResult {
    const resolved = Object.values(this.stats.counts).reduce((sum, value) => sum + value, 0);
    const weighted = this.stats.counts.perfect + this.stats.counts.great * 0.82 + this.stats.counts.good * 0.55;
    const accuracy = resolved ? Math.round((weighted / resolved) * 100) : 0;
    const offsets = this.stats.offsets;
    const average = offsets.length ? offsets.reduce((sum, value) => sum + value, 0) / offsets.length : 0;
    const variance = offsets.length
      ? offsets.reduce((sum, value) => sum + (value - average) ** 2, 0) / offsets.length
      : 0;
    const stability = offsets.length ? Math.max(0, Math.round(100 - Math.sqrt(variance) * 0.55)) : 0;
    const early = offsets.filter((value) => value < -12).length;
    const late = offsets.filter((value) => value > 12).length;
    const base = Math.max(1, offsets.length);
    const message =
      accuracy >= 90
        ? "おなじ テンポで さいごまで できた！"
        : offsets.length === 0
          ? "さいごまで はしれた！ つぎは ひかりが ○に かさなったら おしてみよう"
          : stability >= 72
          ? "おなじ はやさで リズムを きざめた！"
          : average < -18
            ? "すこし はやく おすことが おおかったよ"
            : average > 18
              ? "おとを きいてから おすと もっと あいそう！"
              : "さいごに ちかづくほど うまく なった！";

    const baseResult = {
      ...this.stats,
      counts: { ...this.stats.counts },
      offsets: [...this.stats.offsets],
      accuracy,
      stability,
      earlyPercent: Math.round((early / base) * 100),
      latePercent: Math.round((late / base) * 100),
      message,
    } satisfies Omit<SessionResult, "missionStars" | "completedGoalIds">;
    const completed = completedGoalIds(getRunGoals(this.stage, this.difficulty), baseResult);
    return {
      ...baseResult,
      playMode: this.playMode,
      rhythmPoints: this.rhythmPoints,
      rhythmTrace: this.rhythmTrace.map(point => ({ ...point })),
      missionStars: completed.length,
      completedGoalIds: completed,
    };
  }
}

import type { HitFeedback } from "../types.ts";

export interface EffectsSnapshot {
  energy: number;
  pulse: number;
  speed: number;
  shake: number;
  overdrive: boolean;
  overdriveRemaining: number;
  driveProgress: number;
  driveReady: boolean;
}

const DRIVE_THRESHOLD = 80;

export class EffectsManager {
  private energy: number;
  private pulse = 0;
  private shake = 0;
  private overdriveRemaining = 0;
  private readonly overdriveDuration: number;

  constructor(private readonly trainId = "sunrise") {
    this.energy = trainId === "sunrise" ? 44 : 32;
    this.overdriveDuration = trainId === "starlight" ? 10 : 8;
  }

  apply(feedback: HitFeedback): void {
    let delta = feedback.energyDelta;
    if (this.trainId === "forest-line" && delta < 0) delta = Math.ceil(delta * 0.5);
    if (
      this.trainId === "percussion-car"
      && delta > 0
      && (feedback.noteType === "booster" || feedback.noteType === "beam")
    ) {
      delta += 2;
    }
    if (this.overdriveRemaining > 0 && delta > 0) delta = Math.max(1, Math.round(delta * 0.6));
    this.energy = Math.max(8, Math.min(100, this.energy + delta));
    this.pulse = feedback.judgement === "perfect" ? 1 : feedback.judgement === "great" ? .7 : feedback.judgement === "good" ? .26 : 0;
    this.shake = feedback.judgement === "miss" ? 1 : 0;
  }

  activateDrive(): boolean {
    if (this.energy < DRIVE_THRESHOLD || this.overdriveRemaining > 0) return false;
    this.energy = 12;
    this.overdriveRemaining = this.overdriveDuration;
    this.pulse = 1;
    this.shake = 0;
    return true;
  }

  tick(deltaSeconds: number): EffectsSnapshot {
    this.pulse = Math.max(0, this.pulse - deltaSeconds * 2.4);
    this.shake = Math.max(0, this.shake - deltaSeconds * 4.5);
    this.overdriveRemaining = Math.max(0, this.overdriveRemaining - Math.max(0, deltaSeconds));
    return this.snapshot();
  }

  snapshot(): EffectsSnapshot {
    const overdrive = this.overdriveRemaining > 0;
    return {
      energy: this.energy,
      pulse: this.pulse,
      shake: this.shake,
      speed: (0.72 + this.energy / 120) * (overdrive ? 1.34 : 1),
      overdrive,
      overdriveRemaining: this.overdriveRemaining,
      driveProgress: overdrive ? this.overdriveRemaining / this.overdriveDuration : this.energy / DRIVE_THRESHOLD,
      driveReady: !overdrive && this.energy >= DRIVE_THRESHOLD,
    };
  }
}

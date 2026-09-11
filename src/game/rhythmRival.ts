import type { Difficulty, PlayMode, ProgressData, RhythmBest, RhythmTracePoint, StageTheme } from "./types.ts";

export const rhythmRecordKey = (stage: StageTheme, difficulty: Difficulty, mode: PlayMode) => `${stage}/${difficulty}/${mode}`;

export function validRhythmBest(value: unknown): RhythmBest | undefined {
  if (!value || typeof value !== "object") return;
  const best = value as RhythmBest;
  if (!Number.isFinite(best.points) || best.points < 0 || best.points > 100_000 || !Array.isArray(best.trace) || best.trace.length > 1000) return;
  let lastTime = -1, lastPoints = 0;
  for (const point of best.trace) {
    if (!Number.isFinite(point.time) || point.time < 0 || point.time < lastTime || point.time > 120 || !Number.isFinite(point.points)
      || point.points < lastPoints || point.points > best.points) return;
    lastTime = point.time; lastPoints = point.points;
  }
  if (lastPoints !== best.points) return;
  return best;
}

export function personalBest(progress: ProgressData, stage: StageTheme, difficulty: Difficulty, mode: PlayMode): RhythmBest | undefined {
  return validRhythmBest(progress.rhythmBests?.[rhythmRecordKey(stage, difficulty, mode)]);
}

export function rivalPointsAt(trace: readonly RhythmTracePoint[], time: number): number {
  let points = 0;
  for (const point of trace) { if (point.time > time) break; points = point.points; }
  return points;
}

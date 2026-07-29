import type { ChartNote } from "./types.ts";

export const SUBDIVISIONS_PER_BEAT = 4;

export function subdivisionSeconds(bpm: number): number {
  if (!Number.isFinite(bpm) || bpm <= 0) return 0;
  return 60 / bpm / SUBDIVISIONS_PER_BEAT;
}

export function rhythmPulseAt(playhead: number, bpm: number): number {
  const eighthSeconds = 60 / bpm / 2;
  if (!Number.isFinite(playhead) || !Number.isFinite(eighthSeconds) || eighthSeconds <= 0) return 0;
  const rawStep = playhead / eighthSeconds;
  const nearestStep = Math.round(rawStep);
  const distance = Math.abs(rawStep - nearestStep);
  const shape = Math.max(0, 1 - distance / 0.44) ** 3;
  const isMainBeat = Math.abs(nearestStep) % 2 === 0;
  return shape * (isMainBeat ? 1 : 0.58);
}

export function cueTimesForNote(note: ChartNote): number[] {
  if (note.type === "quiet") return [];
  if (note.type === "beam") return [note.time, note.time + note.duration];
  if (note.type !== "booster") return [note.time];

  const targetHits = Math.max(1, note.targetHits ?? 4);
  const interval = note.duration / targetHits;
  return Array.from({ length: targetHits }, (_, index) => note.time + interval * index);
}

export function cueSubdivisionsForChart(notes: ChartNote[], bpm: number): Set<number> {
  const seconds = subdivisionSeconds(bpm);
  if (seconds <= 0) return new Set<number>();
  return new Set(
    notes.flatMap(cueTimesForNote).map((time) => Math.round(time / seconds)),
  );
}

export function rhythmGridErrorMs(time: number, bpm: number): number {
  const seconds = subdivisionSeconds(bpm);
  if (seconds <= 0 || !Number.isFinite(time)) return Number.POSITIVE_INFINITY;
  return Math.abs(time - Math.round(time / seconds) * seconds) * 1000;
}

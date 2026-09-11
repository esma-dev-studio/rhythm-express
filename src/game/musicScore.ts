import type { Difficulty, PerformanceGesture, StageDefinition, StageTheme } from "./types.ts";

export const CHORD_PROGRESSIONS: Record<StageTheme, readonly number[]> = {
  city: [0, 3, 4, 3], jungle: [0, 2, 1, 4], moon: [0, 3, 1, 4],
};
const MOTIFS: Record<StageTheme, readonly number[]> = {
  city: [0, 2, 4, 2, 2, 4, 1, 0],
  jungle: [0, 4, 2, 0, 4, 2, 1, 2],
  moon: [0, 2, 4, 6, 4, 2, 1, 0],
};

export function scaleFrequency(scale: number[], degree: number, octaveShift = 0): number {
  if (scale.length === 0) return 440;
  const hasOctaveEndpoint = scale.length > 1 && scale[0] > 0
    && Math.abs(scale[scale.length - 1] / scale[0] - 2) < 0.015;
  const period = hasOctaveEndpoint ? scale.length - 1 : scale.length;
  return scale[((degree % period) + period) % period] * 2 ** (Math.floor(degree / period) + octaveShift);
}

export interface PerformanceNote extends PerformanceGesture {
  key: string;
  time: number;
  duration: number;
  frequency: number;
}

export const performanceKey = (gesture: PerformanceGesture): string =>
  `${gesture.noteId}:${gesture.phase}:${gesture.slot}`;

// The backing cue and live instrument share one score, including every roll
// slot and the release of a long note. Pitch belongs to the song, not accuracy.
export function createPerformanceScore(stage: StageDefinition, difficulty: Difficulty): PerformanceNote[] {
  const beat = 60 / stage.bpm;
  return stage.notes[difficulty].flatMap(note => {
    if (note.type === "quiet") return [];
    const count = note.type === "booster" ? Math.max(1, note.targetHits ?? 4) : note.type === "beam" ? 2 : 1;
    return Array.from({ length: count }, (_, slot): PerformanceNote => {
      const phase = note.type === "beam" ? slot === 0 ? "hold" : "release" : "strike";
      const rawTime = note.time + (note.type === "beam" ? slot * note.duration : note.type === "booster" ? slot * note.duration / count : 0);
      const subdivision = Math.round(rawTime / (beat / 4));
      const bar = Math.floor(subdivision / 16);
      const step = subdivision % 16;
      const roots = CHORD_PROGRESSIONS[stage.theme];
      const degree = roots[bar % roots.length] + MOTIFS[stage.theme][Math.floor(step / 2)];
      const gesture: PerformanceGesture = { noteId: note.id, phase, slot };
      return {
        ...gesture, key: performanceKey(gesture), time: rawTime,
        duration: phase === "hold" ? note.duration : beat * (note.type === "booster" ? .36 : .7),
        frequency: scaleFrequency(stage.musicScale, degree),
      };
    });
  }).sort((a, b) => a.time - b.time);
}

export function musicLevelForCombo(combo: number): number {
  return combo >= 18 ? 2 : combo >= 8 ? 1 : 0;
}

export function beatPosition(playhead: number, bpm: number): { index: number; pulse: number } {
  const raw = playhead * bpm / 60;
  const whole = Math.floor(raw);
  return { index: ((whole % 4) + 4) % 4, pulse: Math.max(0, 1 - (raw - whole) / .42) ** 2 };
}

export function actionPulseAt(playhead: number, cueTime: number | null): number {
  if (cueTime === null) return 0;
  return Math.max(0, 1 - Math.abs(playhead - cueTime) / .12) ** 2;
}

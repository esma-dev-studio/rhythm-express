import type { RuntimeNote } from "./types.ts";

export interface RhythmCue {
  time: number | null;
  mode: "press" | "hold" | "release" | "repeat" | "rest" | "switch" | "listen";
  label: string;
  action: string;
}

export function getRhythmCue(notes: readonly RuntimeNote[], playhead: number): RhythmCue {
  const held = notes.find(n => n.state === "holding" && n.type === "beam");
  if (held) return { time: held.time + held.duration, mode: "release", label: "おわりで はなす", action: "おしたまま" };
  const quiet = notes.find(n => n.type === "quiet" && playhead >= n.time && playhead < n.time + n.duration);
  if (quiet) return { time: quiet.time + quiet.duration, mode: "rest", label: "いまは おやすみ", action: "おさない" };
  const booster = notes.find(n => n.type === "booster" && playhead >= n.time && playhead < n.time + n.duration);
  if (booster) {
    const count = Math.max(1, booster.targetHits ?? 4);
    const interval = booster.duration / count;
    const slot = Array.from({ length: count }, (_, i) => i).find(i => !booster.boosterHitSlots.includes(i) && booster.time + i * interval >= playhead - interval * .2);
    return { time: slot === undefined ? null : booster.time + slot * interval, mode: "repeat", label: "ひとつずつ おす", action: "トン トン！" };
  }
  const next = notes.filter(n => n.state === "pending" && n.time >= playhead - .24).reduce<RuntimeNote | undefined>((a, b) => !a || b.time < a.time ? b : a, undefined);
  if (!next) return { time: null, mode: "listen", label: "おとを きこう", action: "おす！" };
  if (next.type === "quiet") return { time: next.time, mode: "rest", label: "しましまは おやすみ", action: "おす！" };
  if (next.type === "beam") return { time: next.time, mode: "hold", label: "ながい ひかりは ながおし", action: "ながおし" };
  if (next.type === "switch") return { time: next.time, mode: "switch", label: next.direction === "left" ? "← を おす" : "→ を おす", action: "やじるし" };
  if (next.type === "booster") return { time: next.time, mode: "repeat", label: "ひとつずつ おす", action: "トン トン！" };
  return { time: next.time, mode: "press", label: "○に きたら おす", action: "おす！" };
}

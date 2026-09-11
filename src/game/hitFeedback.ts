import type { GameAction, HitFeedback, Judgement } from "./types.ts";

export type HitVisualKind = Judgement | "empty";
export const HIT_LOOKS: Record<HitVisualKind, { color: string; symbol: string; title: string }> = {
  perfect: { color: "#ffe08b", symbol: "★", title: "ぴったり！" },
  great: { color: "#99edff", symbol: "○", title: "いいね！" },
  good: { color: "#ffbd83", symbol: "△", title: "おしい！" },
  miss: { color: "#ffa8b2", symbol: "×", title: "ミス" },
  empty: { color: "#bdd0dc", symbol: "・", title: "まだだよ" },
};
export const HIT_VISUAL_SECONDS = .7;
export const MAX_HIT_VISUALS = 6;

export interface HitVisual {
  id: number;
  time: number;
  kind: HitVisualKind;
  title: string;
  hint: string;
  combo: number;
  action?: GameAction;
}

function hintFor(feedback: HitFeedback, kind: HitVisualKind): string {
  if (feedback.noteType === "quiet") return "ここは おさずに まとう";
  if (feedback.performance?.phase === "hold") return "そのまま のばそう";
  if (feedback.performance?.phase === "release") {
    if (kind !== "miss") return "おわりも あわせたね！";
    return (feedback.deltaMs ?? 0) < 0 ? "おわりまで のばそう" : "おわりの ○で はなそう";
  }
  if (kind === "empty") return feedback.noteType === "beam" ? "おしたままで だいじょうぶ" : "ひかりが ○に くるまで まとう";
  if (kind === "miss") return feedback.noteType === "switch" && feedback.label.includes("はんたい") ? "やじるしを みよう" : "つぎの ○を ねらおう";
  if (kind === "good") return (feedback.deltaMs ?? 0) < 0 ? "はやかった！ すこし まとう" : "おそかった！ すこし はやく";
  return kind === "perfect" ? "その リズム！" : "リズムに のれてる！";
}

// Receipt identity changes on every input, even two identical judgements.
// The short bounded trail uses the song clock, so pausing freezes the effects.
export class HitFeedbackTimeline {
  private nextId = 1;
  private events: HitVisual[] = [];

  record(feedback: HitFeedback | null, time: number, combo: number, action?: GameAction): HitVisual | null {
    if (!feedback || !Number.isFinite(time) || time < 0) return null;
    if (!action && feedback.judgement !== "miss") return null;
    const kind: HitVisualKind = feedback.noteType === "quiet" && action
      ? "miss" : feedback.judgement ?? "empty";
    const visual: HitVisual = {
      id: this.nextId++, time, kind, action,
      title: feedback.noteType === "quiet" ? "おやすみ！" : kind === "empty" && feedback.noteType === "beam" ? "のばそう" : HIT_LOOKS[kind].title,
      hint: hintFor(feedback, kind),
      combo: kind === "perfect" || kind === "great" || kind === "good" ? combo : 0,
    };
    this.events = [...this.active(time), visual].slice(-MAX_HIT_VISUALS);
    return visual;
  }

  active(time: number): readonly HitVisual[] {
    return this.events.filter(event => time >= event.time && time - event.time <= HIT_VISUAL_SECONDS);
  }
}

export function hitVisualProgress(event: HitVisual, time: number, reducedMotion: boolean): { fade: number; spread: number } {
  const age = Math.max(0, time - event.time);
  return {
    fade: Math.max(0, Math.min(1, (HIT_VISUAL_SECONDS - age) / .24)),
    spread: reducedMotion ? 0 : 1 - (1 - Math.min(1, age / .48)) ** 3,
  };
}

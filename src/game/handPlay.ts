import type { ChartNote, Direction, GameAction, GameSettings } from "./types.ts";

export const HAND_COLORS = { left: "#83dbff", right: "#ffa4bd" } as const;
export const playModeFor = (settings: GameSettings) => settings.playMode === "one" ? "one" : "duet";
export const oppositeHand = (hand: Direction): Direction => hand === "left" ? "right" : "left";
export const handForAction = (action: GameAction): Direction | undefined => action === "pad-left" ? "left" : action === "pad-right" ? "right" : undefined;
export const handAtSlot = (note: ChartNote, slot = 0): Direction | undefined =>
  note.hand && note.type === "booster" && slot % 2 ? oppositeHand(note.hand) : note.hand;

// Count playable strikes, not note objects: each roll alternates, a release
// stays on the holding hand, and rests do not advance the hand pattern.
export function assignHands(notes: readonly ChartNote[]): ChartNote[] {
  let next: Direction = "left";
  return notes.map(note => {
    if (note.type === "quiet") return { ...note };
    const hand = note.type === "switch" ? note.direction ?? next : next;
    const strikes = note.type === "booster" ? Math.max(1, note.targetHits ?? 4) : 1;
    next = strikes % 2 ? oppositeHand(hand) : hand;
    return { ...note, hand };
  });
}

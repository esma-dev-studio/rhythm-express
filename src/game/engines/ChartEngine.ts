import type { ChartNote, Difficulty, Judgement, NoteType, RuntimeNote } from "../types.ts";
import { DIFFICULTIES } from "./JudgementEngine.ts";

export class ChartEngine {
  private notes: RuntimeNote[];

  constructor(notes: ChartNote[]) {
    this.notes = notes.map((note) => ({
      ...note,
      state: "pending",
      quietBroken: false,
      tapCount: 0,
      boosterHitSlots: [],
    }));
  }

  reset(notes: ChartNote[]): void {
    this.notes = notes.map((note) => ({
      ...note,
      state: "pending",
      quietBroken: false,
      tapCount: 0,
      boosterHitSlots: [],
    }));
  }

  all(): RuntimeNote[] {
    return this.notes;
  }

  visible(playhead: number, travelTime: number): RuntimeNote[] {
    return this.notes.filter((note) => {
      const end = note.time + note.duration;
      return note.state !== "resolved" && end >= playhead - 0.35 && note.time <= playhead + travelTime + 0.25;
    });
  }

  active(type: NoteType, playhead: number): RuntimeNote | undefined {
    return this.notes.find(
      (note) => note.type === type && note.state !== "resolved" && playhead >= note.time && playhead < note.time + note.duration,
    );
  }

  holdingBeam(): RuntimeNote | undefined {
    return this.notes.find((note) => note.type === "beam" && note.state === "holding");
  }

  nearest(
    types: NoteType[],
    playhead: number,
    difficulty: Difficulty,
    predicate?: (note: RuntimeNote) => boolean,
  ): RuntimeNote | undefined {
    const windowSeconds = DIFFICULTIES[difficulty].goodMs / 1000;
    let best: RuntimeNote | undefined;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const note of this.notes) {
      if (note.state !== "pending" || !types.includes(note.type) || (predicate && !predicate(note))) continue;
      const distance = Math.abs(note.time - playhead);
      if (distance <= windowSeconds && distance < bestDistance) {
        best = note;
        bestDistance = distance;
      }
    }
    return best;
  }

  resolve(note: RuntimeNote, judgement: Judgement, deltaMs = 0): boolean {
    if (note.state === "resolved") return false;
    note.state = "resolved";
    note.judgement = judgement;
    note.deltaMs = deltaMs;
    return true;
  }
}
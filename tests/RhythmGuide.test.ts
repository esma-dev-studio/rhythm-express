import assert from "node:assert/strict";
import test from "node:test";
import { STAGES } from "../src/game/data/stages.ts";
import type { Difficulty } from "../src/game/types.ts";
import {
  cueTimesForNote,
  rhythmGridErrorMs,
  rhythmPulseAt,
} from "../src/game/rhythmGuide.ts";

test("rhythm pulse peaks on the audible beat and keeps a softer eighth-note cue", () => {
  assert.equal(rhythmPulseAt(1, 120), 1);
  assert.equal(rhythmPulseAt(1.25, 120), 0.58);
  assert.equal(rhythmPulseAt(1.125, 120), 0);
  assert.equal(rhythmPulseAt(Number.NaN, 120), 0);
});

test("every actionable cue stays on the sixteenth-note music grid", () => {
  const difficulties: Difficulty[] = ["easy", "normal", "challenge"];
  let largestErrorMs = 0;

  for (const stage of STAGES) {
    for (const difficulty of difficulties) {
      for (const note of stage.notes[difficulty]) {
        for (const cueTime of cueTimesForNote(note)) {
          const errorMs = rhythmGridErrorMs(cueTime, stage.bpm);
          largestErrorMs = Math.max(largestErrorMs, errorMs);
          assert.ok(
            errorMs <= 0.1,
            `${stage.id}/${difficulty}/${note.id} is ${errorMs.toFixed(4)}ms off grid`,
          );
        }
      }
    }
  }

  assert.ok(largestErrorMs > 0);
});

test("booster markers use learnable quarter or eighth-note spacing", () => {
  const jungle = STAGES.find((stage) => stage.id === "jungle");
  assert.ok(jungle);
  assert.equal(jungle.notes.easy.find((note) => note.type === "booster")?.targetHits, 4);
  assert.equal(jungle.notes.challenge.find((note) => note.type === "booster")?.targetHits, 8);
});

import assert from "node:assert/strict";
import test from "node:test";
import { STAGES } from "../src/game/data/stages.ts";
import type { Difficulty, NoteType } from "../src/game/types.ts";

const difficulties: Difficulty[] = ["easy", "normal", "challenge"];

test("all three stages have valid sorted charts for every difficulty", () => {
  assert.equal(STAGES.length, 3);
  for (const stage of STAGES) {
    for (const difficulty of difficulties) {
      const notes = stage.notes[difficulty];
      assert.ok(notes.length > 10);
      assert.equal(new Set(notes.map((note) => note.id)).size, notes.length);
      for (let index = 0; index < notes.length; index += 1) {
        assert.ok(notes[index].time >= 0);
        assert.ok(notes[index].time + notes[index].duration < stage.duration);
        if (index > 0) assert.ok(notes[index].time >= notes[index - 1].time);
      }
    }
  }
});

test("the moon challenge chart uses every note type", () => {
  const moon = STAGES.find((stage) => stage.id === "moon");
  assert.ok(moon);
  const types = new Set<NoteType>(moon.notes.challenge.map((note) => note.type));
  for (const expected of ["spark", "beam", "switch", "booster", "quiet"] as NoteType[]) {
    assert.equal(types.has(expected), true);
  }
});
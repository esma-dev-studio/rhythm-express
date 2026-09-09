import assert from "node:assert/strict";
import test from "node:test";
import { noteScreenX, rhythmGeometry } from "../src/game/presentation.ts";
import { getRhythmCue } from "../src/game/rhythmCue.ts";
import { ENCOUNTER_TARGET, getAdventureEncounters, isEncounterRhythmHit } from "../src/game/adventureEvents.ts";
import { STAGES } from "../src/game/data/stages.ts";
import { GameSession } from "../src/game/engines/GameSession.ts";
import type { RuntimeNote } from "../src/game/types.ts";

function note(extra: Partial<RuntimeNote>): RuntimeNote {
  return { id: "n", type: "spark", time: 5, duration: 0, lane: 0, visualVariant: 0,
    state: "pending", quietBroken: false, tapCount: 0, boosterHitSlots: [], ...extra };
}
test("a note reaches the fixed target at its judged time at all supported sizes", () => {
  for (const [width, height] of [[320, 540], [768, 700], [1024, 510], [1366, 760]]) {
    const g = rhythmGeometry(width, height);
    assert.ok(g.targetX - g.radius > 12);
    assert.ok(g.targetY - g.radius > g.laneTop);
    for (const travel of [3.25, 3.8, 4.4]) {
      assert.equal(noteScreenX(8, 8, width, g.targetX, travel), g.targetX);
      const positions = [6, 6.5, 7, 7.5, 8].map(time => noteScreenX(8, time, width, g.targetX, travel));
      const step = positions[0] - positions[1];
      for (let i = 1; i < positions.length - 1; i++) assert.ok(Math.abs(positions[i] - positions[i + 1] - step) < 1e-8);
    }
  }
});
test("hold and quiet instructions follow the complete duration and change at its boundary", () => {
  const held = note({ type: "beam", state: "holding", duration: 2 });
  assert.equal(getRhythmCue([held, note({ time: 6 })], 6).time, 7);
  assert.equal(getRhythmCue([held], 6).mode, "release");
  const quiet = note({ type: "quiet", duration: 2 });
  assert.equal(getRhythmCue([quiet], 5).action, "おさない");
  assert.equal(getRhythmCue([quiet], 6.99).action, "おさない");
  assert.equal(getRhythmCue([quiet], 7).mode, "listen");
});
test("rapid arbitrary taps cannot complete a rhythm encounter", () => {
  const stage = STAGES[0], session = new GameSession(stage, "easy");
  session.start(100, 0);
  assert.equal(isEncounterRhythmHit(null), false);
  assert.equal(isEncounterRhythmHit({ label: "hint", energyDelta: 0 }), false);
  const spark = stage.notes.easy.find(n => n.type === "spark")!;
  const first = session.input("tap", true, 100 + spark.time);
  assert.equal(isEncounterRhythmHit(first), true);
  assert.equal(isEncounterRhythmHit(session.input("tap", true, 100 + spark.time)), false);
  assert.equal(isEncounterRhythmHit({ noteType: "spark", judgement: "miss", deltaMs: 300, label: "miss", energyDelta: -7 }), false);
});
test("every encounter has enough actual rhythm actions in every route and difficulty", () => {
  for (const stage of STAGES) for (const difficulty of ["easy", "normal", "challenge"] as const) {
    for (const encounter of getAdventureEncounters(stage)) {
      const times = stage.notes[difficulty].flatMap(n => {
        if (n.type === "quiet") return [];
        if (n.type === "beam") return [n.time, n.time + n.duration];
        if (n.type === "booster") return Array.from({ length: n.targetHits ?? 4 }, (_, i) => n.time + i * n.duration / (n.targetHits ?? 4));
        return [n.time];
      });
      const available = times.filter(t => t >= encounter.startTime && t < encounter.startTime + encounter.duration);
      assert.ok(available.length >= ENCOUNTER_TARGET, `${stage.id}/${difficulty}/${encounter.id}: ${available.length}`);
    }
  }
});

test("each accepted booster slot contributes once to the encounter", () => {
  const stage = STAGES[1], session = new GameSession(stage, "easy");
  session.start(100, 0);
  const booster = stage.notes.easy.find(n => n.type === "booster")!;
  for (let i = 0; i < (booster.targetHits ?? 4); i++) {
    const time = 100 + booster.time + i * booster.duration / (booster.targetHits ?? 4) + .001;
    assert.equal(isEncounterRhythmHit(session.input("tap", true, time)), true);
    assert.equal(isEncounterRhythmHit(session.input("tap", true, time)), false);
  }
});

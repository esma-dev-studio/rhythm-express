import assert from "node:assert/strict";
import test from "node:test";
import {
  getActiveAdventureEncounter,
  getAdventureEncounters,
} from "../src/game/adventureEvents.ts";

test("every route has three ordered live adventure encounters", () => {
  for (const id of ["city", "jungle", "moon"] as const) {
    const encounters = getAdventureEncounters({ id, duration: 60 });
    assert.equal(encounters.length, 3);
    assert.ok(encounters[0].startTime < encounters[1].startTime);
    assert.ok(encounters[1].startTime < encounters[2].startTime);
    assert.ok(encounters.every((encounter) => encounter.startTime + encounter.duration < 60));
  }
});

test("an encounter is active only inside its short play window", () => {
  const encounter = getAdventureEncounters({ id: "city", duration: 60 })[0];
  assert.equal(getActiveAdventureEncounter([encounter], encounter.startTime - 0.01, new Set()), null);
  assert.equal(getActiveAdventureEncounter([encounter], encounter.startTime, new Set())?.id, encounter.id);
  assert.equal(
    getActiveAdventureEncounter([encounter], encounter.startTime + encounter.duration, new Set()),
    null,
  );
});

test("completed encounters cannot appear again and rewards are predictable", () => {
  const encounter = getAdventureEncounters({ id: "moon", duration: 90 })[1];
  const seen = new Set([encounter.id]);
  assert.equal(getActiveAdventureEncounter([encounter], encounter.startTime + 1, seen), null);
  assert.equal(encounter.scoreBonus, 750);
  assert.equal(encounter.energyBonus, 18);
});

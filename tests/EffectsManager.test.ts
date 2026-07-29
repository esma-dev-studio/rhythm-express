import assert from "node:assert/strict";
import test from "node:test";
import { EffectsManager } from "../src/game/engines/EffectsManager.ts";
import type { HitFeedback } from "../src/game/types.ts";

const perfect: HitFeedback = {
  judgement: "perfect",
  label: "PERFECT",
  noteType: "spark",
  energyDelta: 8,
};

test("Sunrise starts closer to FLOW DRIVE and activates at full charge", () => {
  const effects = new EffectsManager("sunrise");
  assert.equal(effects.snapshot().energy, 44);
  assert.equal(effects.activateDrive(), false);
  for (let index = 0; index < 5; index += 1) effects.apply(perfect);
  assert.equal(effects.snapshot().driveReady, true);
  assert.equal(effects.activateDrive(), true);
  assert.equal(effects.snapshot().overdrive, true);
  assert.equal(effects.snapshot().energy, 12);
  effects.tick(8.1);
  assert.equal(effects.snapshot().overdrive, false);
});

test("Forest Line halves miss energy loss", () => {
  const regular = new EffectsManager("sunrise");
  const forest = new EffectsManager("forest-line");
  const miss: HitFeedback = {
    judgement: "miss",
    label: "MISS",
    noteType: "spark",
    energyDelta: -7,
  };
  regular.apply(miss);
  forest.apply(miss);
  assert.equal(regular.snapshot().energy, 37);
  assert.equal(forest.snapshot().energy, 29);
});

test("Starlight keeps FLOW DRIVE active for ten seconds", () => {
  const effects = new EffectsManager("starlight");
  for (let index = 0; index < 6; index += 1) effects.apply(perfect);
  assert.equal(effects.activateDrive(), true);
  effects.tick(8.2);
  assert.equal(effects.snapshot().overdrive, true);
  effects.tick(2);
  assert.equal(effects.snapshot().overdrive, false);
});

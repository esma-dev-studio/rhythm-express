import assert from "node:assert/strict";
import test from "node:test";
import { judgeTiming, worseJudgement } from "../src/game/engines/JudgementEngine.ts";

test("normal judgement windows include their boundary values", () => {
  assert.equal(judgeTiming(70, "normal"), "perfect");
  assert.equal(judgeTiming(-120, "normal"), "great");
  assert.equal(judgeTiming(180, "normal"), "good");
  assert.equal(judgeTiming(181, "normal"), "miss");
});

test("easy is wider and challenge is narrower", () => {
  assert.equal(judgeTiming(100, "easy"), "perfect");
  assert.equal(judgeTiming(100, "challenge"), "good");
  assert.equal(worseJudgement("perfect", "good"), "good");
});
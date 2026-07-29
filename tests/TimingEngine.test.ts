import assert from "node:assert/strict";
import test from "node:test";
import { TimingEngine } from "../src/game/engines/TimingEngine.ts";

test("render playhead stays on the audio clock while input receives the offset", () => {
  const timing = new TimingEngine();
  timing.start(10, 25);
  assert.equal(timing.getPlayhead(12), 2);
  assert.equal(timing.getInputPlayhead(12), 2.025);
});

test("pause and resume preserve chart position", () => {
  const timing = new TimingEngine();
  timing.start(5);
  timing.pause(8);
  assert.equal(timing.getPlayhead(20), 3);
  timing.resume(20);
  assert.equal(timing.getPlayhead(21.5), 4.5);
});
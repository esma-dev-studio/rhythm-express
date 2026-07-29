import assert from "node:assert/strict";
import test from "node:test";
import { ChartEngine } from "../src/game/engines/ChartEngine.ts";
import type { ChartNote } from "../src/game/types.ts";

const note: ChartNote = {
  id: "spark-1",
  type: "spark",
  time: 1,
  duration: 0,
  lane: 0,
  visualVariant: 0,
};

test("a note can only be resolved once", () => {
  const chart = new ChartEngine([note]);
  const runtime = chart.all()[0];
  assert.equal(chart.resolve(runtime, "perfect", 0), true);
  assert.equal(chart.resolve(runtime, "great", 30), false);
  assert.equal(runtime.judgement, "perfect");
});

test("nearest ignores already resolved notes", () => {
  const chart = new ChartEngine([note]);
  const runtime = chart.all()[0];
  assert.equal(chart.nearest(["spark"], 1.05, "normal")?.id, "spark-1");
  chart.resolve(runtime, "perfect");
  assert.equal(chart.nearest(["spark"], 1.05, "normal"), undefined);
});
test("active duration uses a half-open interval", () => {
  const booster: ChartNote = {
    id: "boost",
    type: "booster",
    time: 1,
    duration: 1,
    targetHits: 4,
    lane: 0,
    visualVariant: 0,
  };
  const chart = new ChartEngine([booster]);
  assert.equal(chart.active("booster", 1.999)?.id, "boost");
  assert.equal(chart.active("booster", 2), undefined);
});

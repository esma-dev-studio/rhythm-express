import assert from "node:assert/strict";
import test from "node:test";
import { HIT_LOOKS, HitFeedbackTimeline, hitVisualProgress, MAX_HIT_VISUALS } from "../src/game/hitFeedback.ts";
import { drawHitBursts } from "../src/game/hitBurstRenderer.ts";
import { EffectsManager } from "../src/game/engines/EffectsManager.ts";
import type { HitFeedback, Judgement } from "../src/game/types.ts";

const hit = (judgement: Judgement, deltaMs = 0): HitFeedback => ({ judgement, deltaMs, noteType: "spark", energyDelta: judgement === "miss" ? -7 : 5, label: "test" });

test("all four judgements have different words, symbols and visual treatments", () => {
  const grades = ["perfect", "great", "good", "miss"] as const;
  assert.equal(new Set(grades.map(grade => HIT_LOOKS[grade].symbol)).size, 4);
  assert.equal(new Set(grades.map(grade => HIT_LOOKS[grade].title)).size, 4);
  const timeline = new HitFeedbackTimeline();
  for (const grade of grades) {
    const result = timeline.record(hit(grade), 2, 7, "tap")!;
    assert.equal(result.kind, grade);
    assert.equal(result.title, HIT_LOOKS[grade].title);
    assert.equal(result.combo, grade === "miss" ? 0 : 7);
  }
});

test("every repeated hit has its own receipt while the effect trail stays bounded", () => {
  const timeline = new HitFeedbackTimeline();
  const ids = Array.from({ length: 40 }, (_, i) => timeline.record(hit("perfect"), 2 + i * .01, i, "tap")!.id);
  assert.equal(new Set(ids).size, 40);
  assert.equal(timeline.active(2.4).length, MAX_HIT_VISUALS);
  assert.equal(timeline.active(4).length, 0);
});

test("empty taps and automatic bonuses do not turn into successful hit bursts", () => {
  const timeline = new HitFeedbackTimeline();
  const empty = timeline.record({ label: "wait", energyDelta: -1 }, 1, 0, "tap")!;
  assert.equal(empty.kind, "empty");
  assert.equal(timeline.record(hit("perfect"), 1, 8), null);
  assert.equal(timeline.record(null, 1, 8, "tap"), null);
  assert.equal(timeline.record(hit("perfect"), -1, 8, "tap"), null);
  assert.equal(timeline.record(hit("miss"), 1, 0)?.kind, "miss");
});

test("timing and hold hints explain what to change instead of only saying bad", () => {
  const timeline = new HitFeedbackTimeline();
  assert.match(timeline.record(hit("good", -190), 1, 1, "tap")!.hint, /はやかった/);
  assert.match(timeline.record(hit("good", 190), 1, 1, "tap")!.hint, /おそかった/);
  const hold = { ...hit("perfect"), noteType: "beam" as const, performance: { noteId: "beam", slot: 0, phase: "hold" as const } };
  assert.equal(timeline.record(hold, 1, 1, "tap")!.hint, "そのまま のばそう");
  const release = { ...hold, judgement: "miss" as const, deltaMs: -400, performance: { ...hold.performance, slot: 1, phase: "release" as const } };
  assert.equal(timeline.record(release, 1, 0, "tap")!.hint, "おわりまで のばそう");
  assert.equal(timeline.record({ noteType: "quiet", label: "rest", energyDelta: -3 }, 1, 0, "tap")!.title, "おやすみ！");
});

test("effect animation follows the paused song clock and reduced motion keeps the mark still", () => {
  const visual = new HitFeedbackTimeline().record(hit("perfect"), 4, 1, "tap")!;
  assert.deepEqual(hitVisualProgress(visual, 4.2, false), hitVisualProgress(visual, 4.2, false));
  assert.equal(hitVisualProgress(visual, 4.2, true).spread, 0);
  assert.equal(hitVisualProgress(visual, 4.4, true).spread, 0);
  assert.equal(hitVisualProgress(visual, 5, false).fade, 0);
});

test("canvas marks use distinct geometry even without color or animation", () => {
  const traces: string[] = [];
  for (const judgement of ["perfect", "great", "good", "miss"] as const) {
    const commands: string[] = [];
    const context = new Proxy({}, {
      get: (_target, key) => (...args: unknown[]) => commands.push(String(key) + ":" + JSON.stringify(args)),
      set: () => true,
    }) as CanvasRenderingContext2D;
    const visual = new HitFeedbackTimeline().record(hit(judgement), 4, 1, "tap")!;
    drawHitBursts(context, 100, 200, 30, [visual], 4.2, true, 1);
    traces.push(commands.join("|"));
    assert.equal(commands[0], "save:[]");
    assert.equal(commands[commands.length - 1], "restore:[]");
    if (judgement === "miss") assert.ok(!commands.some(command => command.startsWith("arc:")));
  }
  assert.equal(new Set(traces).size, 4);
});

test("misses and empty taps cannot flash the successful train trail", () => {
  const effects = new EffectsManager();
  effects.apply(hit("perfect")); const perfect = effects.snapshot().pulse;
  effects.apply(hit("great")); const great = effects.snapshot().pulse;
  effects.apply(hit("good")); const good = effects.snapshot().pulse;
  assert.ok(perfect > great && great > good);
  effects.apply(hit("miss")); assert.equal(effects.snapshot().pulse, 0);
  effects.apply({ label: "empty", energyDelta: -1 }); assert.equal(effects.snapshot().pulse, 0);
});

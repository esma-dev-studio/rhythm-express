import assert from "node:assert/strict";
import test from "node:test";
import { STAGES } from "../src/game/data/stages.ts";
import { GameSession } from "../src/game/engines/GameSession.ts";
import { assignHands, handAtSlot, oppositeHand, playModeFor } from "../src/game/handPlay.ts";
import { createPerformanceScore } from "../src/game/musicScore.ts";
import { personalBest, rivalPointsAt, validRhythmBest } from "../src/game/rhythmRival.ts";
import { defaultProgress, migrateSettings, ProgressRepository } from "../src/game/repository/ProgressRepository.ts";
import { getRhythmCue } from "../src/game/rhythmCue.ts";
import { HitFeedbackTimeline } from "../src/game/hitFeedback.ts";
import type { Direction, GameAction } from "../src/game/types.ts";

const pad = (hand: Direction): GameAction => hand === "left" ? "pad-left" : "pad-right";
const fresh = () => { const session = new GameSession(STAGES[0], "easy", "duet"); session.start(0, 0); return session; };

for (const stage of STAGES) for (const difficulty of ["easy", "normal", "challenge"] as const) {
  test(`duet plays every musical action with the correct hand: ${stage.id}/${difficulty}`, () => {
    const session = new GameSession(stage, difficulty, "duet"); session.start(0, 0);
    const score = createPerformanceScore(stage, difficulty);
    for (const note of score) {
      const chartNote = session.chart.all().find(n => n.id === note.noteId)!;
      const hand = handAtSlot(chartNote, note.slot)!;
      const result = session.input(pad(hand), note.phase !== "release", note.time);
      assert.equal(result?.judgement, "perfect", `${note.key}: ${result?.label}`);
      assert.equal(result?.performance?.hand, hand);
      session.update(note.time + .001);
    }
    assert.equal(session.rhythmPoints, score.length * 100);
    assert.ok(validRhythmBest({ points: session.rhythmPoints, trace: session.result().rhythmTrace }));
  });
}

test("strikes alternate across rests, while roll slots alternate within a phrase", () => {
  const notes = assignHands(STAGES[0].notes.easy);
  let next: Direction = "left";
  for (const note of notes) {
    if (note.type === "quiet") { assert.equal(note.hand, undefined); continue; }
    assert.equal(note.hand, next);
    const count = note.type === "booster" ? note.targetHits ?? 4 : 1;
    for (let slot = 0; slot < count; slot++) { assert.equal(handAtSlot(note, slot), next); next = oppositeHand(next); }
  }
  assert.ok(STAGES[0].notes.easy.every(note => note.hand === undefined), "source charts stay unchanged");
});

test("the other hand releasing cannot cut a held note or award a release", () => {
  const session = fresh(), beam = session.chart.all().find(n => n.type === "beam")!;
  const action = pad(beam.hand!), other = pad(oppositeHand(beam.hand!));
  assert.equal(session.input(action, true, beam.time)?.judgement, "perfect");
  assert.equal(session.input(other, false, beam.time + .2), null);
  assert.equal(beam.state, "holding");
  assert.equal(session.rhythmPoints, 100);
  assert.equal(session.input(action, false, beam.time + beam.duration)?.judgement, "perfect");
  assert.equal(session.rhythmPoints, 200);
});

test("wrong-hand strikes consume a note and explain the expected hand", () => {
  const session = fresh(), note = session.chart.all().find(n => n.type === "spark")!;
  const wrong = session.input(pad(oppositeHand(note.hand!)), true, note.time)!;
  assert.equal(wrong.judgement, "miss"); assert.equal(wrong.expectedHand, note.hand);
  assert.equal(session.input(pad(note.hand!), true, note.time)?.performance, undefined);
  assert.equal(session.rhythmPoints, 0);
  const visual = new HitFeedbackTimeline().record(wrong, note.time, 0, pad(oppositeHand(note.hand!)))!;
  assert.equal(visual.title, "はんたい！"); assert.ok(visual.hint.includes(note.hand === "left" ? "ひだり" : "みぎ"));
});

test("one roll slot cannot be retried with the other hand or farmed with two fingers", () => {
  const session = new GameSession(STAGES[1], "easy", "duet"); session.start(0, 0);
  const note = session.chart.all().find(n => n.type === "booster")!;
  const correct = pad(note.hand!), wrong = pad(oppositeHand(note.hand!));
  assert.equal(session.input(wrong, true, note.time)?.judgement, "miss");
  assert.equal(session.input(correct, true, note.time)?.performance, undefined);
  const nextTime = note.time + note.duration / note.targetHits!;
  assert.equal(getRhythmCue([note], note.time).hand, oppositeHand(note.hand!));
  assert.equal(session.input(wrong, true, nextTime)?.judgement, "perfect");
  assert.equal(session.input(wrong, true, nextTime)?.performance, undefined);
  assert.equal(session.rhythmPoints, 100);
});

test("pausing a held note preserves the hand and the remaining music time", () => {
  const session = fresh(), note = session.chart.all().find(n => n.type === "beam")!;
  session.input(pad(note.hand!), true, note.time);
  session.protectHeldBeam(note.time + .2); session.pause(note.time + .2); session.resume(note.time + 10.2);
  assert.equal(note.state, "holding");
  assert.equal(session.input(pad(oppositeHand(note.hand!)), false, note.time + 10.3), null);
  assert.equal(session.input(pad(note.hand!), false, note.time + note.duration + 10)?.judgement, "perfect");
});

test("duet is the tablet default and the legacy single pad remains available", () => {
  assert.equal(playModeFor(defaultProgress().settings), "duet");
  assert.equal(migrateSettings({ playMode: "one" }).playMode, "one");
  const legacy = new GameSession(STAGES[0], "easy"); legacy.start(0, 0);
  const note = legacy.chart.all().find(n => n.type === "spark")!;
  assert.equal(legacy.input("pad-left", true, note.time), null);
  assert.equal(legacy.input("tap", true, note.time)?.judgement, "perfect");
});

test("rhythm records ignore bonuses and separate modes and difficulties", () => {
  const session = fresh(), note = session.chart.all().find(n => n.type === "spark")!;
  session.activateDrive(); session.addBonusScore(100000);
  session.input(pad(note.hand!), true, note.time);
  assert.equal(session.rhythmPoints, 100);
  const repo = new ProgressRepository();
  const saved = repo.recordResult(defaultProgress(), "city", "easy", session.result()).progress;
  assert.equal(personalBest(saved, "city", "easy", "duet")?.points, 100);
  assert.equal(personalBest(saved, "city", "easy", "one"), undefined);
  assert.equal(personalBest(saved, "city", "normal", "duet"), undefined);
  const worse = repo.recordResult(saved, "city", "easy", fresh().result()).progress;
  assert.equal(personalBest(worse, "city", "easy", "duet")?.points, 100);
  assert.equal(rivalPointsAt(session.result().rhythmTrace!, note.time - .1), 0);
  assert.equal(rivalPointsAt(session.result().rhythmTrace!, note.time), 100);
});

test("malformed saved traces are rejected without breaking play", () => {
  for (const bad of [null, {}, { points: NaN, trace: [] }, { points: 100, trace: [{ time: -1, points: 100 }] }, { points: 100, trace: [{ time: 4, points: 100 }, { time: 2, points: 100 }] }, { points: 100, trace: [] }]) assert.equal(validRhythmBest(bad), undefined);
  assert.ok(validRhythmBest({ points: 0, trace: [] }));
});

import assert from "node:assert/strict";
import test from "node:test";
import { STAGES } from "../src/game/data/stages.ts";
import { actionPulseAt, beatPosition, createPerformanceScore, musicLevelForCombo, performanceKey } from "../src/game/musicScore.ts";
import { cueTimesForNote } from "../src/game/rhythmGuide.ts";
import { GameSession } from "../src/game/engines/GameSession.ts";

test("every visible action has exactly one musical cue on the same clock, on all nine charts", () => {
  for (const stage of STAGES) for (const difficulty of ["easy", "normal", "challenge"] as const) {
    const score = createPerformanceScore(stage, difficulty);
    const actions = stage.notes[difficulty].flatMap(cueTimesForNote).sort((a, b) => a - b);
    assert.equal(score.length, actions.length);
    assert.equal(new Set(score.map(note => note.key)).size, score.length);
    score.forEach((note, index) => {
      assert.ok(Math.abs(note.time - actions[index]) < .0002);
      assert.ok(note.frequency > 100 && note.frequency < 2200);
      assert.ok(note.duration > 0);
    });
    const session = new GameSession(stage, difficulty);
    session.start(0, 0);
    for (const note of score) {
      const chartNote = stage.notes[difficulty].find(n => n.id === note.noteId)!;
      const result = session.input(chartNote.type === "switch" ? chartNote.direction! : "tap", note.phase !== "release", note.time);
      assert.equal(result?.judgement, "perfect", `${stage.id}/${difficulty}/${note.key}: ${result?.label}`);
      assert.ok(result?.performance);
      assert.equal(performanceKey(result.performance), note.key);
      session.update(note.time + .001);
    }
  }
});

test("roll slots form a melodic phrase and held notes have distinct start and release", () => {
  const stage = STAGES[1];
  const score = createPerformanceScore(stage, "challenge");
  const roll = stage.notes.challenge.find(n => n.type === "booster")!;
  const phrase = score.filter(n => n.noteId === roll.id);
  assert.equal(phrase.length, roll.targetHits);
  assert.ok(new Set(phrase.map(n => n.frequency)).size >= 3);
  const beam = stage.notes.challenge.find(n => n.type === "beam")!;
  const held = score.filter(n => n.noteId === beam.id);
  assert.deepEqual(held.map(n => n.phase), ["hold", "release"]);
  assert.equal(held[0].duration, beam.duration);
});

test("misses, automatic bonuses and repeated roll fingers cannot impersonate a played note", () => {
  const session = new GameSession(STAGES[1], "easy");
  session.start(0, 0);
  assert.equal(session.input("tap", true, .1)?.performance, undefined);
  const roll = session.chart.all().find(n => n.type === "booster")!;
  assert.ok(session.input("tap", true, roll.time)?.performance);
  assert.equal(session.input("tap", true, roll.time)?.performance, undefined);
  assert.ok(session.update(roll.time + roll.duration).every(n => !n.performance));
});

test("the action flash is independent of the four beat metronome", () => {
  assert.equal(actionPulseAt(2, 2), 1);
  assert.equal(actionPulseAt(2.3, 2), 0);
  assert.equal(actionPulseAt(2, null), 0);
  assert.deepEqual([0, .5, 1, 1.5, 2].map(t => beatPosition(t, 120).index), [0, 1, 2, 3, 0]);
  assert.equal(beatPosition(1.5, 120).pulse, 1);
  assert.equal(beatPosition(1.75, 120).pulse, 0);
  assert.equal(beatPosition(-.5, 120).index, 3);
  assert.deepEqual([0, 7, 8, 17, 18].map(musicLevelForCombo), [0, 0, 1, 1, 2]);
});

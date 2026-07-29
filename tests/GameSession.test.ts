import assert from "node:assert/strict";
import test from "node:test";
import { GameSession } from "../src/game/engines/GameSession.ts";
import type { ChartNote, StageDefinition } from "../src/game/types.ts";

function stageWith(notes: ChartNote[]): StageDefinition {
  return {
    id: "city",
    order: 1,
    name: "Test",
    shortName: "T",
    destination: "Test Station",
    description: "Test stage",
    bpm: 100,
    duration: 5,
    theme: "city",
    colors: { sky: "#000", horizon: "#000", ground: "#000", accent: "#000", highlight: "#000" },
    musicScale: [440],
    notes: { easy: notes, normal: notes, challenge: notes },
    events: [],
    unlockName: "Test",
  };
}

test("spark input scores once even if the same action repeats", () => {
  const notes: ChartNote[] = [{ id: "s", type: "spark", time: 1, duration: 0, lane: 0, visualVariant: 0 }];
  const session = new GameSession(stageWith(notes), "normal");
  session.start(0, 0);
  assert.equal(session.input("tap", true, 1)?.judgement, "perfect");
  session.input("tap", true, 1);
  assert.equal(session.stats.counts.perfect, 1);
  assert.equal(session.stats.combo, 1);
});

test("beam judges both press and release", () => {
  const notes: ChartNote[] = [{ id: "b", type: "beam", time: 1, duration: 1, lane: 0, visualVariant: 0 }];
  const session = new GameSession(stageWith(notes), "normal");
  session.start(0, 0);
  assert.equal(session.input("tap", true, 1)?.judgement, "perfect");
  assert.equal(session.input("tap", false, 2)?.judgement, "perfect");
  assert.equal(session.stats.beamSuccess, 1);
});

test("quiet zone succeeds when no input occurs", () => {
  const notes: ChartNote[] = [{ id: "q", type: "quiet", time: 1, duration: 1, lane: 0, visualVariant: 0 }];
  const session = new GameSession(stageWith(notes), "normal");
  session.start(0, 0);
  const feedback = session.update(2.01);
  assert.equal(feedback[0]?.judgement, "perfect");
  assert.equal(session.stats.quietSuccess, 1);
});

test("late pending notes become misses without ending the run", () => {
  const notes: ChartNote[] = [{ id: "s", type: "spark", time: 1, duration: 0, lane: 0, visualVariant: 0 }];
  const session = new GameSession(stageWith(notes), "normal");
  session.start(0, 0);
  session.update(1.2);
  assert.equal(session.stats.counts.miss, 1);
  assert.equal(session.isComplete(2), false);
});
test("a run with no successful timing does not report perfect stability", () => {
  const notes: ChartNote[] = [{ id: "s", type: "spark", time: 1, duration: 0, lane: 0, visualVariant: 0 }];
  const session = new GameSession(stageWith(notes), "normal");
  session.start(0, 0);
  session.update(1.2);
  const result = session.result();
  assert.equal(result.stability, 0);
  assert.match(result.message, /ひかりが ○/);
});
test("booster accepts each rhythm slot only once", () => {
  const notes: ChartNote[] = [{
    id: "boost", type: "booster", time: 1, duration: 1, targetHits: 4, lane: 0, visualVariant: 0,
  }];
  const session = new GameSession(stageWith(notes), "normal");
  session.start(0, 0);
  session.input("tap", true, 1);
  session.input("tap", true, 1);
  session.input("tap", true, 1);
  assert.equal(session.chart.all()[0].boosterHitSlots.length, 1);
  assert.equal(session.update(2)[0]?.judgement, "miss");
});

test("rhythmic booster taps can earn perfect", () => {
  const notes: ChartNote[] = [{
    id: "boost", type: "booster", time: 1, duration: 1, targetHits: 4, lane: 0, visualVariant: 0,
  }];
  const session = new GameSession(stageWith(notes), "normal");
  session.start(0, 0);
  [1, 1.25, 1.5, 1.75].forEach((time) => session.input("tap", true, time));
  assert.equal(session.update(2)[0]?.judgement, "perfect");
  assert.equal(session.stats.boosterSuccess, 1);
});

test("booster end does not steal a spark on the boundary", () => {
  const notes: ChartNote[] = [
    { id: "boost", type: "booster", time: 1, duration: 1, targetHits: 4, lane: 0, visualVariant: 0 },
    { id: "spark", type: "spark", time: 2, duration: 0, lane: 0, visualVariant: 0 },
  ];
  const session = new GameSession(stageWith(notes), "normal");
  session.start(0, 0);
  [1, 1.25, 1.5, 1.75].forEach((time) => session.input("tap", true, time));
  assert.equal(session.input("tap", true, 2)?.noteType, "spark");
  session.update(2);
  assert.equal(session.stats.counts.perfect, 2);
});

test("switch changes route and a wrong direction is one immediate miss", () => {
  const note: ChartNote = {
    id: "switch", type: "switch", time: 1, duration: 0, direction: "left", lane: 0, visualVariant: 0,
  };
  const correct = new GameSession(stageWith([note]), "normal");
  correct.start(0, 0);
  assert.equal(correct.hasSwitch, true);
  assert.equal(correct.input("left", true, 1)?.judgement, "perfect");
  assert.equal(correct.routeLane, -1);

  const wrong = new GameSession(stageWith([note]), "normal");
  wrong.start(0, 0);
  assert.equal(wrong.input("right", true, 1)?.judgement, "miss");
  wrong.update(1.3);
  assert.equal(wrong.stats.counts.miss, 1);
});

test("direction input is ignored when a chart has no switch", () => {
  const notes: ChartNote[] = [{ id: "s", type: "spark", time: 1, duration: 0, lane: 0, visualVariant: 0 }];
  const session = new GameSession(stageWith(notes), "normal");
  session.start(0, 0);
  assert.equal(session.hasSwitch, false);
  assert.equal(session.input("left", true, 1), null);
  assert.equal(session.stats.counts.miss, 0);
});

test("pausing a held beam preserves it without awarding score", () => {
  const notes: ChartNote[] = [{ id: "b", type: "beam", time: 1, duration: 1, lane: 0, visualVariant: 0 }];
  const session = new GameSession(stageWith(notes), "normal");
  session.start(0, 0);
  session.input("tap", true, 1);

  const guidance = session.protectHeldBeam();
  assert.equal(guidance?.judgement, undefined);
  assert.equal(guidance?.noteType, "beam");
  assert.equal(session.chart.holdingBeam()?.state, "holding");
  assert.equal(session.stats.score, 0);
  assert.equal(session.stats.counts.perfect, 0);
  assert.equal(session.stats.beamSuccess, 0);

  session.pause(1.25);
  session.resume(10);
  const regrab = session.input("tap", true, 10.25);
  assert.equal(regrab?.judgement, undefined);
  assert.equal(session.chart.holdingBeam()?.state, "holding");
  assert.equal(session.input("tap", false, 10.75)?.judgement, "perfect");
  assert.equal(session.stats.counts.miss, 0);
  assert.equal(session.stats.beamSuccess, 1);
  assert.equal(session.stats.counts.perfect, 1);
});

test("FLOW multiplier climbs through combo milestones", () => {
  const session = new GameSession(stageWith([]), "normal");
  assert.equal(session.flowMultiplier, 1);
  session.stats.combo = 8;
  assert.equal(session.flowMultiplier, 1.25);
  session.stats.combo = 18;
  assert.equal(session.flowMultiplier, 1.5);
  session.stats.combo = 32;
  assert.equal(session.flowMultiplier, 1.75);
});

test("FLOW DRIVE doubles score and records an activation", () => {
  const note: ChartNote = {
    id: "spark",
    type: "spark",
    time: 1,
    duration: 0,
    lane: 0,
    visualVariant: 0,
  };
  const regular = new GameSession(stageWith([note]), "normal");
  regular.start(0, 0);
  regular.input("tap", true, 1);

  const driven = new GameSession(stageWith([note]), "normal");
  driven.start(0, 0);
  assert.equal(driven.activateDrive(), true);
  driven.input("tap", true, 1);

  assert.equal(driven.stats.score, regular.stats.score * 2);
  assert.equal(driven.stats.driveActivations, 1);
});

test("successful switches and all three route missions reach the result", () => {
  const switchNote: ChartNote = {
    id: "switch",
    type: "switch",
    time: 1,
    duration: 0,
    direction: "left",
    lane: 0,
    visualVariant: 0,
  };
  const session = new GameSession(stageWith([switchNote]), "normal");
  session.start(0, 0);
  session.input("left", true, 1);
  assert.equal(session.stats.switchSuccess, 1);
  assert.equal(session.result().missionStars, 3);
});


test("adventure bonus adds a fixed score without changing combo", () => {
  const session = new GameSession(stageWith([]), "easy");
  session.stats.combo = 7;
  session.addBonusScore(750);
  session.addBonusScore(Number.NaN);
  session.addBonusScore(-100);
  assert.equal(session.stats.score, 750);
  assert.equal(session.stats.combo, 7);
});

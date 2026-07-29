import assert from "node:assert/strict";
import test from "node:test";
import { getStage } from "../src/game/data/stages.ts";
import {
  getRunGoalProgress,
  getRunGoals,
  stageMissionStars,
  totalMissionStars,
} from "../src/game/runGoals.ts";
import { defaultProgress } from "../src/game/repository/ProgressRepository.ts";
import type { SessionStats } from "../src/game/types.ts";

function stats(): SessionStats {
  return {
    score: 0,
    combo: 0,
    maxCombo: 40,
    counts: { perfect: 50, great: 0, good: 0, miss: 0 },
    offsets: [],
    quietSuccess: 99,
    quietTotal: 99,
    beamSuccess: 0,
    beamTotal: 0,
    boosterSuccess: 99,
    boosterTotal: 99,
    switchSuccess: 99,
    switchTotal: 99,
    driveActivations: 1,
    flowPeak: 1.75,
    totalNotes: 50,
  };
}

test("each route offers three clear and completable goals", () => {
  for (const stageId of ["city", "jungle", "moon"] as const) {
    const goals = getRunGoals(getStage(stageId), "normal");
    assert.equal(goals.length, 3);
    assert.equal(new Set(goals.map((goal) => goal.id)).size, 3);
    assert.equal(getRunGoalProgress(goals, stats()).every((goal) => goal.complete), true);
  }
});

test("mission stars add up across routes and difficulties", () => {
  const progress = defaultProgress();
  progress.records.city = {
    bestScore: 1000,
    bestAccuracy: 90,
    clearedDifficulties: ["easy", "normal"],
    missionStars: { easy: 3, normal: 2 },
  };
  progress.records.jungle = {
    bestScore: 2000,
    bestAccuracy: 91,
    clearedDifficulties: ["easy"],
    missionStars: { easy: 1 },
  };
  assert.equal(stageMissionStars(progress, "city"), 5);
  assert.equal(totalMissionStars(progress), 6);
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_SETTINGS,
  ProgressRepository,
  defaultProgress,
  migrateSettings,
} from "../src/game/repository/ProgressRepository.ts";
import type { SessionResult } from "../src/game/types.ts";

const sampleResult: SessionResult = {
  score: 12345,
  combo: 8,
  maxCombo: 12,
  counts: { perfect: 10, great: 2, good: 1, miss: 1 },
  offsets: [0, 10, -12],
  quietSuccess: 1,
  quietTotal: 1,
  beamSuccess: 1,
  beamTotal: 1,
  boosterSuccess: 0,
  boosterTotal: 0,
  switchSuccess: 0,
  switchTotal: 0,
  driveActivations: 1,
  flowPeak: 1.25,
  totalNotes: 14,
  accuracy: 91,
  stability: 88,
  earlyPercent: 20,
  latePercent: 20,
  message: "Test",
  missionStars: 2,
  completedGoalIds: ["rhythm-accuracy", "combo-line"],
};

test("unchanged original audio defaults migrate to the clearer mix", () => {
  const migrated = migrateSettings({ musicVolume: 0.58, sfxVolume: 0.72 });
  assert.equal(migrated.musicVolume, DEFAULT_SETTINGS.musicVolume);
  assert.equal(migrated.sfxVolume, DEFAULT_SETTINGS.sfxVolume);
});

test("custom audio settings are preserved during migration", () => {
  const migrated = migrateSettings({ musicVolume: 0.58, sfxVolume: 0.5 });
  assert.equal(migrated.musicVolume, 0.58);
  assert.equal(migrated.sfxVolume, 0.5);
});
test("recording a result saves records and unlocks rewards", () => {
  const repository = new ProgressRepository();
  const recorded = repository.recordResult(defaultProgress(), "city", "easy", sampleResult);
  assert.equal(recorded.progress.records.city?.bestScore, 12345);
  assert.equal(recorded.progress.records.city?.missionStars?.easy, 2);
  assert.equal(recorded.progress.stationStamps.includes("city"), true);
  assert.equal(recorded.progress.journeyCount, 1);
  assert.equal(recorded.journeyReward.stampPosition, 1);
  assert.equal(recorded.progress.unlockedTrains.includes("forest-line"), true);
  assert.equal(recorded.unlocked.length, 2);
  assert.equal(recorded.unlocked[0], "フォレストライン");
});

test("every third completed run adds one souvenir without random pressure", () => {
  const repository = new ProgressRepository();
  const first = repository.recordResult(defaultProgress(), "city", "easy", sampleResult);
  const second = repository.recordResult(first.progress, "city", "easy", sampleResult);
  const third = repository.recordResult(second.progress, "city", "easy", sampleResult);

  assert.equal(second.journeyReward.completedCard, false);
  assert.equal(third.journeyReward.completedCard, true);
  assert.equal(third.progress.journeyCount, 3);
  assert.equal(third.progress.souvenirStickers.length, 1);
  assert.equal(third.journeyReward.stickerId, third.progress.souvenirStickers[0]);
});

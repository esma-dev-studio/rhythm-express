import { getTrain } from "../data/trains.ts";
import {
  normalizeOwnedStickers,
  rewardForJourney,
  type JourneyReward,
} from "../journeyRewards.ts";
import type { Difficulty, GameSettings, ProgressData, SessionResult, StageTheme } from "../types.ts";

const STORAGE_KEY = "rhythm-express-progress-v1";

export const DEFAULT_SETTINGS: GameSettings = {
  musicVolume: 0.76,
  sfxVolume: 0.55,
  effectsStrength: 0.8,
  timingOffsetMs: 0,
  reducedMotion: false,
};

export function migrateSettings(saved?: Partial<GameSettings>): GameSettings {
  const settings = { ...DEFAULT_SETTINGS, ...(saved ?? {}) };
  const usesOriginalAudioDefaults = saved?.musicVolume === 0.58 && saved?.sfxVolume === 0.72;
  if (usesOriginalAudioDefaults) {
    settings.musicVolume = DEFAULT_SETTINGS.musicVolume;
    settings.sfxVolume = DEFAULT_SETTINGS.sfxVolume;
  }
  return settings;
}

export function defaultProgress(): ProgressData {
  return {
    version: 1,
    seenTutorial: false,
    unlockedStages: ["city", "jungle", "moon"],
    unlockedTrains: ["sunrise"],
    unlockedPassengers: [],
    selectedTrain: "sunrise",
    stationStamps: [],
    journeyCount: 0,
    souvenirStickers: [],
    records: {},
    settings: { ...DEFAULT_SETTINGS },
  };
}

export class ProgressRepository {
  load(): ProgressData {
    if (typeof window === "undefined") return defaultProgress();
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultProgress();
      const saved = JSON.parse(raw) as Partial<ProgressData>;
      return {
        ...defaultProgress(),
        ...saved,
        journeyCount: Number.isFinite(saved.journeyCount)
          ? Math.max(0, Math.floor(saved.journeyCount ?? 0))
          : 0,
        souvenirStickers: normalizeOwnedStickers(saved.souvenirStickers),
        settings: migrateSettings(saved.settings),
        records: saved.records ?? {},
      };
    } catch {
      return defaultProgress();
    }
  }

  save(progress: ProgressData): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }

  recordResult(
    progress: ProgressData,
    stage: StageTheme,
    difficulty: Difficulty,
    result: SessionResult,
  ): { progress: ProgressData; unlocked: string[]; journeyReward: JourneyReward } {
    const next: ProgressData = JSON.parse(JSON.stringify(progress)) as ProgressData;
    next.journeyCount = Math.max(0, Math.floor(next.journeyCount ?? 0)) + 1;
    next.souvenirStickers = normalizeOwnedStickers(next.souvenirStickers);
    const journeyReward = rewardForJourney(next.journeyCount, next.souvenirStickers);
    if (journeyReward.stickerId) next.souvenirStickers.push(journeyReward.stickerId);
    const previous = next.records[stage];
    const cleared = new Set(previous?.clearedDifficulties ?? []);
    cleared.add(difficulty);
    next.records[stage] = {
      bestScore: Math.max(previous?.bestScore ?? 0, result.score),
      bestAccuracy: Math.max(previous?.bestAccuracy ?? 0, result.accuracy),
      clearedDifficulties: [...cleared],
      missionStars: {
        ...(previous?.missionStars ?? {}),
        [difficulty]: Math.max(previous?.missionStars?.[difficulty] ?? 0, result.missionStars),
      },
    };
    if (!next.stationStamps.includes(stage)) next.stationStamps.push(stage);

    const unlockMap: Record<StageTheme, string[]> = {
      city: ["forest-line", "しゃしょうの ミナモ"],
      jungle: ["percussion-car", "リズムたいの トト"],
      moon: ["starlight", "ほしよみの ルクス"],
    };
    const unlocked: string[] = [];
    const [train, passenger] = unlockMap[stage];
    if (!next.unlockedTrains.includes(train)) {
      next.unlockedTrains.push(train);
      unlocked.push(getTrain(train).name);
    }
    if (!next.unlockedPassengers.includes(passenger)) {
      next.unlockedPassengers.push(passenger);
      unlocked.push(passenger);
    }
    this.save(next);
    return { progress: next, unlocked, journeyReward };
  }
}
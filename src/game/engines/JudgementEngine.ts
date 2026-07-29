import type { Difficulty, DifficultyDefinition, Judgement } from "../types.ts";

export const DIFFICULTIES: Record<Difficulty, DifficultyDefinition> = {
  easy: {
    id: "easy",
    name: "かんたん",
    description: "おおきな マークで、はじめてでも だいじょうぶ",
    perfectMs: 105,
    greatMs: 170,
    goodMs: 240,
    travelTime: 4.4,
  },
  normal: {
    id: "normal",
    name: "ふつう",
    description: "ながおしや みちの きりかえも でてくるよ",
    perfectMs: 70,
    greatMs: 120,
    goodMs: 180,
    travelTime: 3.8,
  },
  challenge: {
    id: "challenge",
    name: "チャレンジ",
    description: "こまかい リズムにも ちょうせん！",
    perfectMs: 52,
    greatMs: 92,
    goodMs: 145,
    travelTime: 3.25,
  },
};

const RANK: Record<Judgement, number> = {
  perfect: 3,
  great: 2,
  good: 1,
  miss: 0,
};

export function judgeTiming(deltaMs: number, difficulty: Difficulty): Judgement {
  const value = Math.abs(deltaMs);
  const windows = DIFFICULTIES[difficulty];
  if (value <= windows.perfectMs) return "perfect";
  if (value <= windows.greatMs) return "great";
  if (value <= windows.goodMs) return "good";
  return "miss";
}

export function worseJudgement(a: Judgement, b: Judgement): Judgement {
  return RANK[a] <= RANK[b] ? a : b;
}

export function judgementScore(judgement: Judgement): number {
  if (judgement === "perfect") return 1000;
  if (judgement === "great") return 760;
  if (judgement === "good") return 480;
  return 0;
}

export function judgementLabel(judgement: Judgement): string {
  if (judgement === "perfect") return "ぴったり！";
  if (judgement === "great") return "いいね！";
  if (judgement === "good") return "もう すこし！";
  return "つぎで あわせよう！";
}
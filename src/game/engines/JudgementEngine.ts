import type { Difficulty, DifficultyDefinition, Judgement } from "../types.ts";

export const DIFFICULTIES: Record<Difficulty, DifficultyDefinition> = {
  easy: {
    id: "easy",
    name: "かんたん",
    description: "大きなマークと広い判定で、はじめてでも安心",
    perfectMs: 105,
    greatMs: 170,
    goodMs: 240,
    travelTime: 4.4,
  },
  normal: {
    id: "normal",
    name: "ふつう",
    description: "長押しや線路切り替えも楽しめる標準コース",
    perfectMs: 70,
    greatMs: 120,
    goodMs: 180,
    travelTime: 3.8,
  },
  challenge: {
    id: "challenge",
    name: "チャレンジ",
    description: "細かな裏拍に挑む、リズム上級コース",
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
  if (judgement === "good") return "もう少し！";
  return "次で合わせよう！";
}
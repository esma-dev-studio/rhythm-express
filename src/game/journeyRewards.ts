import type { StageTheme } from "./types.ts";

export const STAMPS_PER_STICKER = 3;

export interface SouvenirSticker {
  id: string;
  name: string;
  hint: string;
  symbol: string;
  color: string;
  stage: StageTheme;
}

export interface JourneyReward {
  journeyCount: number;
  stampPosition: number;
  completedCard: boolean;
  stickerId?: string;
}

export const SOUVENIR_STICKERS: SouvenirSticker[] = [
  { id: "city-bell", name: "きんいろベル", hint: "まちの駅でひびく音", symbol: "🔔", color: "#ffcf57", stage: "city" },
  { id: "jungle-drum", name: "たいこキング", hint: "森のビートの王さま", symbol: "🥁", color: "#7ad98c", stage: "jungle" },
  { id: "moon-rabbit", name: "ムーンラビット", hint: "月で出会ったジャンプ名人", symbol: "🐇", color: "#9d8cff", stage: "moon" },
  { id: "city-rainbow", name: "にじいろブリッジ", hint: "7色にひかる大きな橋", symbol: "🌈", color: "#ff8f77", stage: "city" },
  { id: "jungle-bird", name: "リズムオウム", hint: "メロディをまねする鳥", symbol: "🦜", color: "#50cfa6", stage: "jungle" },
  { id: "moon-compass", name: "スターコンパス", hint: "星の道を見つけるしるし", symbol: "✦", color: "#72d7ee", stage: "moon" },
  { id: "city-signal", name: "スピードシグナル", hint: "列車をみちびく信号", symbol: "🚦", color: "#ff746d", stage: "city" },
  { id: "jungle-falls", name: "ひみつのたき", hint: "森のおくのきらめく水", symbol: "💧", color: "#54c9ef", stage: "jungle" },
  { id: "moon-rocket", name: "コズミックロケット", hint: "もっと遠くへ行くロケット", symbol: "🚀", color: "#ff9f55", stage: "moon" },
];

export function getSouvenirSticker(id: string): SouvenirSticker | undefined {
  return SOUVENIR_STICKERS.find((sticker) => sticker.id === id);
}

export function normalizeOwnedStickers(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  const validIds = new Set(SOUVENIR_STICKERS.map((sticker) => sticker.id));
  return [...new Set(ids.filter((id): id is string => typeof id === "string" && validIds.has(id)))];
}

export function journeyTicketFilled(journeyCount: number): number {
  const safeCount = Number.isFinite(journeyCount) ? Math.max(0, Math.floor(journeyCount)) : 0;
  return safeCount % STAMPS_PER_STICKER;
}

export function journeysUntilNextSticker(journeyCount: number): number {
  return STAMPS_PER_STICKER - journeyTicketFilled(journeyCount);
}

export function rewardForJourney(journeyCount: number, ownedStickerIds: string[]): JourneyReward {
  const safeCount = Math.max(1, Math.floor(journeyCount));
  const stampPosition = ((safeCount - 1) % STAMPS_PER_STICKER) + 1;
  const completedCard = stampPosition === STAMPS_PER_STICKER;
  const nextSticker = completedCard
    ? SOUVENIR_STICKERS.find((sticker) => !ownedStickerIds.includes(sticker.id))
    : undefined;
  return {
    journeyCount: safeCount,
    stampPosition,
    completedCard,
    stickerId: nextSticker?.id,
  };
}

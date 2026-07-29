import type { StageDefinition, StageTheme } from "./types.ts";

export interface AdventureEncounter {
  id: string;
  stage: StageTheme;
  startTime: number;
  duration: number;
  icon: string;
  actionIcon: string;
  title: string;
  prompt: string;
  actionLabel: string;
  successMessage: string;
  scoreBonus: number;
  energyBonus: number;
}

interface EncounterBlueprint {
  key: string;
  progress: number;
  icon: string;
  actionIcon: string;
  title: string;
  prompt: string;
  actionLabel: string;
  successMessage: string;
}

const BLUEPRINTS: Record<StageTheme, EncounterBlueprint[]> = {
  city: [
    {
      key: "puppy-whistle",
      progress: 0.22,
      icon: "🐶",
      actionIcon: "📣",
      title: "まちかどサプライズ",
      prompt: "わんちゃんが列車を見ているよ！",
      actionLabel: "汽笛をならす",
      successMessage: "わんちゃんが大よろこび！",
    },
    {
      key: "station-wave",
      progress: 0.52,
      icon: "🧑‍✈️",
      actionIcon: "👋",
      title: "ホームからの合図",
      prompt: "駅員さんが手をふっているよ！",
      actionLabel: "手をふりかえす",
      successMessage: "駅のみんなとハイタッチ！",
    },
    {
      key: "festival-bell",
      progress: 0.72,
      icon: "🎪",
      actionIcon: "🔔",
      title: "おまつりゲート",
      prompt: "光のゲートを元気にひらこう！",
      actionLabel: "ベルをならす",
      successMessage: "まちじゅうがキラキラ！",
    },
  ],
  jungle: [
    {
      key: "monkey-drum",
      progress: 0.22,
      icon: "🐵",
      actionIcon: "🥁",
      title: "森のリズム隊",
      prompt: "おさるさんが合奏を待っているよ！",
      actionLabel: "たいこをたたく",
      successMessage: "森のみんなが踊りだした！",
    },
    {
      key: "parrot-greeting",
      progress: 0.52,
      icon: "🦜",
      actionIcon: "🙌",
      title: "オウムのあいさつ",
      prompt: "大きな声で合図を送ろう！",
      actionLabel: "やっほー！",
      successMessage: "やっほーが森にひびいた！",
    },
    {
      key: "waterfall-rainbow",
      progress: 0.72,
      icon: "💦",
      actionIcon: "🌈",
      title: "大たきチャレンジ",
      prompt: "しぶきに光を当ててみよう！",
      actionLabel: "虹をつくる",
      successMessage: "大きな虹の橋ができた！",
    },
  ],
  moon: [
    {
      key: "rabbit-light",
      progress: 0.22,
      icon: "🐰",
      actionIcon: "🔦",
      title: "月うさぎを発見",
      prompt: "暗いクレーターを照らしてあげよう！",
      actionLabel: "ライトをつける",
      successMessage: "月うさぎがジャンプした！",
    },
    {
      key: "satellite-signal",
      progress: 0.52,
      icon: "🛰️",
      actionIcon: "📡",
      title: "人工衛星からSOS",
      prompt: "止まったアンテナへ力を送ろう！",
      actionLabel: "電波をおくる",
      successMessage: "人工衛星が動きだした！",
    },
    {
      key: "star-gate",
      progress: 0.72,
      icon: "🌟",
      actionIcon: "🚀",
      title: "星空のゲート",
      prompt: "星のパワーで最後の道をひらこう！",
      actionLabel: "ロケット点火",
      successMessage: "星のトンネルがひらいた！",
    },
  ],
};

export function getAdventureEncounters(
  stage: Pick<StageDefinition, "id" | "duration">,
): AdventureEncounter[] {
  return BLUEPRINTS[stage.id].map((blueprint) => ({
    id: stage.id + "-" + blueprint.key,
    stage: stage.id,
    startTime: Number((stage.duration * blueprint.progress).toFixed(2)),
    duration: 5,
    icon: blueprint.icon,
    actionIcon: blueprint.actionIcon,
    title: blueprint.title,
    prompt: blueprint.prompt,
    actionLabel: blueprint.actionLabel,
    successMessage: blueprint.successMessage,
    scoreBonus: 750,
    energyBonus: 18,
  }));
}

export function getActiveAdventureEncounter(
  encounters: readonly AdventureEncounter[],
  playhead: number,
  seenIds: ReadonlySet<string>,
): AdventureEncounter | null {
  return encounters.find((encounter) => (
    !seenIds.has(encounter.id)
    && playhead >= encounter.startTime
    && playhead < encounter.startTime + encounter.duration
  )) ?? null;
}

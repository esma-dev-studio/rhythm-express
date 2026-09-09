import type { HitFeedback, StageDefinition, StageTheme } from "./types.ts";

export const ENCOUNTER_TARGET = 3;
export function isEncounterRhythmHit(feedback: HitFeedback | null): boolean {
  return !!feedback?.noteType && feedback.deltaMs !== undefined
    && (feedback.judgement === "perfect" || feedback.judgement === "great" || feedback.judgement === "good");
}

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
      prompt: "わんちゃんが れっしゃを みているよ！",
      actionLabel: "ポッポー！",
      successMessage: "わんちゃんが おおよろこび！",
    },
    {
      key: "station-wave",
      progress: 0.52,
      icon: "🧑‍✈️",
      actionIcon: "👋",
      title: "ホームから あいず",
      prompt: "えきいんさんが てを ふっているよ！",
      actionLabel: "てを ふる",
      successMessage: "えきの みんなと ハイタッチ！",
    },
    {
      key: "festival-bell",
      progress: 0.72,
      icon: "🎪",
      actionIcon: "🔔",
      title: "おまつりゲート",
      prompt: "ひかりの ゲートを ひらこう！",
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
      title: "もりの リズムたい",
      prompt: "おさるさんが まっているよ！",
      actionLabel: "たいこをたたく",
      successMessage: "もりの みんなが おどりだした！",
    },
    {
      key: "parrot-greeting",
      progress: 0.52,
      icon: "🦜",
      actionIcon: "🙌",
      title: "オウムのあいさつ",
      prompt: "おおきな こえで あいずを おくろう！",
      actionLabel: "やっほー！",
      successMessage: "やっほーが もりに ひびいた！",
    },
    {
      key: "waterfall-rainbow",
      progress: 0.72,
      icon: "💦",
      actionIcon: "🌈",
      title: "おおたき チャレンジ",
      prompt: "しぶきに ひかりを あててみよう！",
      actionLabel: "にじを つくる",
      successMessage: "おおきな にじの はしが できた！",
    },
  ],
  moon: [
    {
      key: "rabbit-light",
      progress: 0.22,
      icon: "🐰",
      actionIcon: "🔦",
      title: "つきうさぎを みつけた",
      prompt: "くらい クレーターを てらそう！",
      actionLabel: "ライトをつける",
      successMessage: "つきうさぎが ジャンプした！",
    },
    {
      key: "satellite-signal",
      progress: 0.52,
      icon: "🛰️",
      actionIcon: "📡",
      title: "うちゅうから SOS",
      prompt: "とまった アンテナに パワーを おくろう！",
      actionLabel: "パワーを おくる",
      successMessage: "うちゅうの きかいが うごきだした！",
    },
    {
      key: "star-gate",
      progress: 0.72,
      icon: "🌟",
      actionIcon: "🚀",
      title: "ほしぞらの ゲート",
      prompt: "ほしの パワーで みちを ひらこう！",
      actionLabel: "ロケット はっしゃ！",
      successMessage: "ほしの トンネルが ひらいた！",
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
    duration: 8,
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

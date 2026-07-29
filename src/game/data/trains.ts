export const TRAIN_OPTIONS = [
  {
    id: "sunrise", name: "サンライズ号", description: "朝焼けカラーの最初のビート列車", color: "#f16f61",
    perkShort: "ENERGY +12", perk: "高いエネルギーでスタート。FLOW DRIVEを早く狙える",
  },
  {
    id: "forest-line", name: "フォレストライン", description: "森のリズムで走る緑の列車", color: "#318466",
    perkShort: "やさしい車体", perk: "ミスしたときのエネルギー減少を半分にする",
  },
  {
    id: "percussion-car", name: "パーカッション号", description: "車輪が小気味よく鳴る冒険列車", color: "#f0b84e",
    perkShort: "連打ブースト", perk: "連打と長押しでエネルギーを追加チャージ",
  },
  {
    id: "starlight", name: "スターライト号", description: "星の軌道を走る月面特急", color: "#5de0d2",
    perkShort: "DRIVE 10秒", perk: "FLOW DRIVEの時間が8秒から10秒に伸びる",
  },
] as const;

export function getTrain(id: string) {
  return TRAIN_OPTIONS.find((train) => train.id === id) ?? TRAIN_OPTIONS[0];
}
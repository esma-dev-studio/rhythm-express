export const TRAIN_OPTIONS = [
  {
    id: "sunrise", name: "サンライズごう", description: "あさやけカラーの はじめの れっしゃ", color: "#f16f61",
    perkShort: "パワー +12", perk: "パワーが おおい じょうたいで スタート",
  },
  {
    id: "forest-line", name: "フォレストライン", description: "もりの リズムで はしる みどりの れっしゃ", color: "#318466",
    perkShort: "ミスに つよい", perk: "ミスしても パワーが へりにくい",
  },
  {
    id: "percussion-car", name: "パーカッションごう", description: "しゃりんが リズムを ならす れっしゃ", color: "#f0b84e",
    perkShort: "れんだで パワー", perk: "れんだと ながおしで パワーが ふえる",
  },
  {
    id: "starlight", name: "スターライトごう", description: "ほしの みちを はしる げつめん れっしゃ", color: "#5de0d2",
    perkShort: "スーパー 10びょう", perk: "スーパーそうこうが 10びょう つづく",
  },
] as const;

export function getTrain(id: string) {
  return TRAIN_OPTIONS.find((train) => train.id === id) ?? TRAIN_OPTIONS[0];
}
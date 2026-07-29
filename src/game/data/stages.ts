import type { ChartNote, Difficulty, StageDefinition, StageEvent, StageTheme } from "../types.ts";

const secondsPerBeat = (bpm: number) => 60 / bpm;

function createChart(
  stage: StageTheme,
  order: number,
  bpm: number,
  duration: number,
  difficulty: Difficulty,
): ChartNote[] {
  const beatSeconds = secondsPerBeat(bpm);
  const totalBeats = Math.floor(duration / beatSeconds) - 7;
  const notes: ChartNote[] = [];
  let id = 0;
  const add = (
    type: ChartNote["type"],
    beat: number,
    noteDuration = 0,
    extra: Partial<ChartNote> = {},
  ) => {
    if (beat < 4 || beat >= totalBeats) return;
    notes.push({
      id: stage + "-" + difficulty + "-" + id++,
      type,
      time: Number((beat * beatSeconds).toFixed(4)),
      duration: Number((noteDuration * beatSeconds).toFixed(4)),
      lane: extra.lane ?? id % 2,
      visualVariant: extra.visualVariant ?? id % 3,
      direction: extra.direction,
      targetHits: extra.targetHits,
    });
  };

  const barCount = Math.floor(totalBeats / 4);
  for (let bar = 1; bar < barCount; bar += 1) {
    const beat = bar * 4;
    if (order >= 2 && bar % 10 === 7) {
      add("quiet", beat, difficulty === "easy" ? 2 : 3);
      continue;
    }
    if (order >= 2 && bar % 8 === 5) {
      const span = difficulty === "normal" ? 3 : 4;
      add("booster", beat, span, { targetHits: difficulty === "easy" ? 4 : difficulty === "normal" ? 6 : 8 });
      continue;
    }
    if (bar % 6 === 4) {
      add("beam", beat, difficulty === "challenge" ? 3 : 2);
      if (difficulty !== "easy") add("spark", beat + 3.5);
      continue;
    }
    if (order === 3 && difficulty !== "easy" && bar % 4 === 2) {
      add("switch", beat, 0, { direction: bar % 8 === 2 ? "left" : "right", lane: bar % 2 });
      add("spark", beat + 2);
      if (difficulty === "challenge") {
        add("switch", beat + 3, 0, { direction: bar % 8 === 2 ? "right" : "left" });
      }
      continue;
    }
    const positions =
      difficulty === "easy"
        ? [0, 2]
        : difficulty === "normal"
          ? bar % 3 === 0
            ? [0, 1, 2, 3]
            : [0, 2, 3]
          : bar % 2 === 0
            ? [0, 0.5, 1.5, 2, 2.5, 3.5]
            : [0, 1, 1.5, 2.5, 3];
    positions.forEach((position) => add("spark", beat + position));
  }
  return notes.sort((a, b) => a.time - b.time);
}

function eventsFor(duration: number, targets: string[]): StageEvent[] {
  return [
    { time: duration * 0.22, type: "scenery", target: targets[0], intensity: 1 },
    { time: duration * 0.52, type: "scenery", target: targets[1], intensity: 2 },
    { time: duration * 0.72, type: "chorus", target: targets[2], intensity: 3 },
    { time: duration - 2, type: "arrival", target: targets[3], intensity: 2 },
  ];
}

const rawStages: Omit<StageDefinition, "notes">[] = [
  {
    id: "city",
    order: 1,
    name: "はじまりの まち",
    shortName: "まち",
    destination: "ひだまり えき",
    description: "あさの まちを はしって、ビートを めざめさせよう",
    bpm: 96,
    duration: 60,
    theme: "city",
    colors: { sky: "#8dd7f7", horizon: "#f7e08b", ground: "#2d6f67", accent: "#f16f61", highlight: "#ffd14f" },
    musicScale: [261.63, 293.66, 329.63, 392, 440, 523.25],
    events: eventsFor(60, ["おみせの みち", "かわの そば", "となりの れっしゃ", "ひだまり えき"]),
    unlockName: "しゃしょうの ミナモ",
  },
  {
    id: "jungle",
    order: 2,
    name: "ジャングル てつどう",
    shortName: "ジャングル",
    destination: "おおきな たき えき",
    description: "どうぶつの リズムを あつめて、おおきな たきを こえよう",
    bpm: 108,
    duration: 75,
    theme: "jungle",
    colors: { sky: "#80cfc1", horizon: "#b7d66f", ground: "#194f3b", accent: "#ff8466", highlight: "#f6cf57" },
    musicScale: [220, 261.63, 293.66, 329.63, 392, 440],
    events: eventsFor(75, ["つるの もり", "ねむりの たに", "ふるい はし", "おおきな たき えき"]),
    unlockName: "パーカッションごう",
  },
  {
    id: "moon",
    order: 3,
    name: "げつめん エクスプレス",
    shortName: "げつめん",
    destination: "ルナ・ステーション",
    description: "つきの せんろを きりかえて、ほしの えきへ いこう",
    bpm: 120,
    duration: 90,
    theme: "moon",
    colors: { sky: "#111b4d", horizon: "#493c83", ground: "#cbc8d7", accent: "#5de0d2", highlight: "#f3cf58" },
    musicScale: [196, 233.08, 261.63, 311.13, 349.23, 392],
    events: eventsFor(90, ["クレーター", "いんせきの みち", "ほしの トンネル", "ルナ・ステーション"]),
    unlockName: "スターライトごう",
  },
];

export const STAGES: StageDefinition[] = rawStages.map((stage) => ({
  ...stage,
  notes: {
    easy: createChart(stage.id, stage.order, stage.bpm, stage.duration, "easy"),
    normal: createChart(stage.id, stage.order, stage.bpm, stage.duration, "normal"),
    challenge: createChart(stage.id, stage.order, stage.bpm, stage.duration, "challenge"),
  },
}));

export function getStage(id: StageTheme): StageDefinition {
  const stage = STAGES.find((candidate) => candidate.id === id);
  if (!stage) throw new Error("Unknown stage: " + id);
  return stage;
}
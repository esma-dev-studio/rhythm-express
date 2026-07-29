import type {
  Difficulty,
  ProgressData,
  RunGoal,
  RunGoalProgress,
  SessionStats,
  StageDefinition,
  StageTheme,
} from "./types.ts";

const ACCURACY_TARGET: Record<Difficulty, number> = {
  easy: 72,
  normal: 82,
  challenge: 90,
};

const COMBO_TARGET: Record<Difficulty, number> = {
  easy: 10,
  normal: 18,
  challenge: 28,
};

function liveAccuracy(stats: SessionStats): number {
  const resolved = Object.values(stats.counts).reduce((sum, value) => sum + value, 0);
  if (!resolved) return 0;
  const weighted =
    stats.counts.perfect + stats.counts.great * 0.82 + stats.counts.good * 0.55;
  return Math.round((weighted / resolved) * 100);
}

function routeGoal(stage: StageDefinition, difficulty: Difficulty): RunGoal {
  const chart = stage.notes[difficulty];
  if (stage.theme === "city") {
    const target = Math.min(
      chart.length,
      Math.max(
        5,
        Math.round(
          chart.length *
            (difficulty === "easy" ? 0.36 : difficulty === "normal" ? 0.42 : 0.48),
        ),
      ),
    );
    return {
      id: "city-center-beat",
      metric: "perfect",
      label: "センタービート",
      description: `PERFECTを${target}回きめる`,
      target,
    };
  }

  if (stage.theme === "jungle") {
    const target = chart.filter(
      (note) => note.type === "quiet" || note.type === "booster",
    ).length;
    return {
      id: "jungle-call-response",
      metric: "routeMastery",
      label: "ジャングル・コール",
      description: `しずか＆ブーストを${Math.max(1, target)}回成功`,
      target: Math.max(1, target),
    };
  }

  const switchTarget = chart.filter((note) => note.type === "switch").length;
  if (switchTarget > 0) {
    return {
      id: "moon-switch-master",
      metric: "switchSuccess",
      label: "星空ルート",
      description: `分岐レバーを${switchTarget}回成功させる`,
      target: switchTarget,
    };
  }

  return {
    id: "moon-flow-drive",
    metric: "driveActivations",
    label: "ムーン・ドライブ",
    description: "FLOW DRIVEを1回発動する",
    target: 1,
  };
}

export function getRunGoals(
  stage: StageDefinition,
  difficulty: Difficulty,
): RunGoal[] {
  const chartLength = stage.notes[difficulty].length;
  const comboTarget = Math.max(
    1,
    Math.min(chartLength, COMBO_TARGET[difficulty] + (stage.order - 1) * 2),
  );
  return [
    {
      id: "rhythm-accuracy",
      metric: "accuracy",
      label: "リズム精度",
      description: `${ACCURACY_TARGET[difficulty]}%以上で走る`,
      target: ACCURACY_TARGET[difficulty],
    },
    {
      id: "combo-line",
      metric: "maxCombo",
      label: "コンボライン",
      description: `${comboTarget}コンボをつなぐ`,
      target: comboTarget,
    },
    routeGoal(stage, difficulty),
  ];
}

function valueForGoal(goal: RunGoal, stats: SessionStats): number {
  if (goal.metric === "accuracy") return liveAccuracy(stats);
  if (goal.metric === "maxCombo") return stats.maxCombo;
  if (goal.metric === "driveActivations") return stats.driveActivations;
  if (goal.metric === "perfect") return stats.counts.perfect;
  if (goal.metric === "routeMastery") {
    return stats.quietSuccess + stats.boosterSuccess;
  }
  return stats.switchSuccess;
}

function valueLabel(goal: RunGoal, value: number): string {
  if (goal.metric === "accuracy") return `${value}%`;
  if (goal.metric === "maxCombo") return `${value} COMBO`;
  return `${Math.min(value, goal.target)}/${goal.target}`;
}

export function getRunGoalProgress(
  goals: RunGoal[],
  stats: SessionStats,
): RunGoalProgress[] {
  return goals.map((goal) => {
    const value = valueForGoal(goal, stats);
    return {
      ...goal,
      value,
      valueLabel: valueLabel(goal, value),
      progress: Math.max(0, Math.min(1, value / Math.max(1, goal.target))),
      complete: value >= goal.target,
    };
  });
}

export function completedGoalIds(goals: RunGoal[], stats: SessionStats): string[] {
  return getRunGoalProgress(goals, stats)
    .filter((goal) => goal.complete)
    .map((goal) => goal.id);
}

export function stageMissionStars(
  progress: ProgressData,
  stage: StageTheme,
): number {
  return Object.values(progress.records[stage]?.missionStars ?? {}).reduce(
    (sum, value) => sum + (value ?? 0),
    0,
  );
}

export function totalMissionStars(progress: ProgressData): number {
  return (Object.keys(progress.records) as StageTheme[]).reduce(
    (sum, stage) => sum + stageMissionStars(progress, stage),
    0,
  );
}

export const MAX_MISSION_STARS = 27;

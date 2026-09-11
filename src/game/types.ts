export type Difficulty = "easy" | "normal" | "challenge";
export type NoteType = "spark" | "beam" | "switch" | "booster" | "quiet";
export type Direction = "left" | "right";
export type PlayMode = "one" | "duet";
export type StageTheme = "city" | "jungle" | "moon";
export type Judgement = "perfect" | "great" | "good" | "miss";
export type RunGoalMetric = "accuracy" | "maxCombo" | "driveActivations" | "perfect" | "routeMastery" | "switchSuccess";

export interface ChartNote {
  id: string;
  type: NoteType;
  time: number;
  duration: number;
  direction?: Direction;
  lane: number;
  visualVariant: number;
  targetHits?: number;
  hand?: Direction;
}

export interface StageEvent {
  time: number;
  type: "scenery" | "chorus" | "arrival";
  target: string;
  intensity: number;
}

export interface StageColors {
  sky: string;
  horizon: string;
  ground: string;
  accent: string;
  highlight: string;
}

export interface StageDefinition {
  id: StageTheme;
  order: number;
  name: string;
  shortName: string;
  destination: string;
  description: string;
  bpm: number;
  duration: number;
  theme: StageTheme;
  colors: StageColors;
  musicScale: number[];
  notes: Record<Difficulty, ChartNote[]>;
  events: StageEvent[];
  unlockName: string;
}

export interface DifficultyDefinition {
  id: Difficulty;
  name: string;
  description: string;
  perfectMs: number;
  greatMs: number;
  goodMs: number;
  travelTime: number;
}

export type RuntimeNoteState = "pending" | "holding" | "resolved";

export interface RuntimeNote extends ChartNote {
  state: RuntimeNoteState;
  judgement?: Judgement;
  deltaMs?: number;
  quietBroken: boolean;
  tapCount: number;
  boosterHitSlots: number[];
  boosterWrongSlots?: number[];
  beamStartJudgement?: Judgement;
  beamStartDeltaMs?: number;
}

export type GameAction = "tap" | "left" | "right" | "pad-left" | "pad-right";

export interface PerformanceGesture {
  noteId: string;
  phase: "strike" | "hold" | "release";
  slot: number;
  hand?: Direction;
}

export interface HitFeedback {
  judgement?: Judgement;
  label: string;
  noteType?: NoteType;
  deltaMs?: number;
  energyDelta: number;
  performance?: PerformanceGesture;
  expectedHand?: Direction;
}

export interface RunGoal {
  id: string;
  metric: RunGoalMetric;
  label: string;
  description: string;
  target: number;
}

export interface RunGoalProgress extends RunGoal {
  value: number;
  valueLabel: string;
  progress: number;
  complete: boolean;
}

export interface SessionStats {
  score: number;
  combo: number;
  maxCombo: number;
  counts: Record<Judgement, number>;
  offsets: number[];
  quietSuccess: number;
  quietTotal: number;
  beamSuccess: number;
  beamTotal: number;
  boosterSuccess: number;
  boosterTotal: number;
  switchSuccess: number;
  switchTotal: number;
  driveActivations: number;
  flowPeak: number;
  totalNotes: number;
}

export interface SessionResult extends SessionStats {
  playMode?: PlayMode;
  rhythmPoints?: number;
  rhythmTrace?: RhythmTracePoint[];
  previousRhythmPoints?: number;
  accuracy: number;
  stability: number;
  earlyPercent: number;
  latePercent: number;
  message: string;
  missionStars: number;
  completedGoalIds: string[];
}

export interface GameSettings {
  playMode?: PlayMode;
  musicVolume: number;
  sfxVolume: number;
  effectsStrength: number;
  timingOffsetMs: number;
  reducedMotion: boolean;
}

export interface StageRecord {
  bestScore: number;
  bestAccuracy: number;
  clearedDifficulties: Difficulty[];
  missionStars?: Partial<Record<Difficulty, number>>;
}

export interface ProgressData {
  rhythmBests?: Record<string, RhythmBest>;
  version: 1;
  seenTutorial: boolean;
  unlockedStages: StageTheme[];
  unlockedTrains: string[];
  unlockedPassengers: string[];
  selectedTrain: string;
  stationStamps: StageTheme[];
  journeyCount: number;
  souvenirStickers: string[];
  records: Partial<Record<StageTheme, StageRecord>>;
  settings: GameSettings;
}

export interface RhythmTracePoint { time: number; points: number }
export interface RhythmBest { points: number; trace: RhythmTracePoint[] }

"use client";

import { useEffect, useRef, useState } from "react";
import { AttractCanvas } from "./GameCanvas";
import { STAGES } from "../game/data/stages";
import { TRAIN_OPTIONS } from "../game/data/trains";
import { DIFFICULTIES } from "../game/engines/JudgementEngine";
import { MAX_MISSION_STARS, getRunGoals, stageMissionStars, totalMissionStars } from "../game/runGoals";
import {
  SOUVENIR_STICKERS,
  STAMPS_PER_STICKER,
  getSouvenirSticker,
  journeyTicketFilled,
  journeysUntilNextSticker,
  type JourneyReward,
} from "../game/journeyRewards";
import type { AudioEngine } from "../game/engines/AudioEngine";
import { pointerEventsAvailable } from "../game/browserCompatibility";
import type {
  Difficulty,
  GameSettings,
  ProgressData,
  SessionResult,
  StageDefinition,
  StageTheme,
} from "../game/types";

type TutorialPointerEvent = React.PointerEvent<HTMLButtonElement>;

function captureTutorialPointerSafely(event: TutorialPointerEvent): void {
  try {
    if (typeof event.currentTarget.setPointerCapture === "function") {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  } catch {
    // iPadOS may finish a pointer before capture is established.
  }
}

function releaseTutorialPointerSafely(event: TutorialPointerEvent): void {
  try {
    if (
      typeof event.currentTarget.hasPointerCapture === "function"
      && event.currentTarget.hasPointerCapture(event.pointerId)
    ) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  } catch {
    // The pointer may already have been released by the browser.
  }
}

interface HeaderProps {
  progress: ProgressData;
  onHome: () => void;
  onSettings: () => void;
}

export function AppHeader({ progress, onHome, onSettings }: HeaderProps) {
  const masteryStars = totalMissionStars(progress);
  return (
    <header className="app-header">
      <button className="brand-button" type="button" onClick={onHome} aria-label="タイトルへ戻る">
        <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
        <span>RHYTHM EXPRESS</span>
      </button>
      <div className="header-actions">
        <span className="stamp-count" aria-label={"駅スタンプ " + progress.stationStamps.length + "個"}>
          <span className="stamp-dots" aria-hidden="true">
            {STAGES.map((stage) => (
              <i className={progress.stationStamps.includes(stage.id) ? "is-filled" : ""} key={stage.id} />
            ))}
          </span>
          <span className="stamp-label">MISSION ★ {masteryStars}/{MAX_MISSION_STARS}</span>
        </span>
        <button className="icon-text-button" type="button" onClick={onSettings} aria-label="設定">
          <span className="settings-glyph" aria-hidden="true"><i /><i /><i /></span>
          <span>設定</span>
        </button>
      </div>
    </header>
  );
}

function TicketStamps({ filled }: { filled: number }) {
  return (
    <span className="ticket-stamps" aria-hidden="true">
      {Array.from({ length: STAMPS_PER_STICKER }, (_, index) => (
        <i className={index < filled ? "is-filled" : ""} key={index}>{index < filled ? "★" : "·"}</i>
      ))}
    </span>
  );
}

interface TitleScreenProps {
  progress: ProgressData;
  onStart: () => void;
  onTutorial: () => void;
  onCollection: () => void;
  onSettings: () => void;
  onParents: () => void;
}

export function TitleScreen({
  progress,
  onStart,
  onTutorial,
  onCollection,
  onSettings,
  onParents,
}: TitleScreenProps) {
  const ticketFilled = journeyTicketFilled(progress.journeyCount);
  const nextStickerIn = journeysUntilNextSticker(progress.journeyCount);
  return (
    <main className="title-screen">
      <AttractCanvas />
      <div className="title-vignette" aria-hidden="true" />
      <section className="title-copy">
        <p className="eyebrow">ビートエンジン、出発準備</p>
        <h1><span>リズム・</span><span>エクスプレス</span></h1>
        <p className="title-subtitle">音楽で世界を走りぬけろ！</p>
        <div className="title-actions">
          <button className="primary-command large-command" type="button" onClick={onStart} data-testid="start-adventure">
            <span>しゅっぱつする</span><i aria-hidden="true">→</i>
          </button>
          <button className="secondary-command" type="button" onClick={onTutorial}>
            はじめての運転
          </button>
        </div>
        <div className="title-route-dots" aria-hidden="true"><i /><i /><i /></div>
        <div className="title-progress-console" aria-label={`ミッションスター ${totalMissionStars(progress)}/${MAX_MISSION_STARS}`}>
          <span>GRAND TOUR</span>
          <strong>★ {totalMissionStars(progress)}<small> / {MAX_MISSION_STARS}</small></strong>
          <i style={{ "--tour-progress": totalMissionStars(progress) / MAX_MISSION_STARS } as React.CSSProperties} />
          <small>路線ミッションを達成して、伝説の運転士を目指そう</small>
        </div>
        <div className="title-ticket-card" aria-label={`わくわく乗車券、あと${nextStickerIn}回でシール`}>
          <span className="ticket-card-icon" aria-hidden="true">?</span>
          <span><small>わくわく乗車券</small><strong>あと {nextStickerIn} 回で ひみつシール！</strong></span>
          <TicketStamps filled={ticketFilled} />
        </div>
      </section>
      <nav className="title-utility" aria-label="そのほかのメニュー">
        <button type="button" onClick={onCollection}>コレクション</button>
        <button type="button" onClick={onSettings}>設定</button>
        <button type="button" onClick={onParents}>保護者の方へ</button>
      </nav>
    </main>
  );
}

interface TutorialScreenProps {
  audio: AudioEngine;
  settings: GameSettings;
  onComplete: () => void;
  onBack: () => void;
}

export function TutorialScreen({ audio, settings, onComplete, onBack }: TutorialScreenProps) {
  const [step, setStep] = useState(0);
  const [pulse, setPulse] = useState(false);
  const [practiceState, setPracticeState] = useState<"idle" | "holding" | "waiting" | "success">("idle");
  const [practiceMessage, setPracticeMessage] = useState("まずは、やってみよう！");
  const [audioPreparing, setAudioPreparing] = useState(false);
  const beamStartedAt = useRef(0);
  const beamAudioReady = useRef(false);
  const practiceTimer = useRef<number | null>(null);
  const audioPreparingRef = useRef(false);
  const practiceAttemptRef = useRef(0);
  const lastBeamTouchAtRef = useRef(0);
  const steps = [
    {
      title: "光が点線の丸に重なったらタップ",
      body: "点線の丸にぴったり重なった瞬間、運転ボタンかSpaceを押します",
      type: "spark",
    },
    {
      title: "長い光は押したまま",
      body: "始まりで押して、光の終わりで指を離します",
      type: "beam",
    },
    {
      title: "何も押さない区間もリズム",
      body: "「しずかに」が来たら、音を聞きながら待ちます",
      type: "quiet",
    },
  ];

  const clearPracticeTimer = () => {
    if (practiceTimer.current !== null) {
      window.clearTimeout(practiceTimer.current);
      practiceTimer.current = null;
    }
  };

  useEffect(() => () => {
    practiceAttemptRef.current += 1;
    audioPreparingRef.current = false;
    beamAudioReady.current = false;
    clearPracticeTimer();
  }, []);

  const finishPractice = (message: string) => {
    clearPracticeTimer();
    setPracticeState("success");
    setPracticeMessage(message);
    setPulse(true);
    practiceTimer.current = window.setTimeout(() => setPulse(false), 420);
  };

  const beginAudioPreparation = () => {
    if (audioPreparingRef.current) return null;
    audioPreparingRef.current = true;
    setAudioPreparing(true);
    practiceAttemptRef.current += 1;
    return practiceAttemptRef.current;
  };

  const finishAudioPreparation = (attempt: number) => {
    if (attempt !== practiceAttemptRef.current) return;
    audioPreparingRef.current = false;
    setAudioPreparing(false);
  };

  const showAudioRetry = (attempt: number) => {
    if (attempt !== practiceAttemptRef.current) return;
    clearPracticeTimer();
    beamStartedAt.current = 0;
    beamAudioReady.current = false;
    setPracticeState("idle");
    setPracticeMessage("音の準備ができなかったよ。もう一度タップしてね");
  };

  const tryBeat = async () => {
    const attempt = beginAudioPreparation();
    if (attempt === null) return;
    setPracticeMessage("音を準備しているよ…");
    try {
      await audio.prepare(settings);
      if (attempt !== practiceAttemptRef.current) return;
      audio.previewBeat();
      finishPractice("できた！ 光と音が重なったね");
    } catch {
      showAudioRetry(attempt);
    } finally {
      finishAudioPreparation(attempt);
    }
  };

  const startBeam = async () => {
    const attempt = beginAudioPreparation();
    if (attempt === null) return;
    clearPracticeTimer();
    beamAudioReady.current = false;
    beamStartedAt.current = performance.now();
    setPracticeState("holding");
    setPracticeMessage("音を準備中。そのまま、おしていてね…");
    try {
      await audio.prepare(settings);
      if (attempt !== practiceAttemptRef.current || !beamStartedAt.current) return;
      beamAudioReady.current = true;
      setPracticeMessage("そのまま、おしていてね…");
      audio.previewBeat();
    } catch {
      showAudioRetry(attempt);
    } finally {
      finishAudioPreparation(attempt);
    }
  };

  const releaseBeam = () => {
    if (!beamStartedAt.current) return;
    const heldFor = performance.now() - beamStartedAt.current;
    beamStartedAt.current = 0;
    if (!beamAudioReady.current) {
      setPracticeState("idle");
      setPracticeMessage(audioPreparingRef.current ? "音の準備が終わったら、もう一度長おししてね" : "もう一度、長おししてみよう");
      return;
    }
    beamAudioReady.current = false;
    if (heldFor >= 650) {
      audio.previewBeat();
      finishPractice("長おし成功！ はじめと終わりを感じられたね");
    } else {
      setPracticeState("idle");
      setPracticeMessage("もう少しだけ、長くおしてみよう");
    }
  };

  const startQuiet = async () => {
    if (practiceState === "waiting") return;
    const attempt = beginAudioPreparation();
    if (attempt === null) return;
    clearPracticeTimer();
    setPracticeMessage("音を準備しているよ…");
    try {
      await audio.prepare(settings);
      if (attempt !== practiceAttemptRef.current) return;
      setPracticeState("waiting");
      setPracticeMessage("いまは押さずに、3はく待とう…");
      audio.previewBeat();
      practiceTimer.current = window.setTimeout(() => {
        audio.previewBeat();
        finishPractice("待てた！ 休むところもリズムだね");
      }, 1900);
    } catch {
      showAudioRetry(attempt);
    } finally {
      finishAudioPreparation(attempt);
    }
  };

  const changeStep = (nextStep: number) => {
    practiceAttemptRef.current += 1;
    audioPreparingRef.current = false;
    setAudioPreparing(false);
    clearPracticeTimer();
    beamStartedAt.current = 0;
    beamAudioReady.current = false;
    setPulse(false);
    setPracticeState("idle");
    setPracticeMessage("まずは、やってみよう！");
    setStep(nextStep);
  };

  const startBeamTouch = (event: React.TouchEvent<HTMLButtonElement>) => {
    if (pointerEventsAvailable()) return;
    event.preventDefault();
    lastBeamTouchAtRef.current = Date.now();
    void startBeam();
  };

  const releaseBeamTouch = (event: React.TouchEvent<HTMLButtonElement>) => {
    if (pointerEventsAvailable()) return;
    event.preventDefault();
    lastBeamTouchAtRef.current = Date.now();
    releaseBeam();
  };

  const startBeamMouse = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (
      pointerEventsAvailable()
      || event.button !== 0
      || Date.now() - lastBeamTouchAtRef.current < 900
    ) {
      return;
    }
    void startBeam();
  };

  const releaseBeamMouse = () => {
    if (
      pointerEventsAvailable()
      || Date.now() - lastBeamTouchAtRef.current < 900
    ) {
      return;
    }
    releaseBeam();
  };

  return (
    <main className="panel-screen tutorial-screen">
      <div className="screen-topline">
        <button className="back-button" type="button" onClick={onBack}>戻る</button>
        <span>はじめての運転</span>
        <span>{step + 1}/3</span>
      </div>
      <section className="tutorial-content">
        <div className={"tutorial-demo demo-" + steps[step].type + (pulse ? " is-hit" : "") + " practice-" + practiceState}>
          <div className="demo-track" />
          <div className="demo-gate" />
          <div className="demo-note" />
        </div>
        <div className="tutorial-instruction">
          <p className="eyebrow">運転レッスン {step + 1}</p>
          <h2>{steps[step].title}</h2>
          <p>{steps[step].body}</p>
          {step === 0 && (
            <button className="practice-pad" type="button" onClick={tryBeat} disabled={audioPreparing}>
              {audioPreparing ? "音を準備中…" : "光にあわせて タップ！"}
            </button>
          )}
          {step === 1 && (
            <button
              className="practice-pad"
              type="button"
              onPointerDown={(event) => {
                void startBeam();
                captureTutorialPointerSafely(event);
              }}
              onPointerUp={(event) => {
                releaseBeam();
                releaseTutorialPointerSafely(event);
              }}
              onPointerCancel={(event) => {
                releaseBeam();
                releaseTutorialPointerSafely(event);
              }}
              onLostPointerCapture={releaseBeam}
              onTouchStart={startBeamTouch}
              onTouchEnd={releaseBeamTouch}
              onTouchCancel={releaseBeamTouch}
              onMouseDown={startBeamMouse}
              onMouseUp={releaseBeamMouse}
              onMouseLeave={releaseBeamMouse}
              onBlur={releaseBeamMouse}
              onContextMenu={(event) => event.preventDefault()}
              onKeyDown={(event) => {
                if (!event.repeat && (event.key === " " || event.key === "Enter")) {
                  event.preventDefault();
                  void startBeam();
                }
              }}
              onKeyUp={(event) => {
                if (event.key === " " || event.key === "Enter") releaseBeam();
              }}
            >
              {audioPreparing ? "音を準備中…" : practiceState === "holding" ? "そのまま おして！" : "ここを 長おしする"}
            </button>
          )}
          {step === 2 && (
            <button className="practice-pad" type="button" onClick={startQuiet} disabled={practiceState === "waiting" || audioPreparing}>
              {audioPreparing ? "音を準備中…" : practiceState === "waiting" ? "押さずに まってね…" : "3はく まつ練習"}
            </button>
          )}
          <p className={"practice-message practice-" + practiceState} aria-live="polite">{practiceMessage}</p>
        </div>
      </section>
      <div className="screen-footer-actions">
        {step > 0 && <button className="secondary-command" type="button" onClick={() => changeStep(step - 1)} disabled={audioPreparing}>ひとつ前</button>}
        {step < 2 ? (
          <button className="primary-command" type="button" onClick={() => changeStep(step + 1)} disabled={audioPreparing}>つぎへ</button>
        ) : (
          <button className="primary-command" type="button" onClick={onComplete} disabled={audioPreparing}>ワールドマップへ</button>
        )}
      </div>
    </main>
  );
}

interface WorldScreenProps {
  progress: ProgressData;
  onSelect: (stage: StageTheme) => void;
  onCollection: () => void;
  onCalibration: () => void;
}

export function WorldScreen({ progress, onSelect, onCollection, onCalibration }: WorldScreenProps) {
  const ticketFilled = journeyTicketFilled(progress.journeyCount);
  const nextStickerIn = journeysUntilNextSticker(progress.journeyCount);
  return (
    <main className="panel-screen world-screen">
      <section className="screen-heading">
        <p className="eyebrow">WORLD MAP</p>
        <h1>次はどこへ走る？</h1>
        <p>3つの世界で、それぞれ違うリズムを見つけよう</p>
      </section>
      <aside className="journey-ticket-strip" aria-label={`あと${nextStickerIn}回でおみやげシール`}>
        <span className="ticket-card-icon" aria-hidden="true">?</span>
        <span><small>NEXT TREASURE</small><strong>あと {nextStickerIn} 回で おみやげシール</strong></span>
        <TicketStamps filled={ticketFilled} />
      </aside>
      <div className="route-line" aria-hidden="true" />
      <section className="stage-grid" aria-label="ステージ一覧">
        {STAGES.map((stage) => {
          const record = progress.records[stage.id];
          const mastery = stageMissionStars(progress, stage.id);
          return (
            <button
              className={"stage-card stage-" + stage.id}
              type="button"
              key={stage.id}
              onClick={() => onSelect(stage.id)}
              data-testid={"stage-" + stage.id}
            >
              <span className="stage-number">0{stage.order}</span>
              <span className="stage-scene" aria-hidden="true">
                <i className="scene-sky" />
                <i className="scene-sun" />
                <i className="scene-land" />
                <i className="scene-landmark" />
                <i className="scene-rail" />
                <i className="scene-train" />
              </span>
              <span className="stage-copy">
                <strong>{stage.name}</strong>
                <small>{stage.bpm} BPM・約{stage.duration}秒</small>
                <span>{stage.description}</span>
              </span>
              <span className="stage-record">
                <span><b>★ {mastery}/9</b><small>{record ? `BEST ${record.bestAccuracy}%` : "NEW ROUTE"}</small></span>
                <i aria-hidden="true">→</i>
              </span>
            </button>
          );
        })}
      </section>
      <div className="map-tools">
        <button className="secondary-command" type="button" onClick={onCollection}>コレクションを見る</button>
        <button className="secondary-command" type="button" onClick={onCalibration}>タイミングを調整</button>
      </div>
    </main>
  );
}

interface DifficultyScreenProps {
  stage: StageDefinition;
  selected: Difficulty;
  progress: ProgressData;
  onSelect: (difficulty: Difficulty) => void;
  onSelectTrain: (trainId: string) => void;
  onStart: () => void;
  onBack: () => void;
}

export function DifficultyScreen({
  stage,
  selected,
  progress,
  onSelect,
  onSelectTrain,
  onStart,
  onBack,
}: DifficultyScreenProps) {
  const available = (Object.keys(DIFFICULTIES) as Difficulty[]);
  const goals = getRunGoals(stage, selected);
  const earnedStars = progress.records[stage.id]?.missionStars?.[selected] ?? 0;
  return (
    <main className="panel-screen choice-screen">
      <div className="screen-topline">
        <button className="back-button" type="button" onClick={onBack}>マップ</button>
        <span>{stage.name}</span>
        <span>{stage.bpm} BPM</span>
      </div>
      <nav className="journey-steps" aria-label="出発までの手順">
        <span className="is-done"><i aria-hidden="true">✓</i>路線</span>
        <span className="is-current">ミッション</span>
        <span>出発</span>
      </nav>
      <section className="screen-heading compact-heading">
        <p className="eyebrow">DIFFICULTY</p>
        <h1>むずかしさを選ぼう</h1>
      </section>
      <div className="segmented-choice difficulty-choice">
        {available.map((difficulty) => {
          const item = DIFFICULTIES[difficulty];
          return (
            <button
              key={difficulty}
              type="button"
              className={selected === difficulty ? "is-selected" : ""}
              onClick={() => onSelect(difficulty)}
              aria-pressed={selected === difficulty}
              data-testid={"difficulty-" + difficulty}
            >
              {selected === difficulty && <span className="choice-check" aria-hidden="true">✓</span>}
              <span className="difficulty-bars" aria-hidden="true">
                <i /><i /><i />
              </span>
              <strong>{item.name}</strong>
              <small>{item.description}</small>
            </button>
          );
        })}
      </div>
      <section className="dispatch-board">
        <div className="mission-brief">
          <div className="dispatch-section-title"><span>RUN MISSIONS</span><strong>獲得済み ★ {earnedStars}/3</strong></div>
          <div className="mission-card-grid">
            {goals.map((goal, index) => (
              <article className={index < earnedStars ? "is-earned" : ""} key={goal.id}>
                <span>{index < earnedStars ? "★" : `0${index + 1}`}</span>
                <div><strong>{goal.label}</strong><small>{goal.description}</small></div>
              </article>
            ))}
          </div>
        </div>
        <div className="dispatch-trains">
          <div className="dispatch-section-title"><span>SELECT TRAIN</span><strong>能力で選ぼう</strong></div>
          <div className="compact-train-grid">
            {TRAIN_OPTIONS.map((train) => {
              const unlocked = progress.unlockedTrains.includes(train.id);
              const isSelected = progress.selectedTrain === train.id;
              return (
                <button
                  type="button"
                  key={train.id}
                  className={isSelected ? "is-selected" : ""}
                  disabled={!unlocked}
                  onClick={() => unlocked && onSelectTrain(train.id)}
                  aria-pressed={isSelected}
                >
                  <i style={{ "--train-color": unlocked ? train.color : "#71838b" } as React.CSSProperties} aria-hidden="true" />
                  <span><strong>{unlocked ? train.name : "未発見の列車"}</strong><small>{unlocked ? train.perkShort : "路線を完走して発見"}</small></span>
                </button>
              );
            })}
          </div>
        </div>
      </section>
      <aside className="note-legend" aria-label="登場するリズムマーク">
        <span><i className="legend-spark" />タップ</span>
        <span><i className="legend-beam" />長押し</span>
        {stage.order >= 2 && <span><i className="legend-booster" />連打</span>}
        {stage.order >= 2 && <span><i className="legend-quiet" />待つ</span>}
        {stage.order >= 3 && selected !== "easy" && <span><i className="legend-switch" />左右</span>}
      </aside>
      <button className="primary-command large-command centered-command dispatch-start-command" type="button" onClick={onStart}>
        ミッションへ出発
      </button>
    </main>
  );
}

interface TrainScreenProps {
  progress: ProgressData;
  onSelect: (trainId: string) => void;
  onStart: () => void;
  onBack: () => void;
}

export function TrainScreen({ progress, onSelect, onStart, onBack }: TrainScreenProps) {
  return (
    <main className="panel-screen choice-screen">
      <div className="screen-topline">
        <button className="back-button" type="button" onClick={onBack}>むずかしさ</button>
        <span>列車庫</span>
        <span>{progress.unlockedTrains.length}/4</span>
      </div>
      <nav className="journey-steps" aria-label="出発までの手順">
        <span className="is-done"><i aria-hidden="true">✓</i>路線</span>
        <span className="is-done"><i aria-hidden="true">✓</i>むずかしさ</span>
        <span className="is-current">列車</span>
      </nav>
      <section className="screen-heading compact-heading">
        <p className="eyebrow">YOUR TRAIN</p>
        <h1>今日の列車を選ぼう</h1>
      </section>
      <button className="primary-command large-command centered-command train-depart-command" type="button" onClick={onStart} data-testid="depart-stage">
        この列車で出発
      </button>
      <div className="train-grid">
        {TRAIN_OPTIONS.map((train) => {
          const unlocked = progress.unlockedTrains.includes(train.id);
          const selected = progress.selectedTrain === train.id;
          return (
            <button
              type="button"
              key={train.id}
              className={"train-card" + (selected ? " is-selected" : "") + (!unlocked ? " is-locked" : "")}
              onClick={() => unlocked && onSelect(train.id)}
              disabled={!unlocked}
              aria-pressed={selected}
            >
              <span className={"train-card-status" + (!unlocked ? " is-lock" : "")} aria-hidden="true">{selected ? "✓" : ""}</span>
              <span className="mini-train" style={{ "--train-color": unlocked ? train.color : "#87979a" } as React.CSSProperties}>
                <i className="mini-cab" /><i className="mini-light" /><i className="mini-stripe" />
                <i className="mini-wheel wheel-one" /><i className="mini-wheel wheel-two" />
              </span>
              <strong>{unlocked ? train.name : "まだ見ぬ列車"}</strong>
              <small>{unlocked ? `${train.description}｜${train.perk}` : "ステージを完走すると出会える"}</small>
            </button>
          );
        })}
      </div>
    </main>
  );
}

interface SettingsScreenProps {
  settings: GameSettings;
  onChange: (settings: GameSettings) => void;
  onCalibration: () => void;
  onBack: () => void;
}

export function SettingsScreen({ settings, onChange, onCalibration, onBack }: SettingsScreenProps) {
  const update = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => {
    onChange({ ...settings, [key]: value });
  };

  return (
    <main className="panel-screen settings-screen">
      <div className="screen-topline">
        <button className="back-button" type="button" onClick={onBack}>戻る</button>
        <span>設定</span>
        <span />
      </div>
      <section className="screen-heading compact-heading">
        <p className="eyebrow">SETTINGS</p>
        <h1>遊びやすさを調整</h1>
      </section>
      <div className="settings-list">
        <label className="setting-row">
          <span className="setting-copy"><i aria-hidden="true">♪</i><span><strong>音楽の大きさ</strong><small>ステージ音楽</small></span></span>
          <span className="setting-control"><output>{Math.round(settings.musicVolume * 100)}%</output><input aria-label="音楽の大きさ" type="range" min="0" max="1" step="0.05" value={settings.musicVolume} onChange={(event) => update("musicVolume", Number(event.target.value))} /></span>
        </label>
        <label className="setting-row">
          <span className="setting-copy"><i aria-hidden="true">●</i><span><strong>効果音の大きさ</strong><small>判定音とボタン音</small></span></span>
          <span className="setting-control"><output>{Math.round(settings.sfxVolume * 100)}%</output><input aria-label="効果音の大きさ" type="range" min="0" max="1" step="0.05" value={settings.sfxVolume} onChange={(event) => update("sfxVolume", Number(event.target.value))} /></span>
        </label>
        <label className="setting-row">
          <span className="setting-copy"><i aria-hidden="true">✦</i><span><strong>演出の強さ</strong><small>光と列車のリアクション</small></span></span>
          <span className="setting-control"><output>{Math.round(settings.effectsStrength * 100)}%</output><input aria-label="演出の強さ" type="range" min="0.25" max="1" step="0.05" value={settings.effectsStrength} onChange={(event) => update("effectsStrength", Number(event.target.value))} /></span>
        </label>
        <label className="toggle-row">
          <span className="setting-copy"><i aria-hidden="true">◐</i><span><strong>動きを少なくする</strong><small>背景の動きと点滅を抑えます</small></span></span>
          <span className="toggle-control"><input aria-label="動きを少なくする" type="checkbox" checked={settings.reducedMotion} onChange={(event) => update("reducedMotion", event.target.checked)} /><i aria-hidden="true" /></span>
        </label>
      </div>
      <button className="secondary-command centered-command" type="button" onClick={onCalibration}>入力タイミングを調整</button>
    </main>
  );
}

interface CalibrationScreenProps {
  audio: AudioEngine;
  settings: GameSettings;
  onChange: (settings: GameSettings) => void;
  onBack: () => void;
}

export function CalibrationScreen({ audio, settings, onChange, onBack }: CalibrationScreenProps) {
  const [audioPreparing, setAudioPreparing] = useState(false);
  const [audioMessage, setAudioMessage] = useState("");
  const audioPreparingRef = useRef(false);

  const playSample = async () => {
    if (audioPreparingRef.current) return;
    audioPreparingRef.current = true;
    setAudioPreparing(true);
    setAudioMessage("確認音を準備しています…");
    try {
      await audio.prepare(settings);
      audio.previewBeat();
      setAudioMessage("音が鳴ったよ。光と合う位置を確かめてね");
    } catch {
      setAudioMessage("音の準備ができなかったよ。もう一度ためしてね");
    } finally {
      audioPreparingRef.current = false;
      setAudioPreparing(false);
    }
  };

  return (
    <main className="panel-screen calibration-screen">
      <div className="screen-topline">
        <button className="back-button" type="button" onClick={onBack}>戻る</button>
        <span>タイミング調整</span>
        <span />
      </div>
      <section className="calibration-content">
        <div className="calibration-dial">
          <span className="dial-minus">早</span>
          <i style={{ transform: `rotate(${(settings.timingOffsetMs / 180) * 68}deg)` }} />
          <strong>{settings.timingOffsetMs > 0 ? "+" : ""}{settings.timingOffsetMs} ms</strong>
          <span className="dial-plus">遅</span>
        </div>
        <div>
          <p className="eyebrow">TIMING OFFSET</p>
          <h1>音と光が合う位置にしよう</h1>
          <p>タップがいつも早めならプラス、遅めならマイナスへ少しずつ動かします</p>
          <input
            className="offset-slider"
            aria-label="入力タイミング補正"
            type="range"
            min="-180"
            max="180"
            step="5"
            value={settings.timingOffsetMs}
            onChange={(event) => onChange({ ...settings, timingOffsetMs: Number(event.target.value) })}
          />
          {audioMessage && <p className="calibration-audio-message" role="status" aria-live="polite">{audioMessage}</p>}
          <div className="calibration-actions">
            <button className="secondary-command" type="button" onClick={playSample} disabled={audioPreparing}>
              {audioPreparing ? "音を準備中…" : "確認音を鳴らす"}
            </button>
            <button className="primary-command" type="button" onClick={onBack}>この設定で決定</button>
          </div>
        </div>
      </section>
    </main>
  );
}

interface CollectionScreenProps {
  progress: ProgressData;
  onBack: () => void;
}

export function CollectionScreen({ progress, onBack }: CollectionScreenProps) {
  return (
    <main className="panel-screen collection-screen">
      <div className="screen-topline">
        <button className="back-button" type="button" onClick={onBack}>戻る</button>
        <span>コレクション</span>
        <span>{progress.stationStamps.length} STAMPS</span>
      </div>
      <section className="screen-heading compact-heading">
        <p className="eyebrow">YOUR JOURNEY</p>
        <h1>旅で出会った仲間たち</h1>
      </section>
      <section className="collection-section sticker-album-section" data-testid="sticker-album">
        <header><h2>おみやげシール帳</h2><strong>{progress.souvenirStickers.length}/{SOUVENIR_STICKERS.length}</strong></header>
        <p>列車に3回のると、シールを1まい発見！</p>
        <div className="sticker-album-grid">
          {SOUVENIR_STICKERS.map((sticker) => {
            const unlocked = progress.souvenirStickers.includes(sticker.id);
            return (
              <article className={"souvenir-sticker" + (unlocked ? " is-unlocked" : " is-locked")} style={{ "--sticker-color": sticker.color } as React.CSSProperties} key={sticker.id}>
                <span aria-hidden="true">{unlocked ? sticker.symbol : "?"}</span>
                <strong>{unlocked ? sticker.name : "ひみつ"}</strong>
                <small>{unlocked ? sticker.hint : "乗車券をためよう"}</small>
              </article>
            );
          })}
        </div>
      </section>
      <section className="collection-section">
        <h2>ビート列車</h2>
        <div className="collection-grid">
          {TRAIN_OPTIONS.map((train) => {
            const unlocked = progress.unlockedTrains.includes(train.id);
            return (
              <article className={"collection-item" + (unlocked ? "" : " is-locked")} key={train.id}>
                <span className="collection-train-bay" aria-hidden="true">
                  <span className="mini-train" style={{ "--train-color": unlocked ? train.color : "#87979a" } as React.CSSProperties}>
                    <i className="mini-cab" /><i className="mini-light" /><i className="mini-stripe" />
                    <i className="mini-wheel wheel-one" /><i className="mini-wheel wheel-two" />
                  </span>
                </span>
                <strong>{unlocked ? train.name : "未発見"}</strong>
                <small>{unlocked ? train.description : "新しい路線を完走しよう"}</small>
              </article>
            );
          })}
        </div>
      </section>
      <section className="collection-section">
        <h2>乗客と駅スタンプ</h2>
        <div className="passenger-strip">
          {progress.unlockedPassengers.length ? progress.unlockedPassengers.map((name) => <span key={name}>{name}</span>) : <p>最初の旅を完走すると、最初の仲間が乗車します</p>}
          {progress.stationStamps.map((stamp) => <span className="station-stamp" key={stamp}>{STAGES.find((stage) => stage.id === stamp)?.shortName}</span>)}
        </div>
      </section>
    </main>
  );
}

export function ParentsScreen({ onBack }: { onBack: () => void }) {
  return (
    <main className="panel-screen parents-screen">
      <div className="screen-topline">
        <button className="back-button" type="button" onClick={onBack}>戻る</button>
        <span>保護者の方へ</span>
        <span />
      </div>
      <section className="parents-content">
        <div>
          <p className="eyebrow">FOR FAMILIES</p>
          <h1>遊びながら、拍を感じる力を育てます</h1>
          <p>リズム・エクスプレスは、正解を暗記する学習アプリではありません。音を聞き、自分の操作で列車が変化する遊びの中で、一定のテンポ、休符、長い音、短いパターンを体験します</p>
        </div>
        <dl>
          <div><dt>途中終了なし</dt><dd>ミスしても列車は止まらず、曲の最後まで立て直せます</dd></div>
          <div><dt>広告・課金なし</dt><dd>外部API、ログイン、広告、ガチャを使用しません</dd></div>
          <div><dt>端末内保存</dt><dd>進捗と設定は、このブラウザのlocalStorageだけに保存します</dd></div>
          <div><dt>やさしい表現</dt><dd>失敗を責めず、次のリズムへ意識を戻せる言葉を使います</dd></div>
          <div><dt>走行中の発見</dt><dd>各路線に3つの短いサプライズがあります。見逃しても減点や取り逃しはありません</dd></div>
          <div><dt>休める区切り</dt><dd>3回遊ぶと「ひとやすみ駅」を表示します。連続記録や取り逃しはありません</dd></div>
        </dl>
      </section>
    </main>
  );
}

interface ResultScreenProps {
  stage: StageDefinition;
  difficulty: Difficulty;
  result: SessionResult;
  unlocked: string[];
  journeyReward: JourneyReward;
  onRetry: () => void;
  onMap: () => void;
}

export function ResultScreen({ stage, difficulty, result, unlocked, journeyReward, onRetry, onMap }: ResultScreenProps) {
  const goals = getRunGoals(stage, difficulty);
  const rewardSticker = journeyReward.stickerId ? getSouvenirSticker(journeyReward.stickerId) : undefined;
  const grade = result.accuracy >= 96 && result.missionStars === 3 ? "S+" : result.accuracy >= 92 ? "S" : result.accuracy >= 82 ? "A" : result.accuracy >= 68 ? "B" : "C";
  const difficultyOrder: Difficulty[] = ["easy", "normal", "challenge"];
  const currentIndex = difficultyOrder.indexOf(difficulty);
  const recommendedDifficulty =
    result.accuracy >= 88 && currentIndex < difficultyOrder.length - 1
      ? difficultyOrder[currentIndex + 1]
      : result.accuracy < 68 && currentIndex > 0
        ? difficultyOrder[currentIndex - 1]
        : difficulty;
  const recommendation =
    recommendedDifficulty === difficulty
      ? `次も「${DIFFICULTIES[difficulty].name}」で、好きなリズムをもっとのばそう`
      : result.accuracy >= 88
        ? `次は「${DIFFICULTIES[recommendedDifficulty].name}」にもチャレンジできそう！`
        : `次は「${DIFFICULTIES[recommendedDifficulty].name}」でリズムをつかもう`;
  return (
    <main className={"result-screen result-" + stage.theme} data-testid="result-screen">
      <section className="arrival-banner">
        <p>ARRIVED</p>
        <h1>{stage.destination}</h1>
        <span>{result.message}</span>
      </section>
      <section className="result-body">
        <section className={"ticket-reward-card" + (journeyReward.completedCard ? " is-complete" : "")} data-testid="journey-reward">
          <header><span>わくわく乗車券</span><strong>スタンプ GET!</strong></header>
          <TicketStamps filled={journeyReward.stampPosition} />
          {rewardSticker ? (
            <div className="sticker-reveal" style={{ "--sticker-color": rewardSticker.color } as React.CSSProperties}>
              <span aria-hidden="true">{rewardSticker.symbol}</span>
              <span><small>シール発見！</small><strong>{rewardSticker.name}</strong></span>
            </div>
          ) : journeyReward.completedCard ? (
            <div className="album-complete-message"><strong>シール帳コンプリート！</strong><small>きみは伝説のリズム運転士！</small></div>
          ) : (
            <p>あと <strong>{STAMPS_PER_STICKER - journeyReward.stampPosition}</strong> 回のると、ひみつシールが出てくるよ</p>
          )}
        </section>
        <div className="result-grade" aria-label={"リズム評価 " + grade}>
          <span className="result-stars" aria-hidden="true">
            {[0, 1, 2].map((index) => <i className={index < (result.accuracy >= 90 ? 3 : result.accuracy >= 70 ? 2 : 1) ? "is-filled" : ""} key={index}>★</i>)}
          </span>
          <span>{grade}</span>
          <small>RHYTHM RANK</small>
        </div>
        <div className="result-metrics">
          <article><span>リズム精度</span><strong>{result.accuracy}%</strong></article>
          <article><span>最大コンボ</span><strong>{result.maxCombo}</strong></article>
          <article><span>テンポ安定性</span><strong>{result.stability}%</strong></article>
          <article><span>Quiet成功</span><strong>{result.quietSuccess}/{result.quietTotal}</strong></article>
          <article><span>長押し成功</span><strong>{result.beamSuccess}/{result.beamTotal}</strong></article>
          <article><span>連打成功</span><strong>{result.boosterSuccess}/{result.boosterTotal}</strong></article>
        </div>
        <section className="result-mission-board" aria-label={`路線ミッション ${result.missionStars}/3達成`}>
          <header><span>MISSION CLEAR</span><strong>★ {result.missionStars}/3</strong></header>
          <div>
            {goals.map((goal) => {
              const complete = result.completedGoalIds.includes(goal.id);
              return (
                <article className={complete ? "is-complete" : ""} key={goal.id}>
                  <i aria-hidden="true">{complete ? "★" : "◇"}</i>
                  <span><strong>{goal.label}</strong><small>{complete ? "クリア！" : goal.description}</small></span>
                </article>
              );
            })}
          </div>
        </section>
        <div className="result-drive-summary">
          <span>最高FLOW <strong>×{result.flowPeak.toFixed(2)}</strong></span>
          <span>FLOW DRIVE <strong>{result.driveActivations}回</strong></span>
          {result.switchTotal > 0 && <span>分岐成功 <strong>{result.switchSuccess}/{result.switchTotal}</strong></span>}
        </div>
        <aside className="result-recommendation">
          <span>つぎのおすすめ</span>
          <strong>{recommendation}</strong>
        </aside>
        <div className="timing-tendency">
          <span>早め {result.earlyPercent}%</span>
          <div><i style={{ width: result.earlyPercent + "%" }} /><b /><i style={{ width: result.latePercent + "%" }} /></div>
          <span>遅め {result.latePercent}%</span>
        </div>
        {journeyReward.completedCard && (
          <aside className="rest-station">
            <span aria-hidden="true">☕</span>
            <span><strong>ひとやすみ駅</strong><small>シールを見つけたよ。ここで休んでも、つづきはちゃんと残っているよ</small></span>
          </aside>
        )}
        {unlocked.length > 0 && (
          <div className="unlock-banner">
            <strong>新しい列車と仲間を発見しました</strong>
            <span>{unlocked.join("・")}</span>
          </div>
        )}
        <div className="result-actions">
          <button className="secondary-command" type="button" onClick={onMap}>ワールドマップ</button>
          <button className="primary-command" type="button" onClick={onRetry}>もう一度走る</button>
        </div>
      </section>
    </main>
  );
}
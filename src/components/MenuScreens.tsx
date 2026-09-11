"use client";

import { useEffect, useRef, useState } from "react";
import { AttractCanvas } from "./ExpeditionCanvas";
import { routeArtwork } from "../game/presentation";
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
      <button className="brand-button" type="button" onClick={onHome} aria-label="タイトルへ もどる">
        <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
        <span>リズム・エクスプレス</span>
      </button>
      <div className="header-actions">
        <span className="stamp-count" aria-label={"えきスタンプ " + progress.stationStamps.length + "こ"}>
          <span className="stamp-dots" aria-hidden="true">
            {STAGES.map((stage) => (
              <i className={progress.stationStamps.includes(stage.id) ? "is-filled" : ""} key={stage.id} />
            ))}
          </span>
          <span className="stamp-label">★ あつめた {masteryStars}/{MAX_MISSION_STARS}</span>
        </span>
        <button className="icon-text-button" type="button" onClick={onSettings} aria-label="せってい">
          <span className="settings-glyph" aria-hidden="true"><i /><i /><i /></span>
          <span>せってい</span>
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
  onSelectStage: (stage: StageTheme) => void;
  onTutorial: () => void;
  onCollection: () => void;
  onSettings: () => void;
  onParents: () => void;
}

export function TitleScreen({
  progress,
  onStart,
  onSelectStage,
  onTutorial,
  onCollection,
  onSettings,
  onParents,
}: TitleScreenProps) {
  const ticketFilled = journeyTicketFilled(progress.journeyCount);
  const nextStickerIn = journeysUntilNextSticker(progress.journeyCount);
  return (
    <main className="title-screen expedition-title">
      <AttractCanvas />
      <div className="title-vignette" aria-hidden="true" />
      <section className="title-copy">
        <p className="eyebrow"><span className="status-light" /> きみが うんてんし</p>
        <h1><span>リズム・</span><span>エクスプレス</span></h1>
        <p className="title-subtitle">おとに のって、まだ みぬ せかいへ。</p>
        <div className="title-actions">
          <button className="primary-command large-command" type="button" onClick={onStart} data-testid="start-adventure">
            <span>{progress.journeyCount ? "まちへ しゅっぱつ" : "はじめて はしる"}</span><i aria-hidden="true">→</i>
          </button>
          <button className="secondary-command" type="button" onClick={onTutorial}>
            あそびかた
          </button>
        </div>
        <div className="kid-first-guide"><span aria-hidden="true">♪</span><strong>ひかりが ○に きたら、おす！</strong></div>
      </section>
      <section className="departure-board" aria-label="いきさきを えらぶ">
        <header><span>つぎの たびを えらぼう</span><span>★ {totalMissionStars(progress)}<small> / {MAX_MISSION_STARS}</small></span></header>
        <div className="departure-routes">
          {STAGES.map((route) => (
            <button type="button" key={route.id} onClick={() => onSelectStage(route.id)} className={"departure-route route-" + route.id}>
              <span className="route-thumbnail" style={{ backgroundImage: `url(${routeArtwork(route.id)})` }} aria-hidden="true" />
              <span><small>0{route.order} · {Math.round(route.duration)}びょう</small><strong>{route.shortName}</strong><em>{progress.stationStamps.includes(route.id) ? "★ はしった コース" : "あたらしい けしき"}</em></span>
              <i aria-hidden="true">↗</i>
            </button>
          ))}
        </div>
        <footer><span>おみやげシールまで あと {nextStickerIn}かい</span><TicketStamps filled={ticketFilled} /></footer>
      </section>
      <nav className="title-utility" aria-label="そのほかのメニュー">
        <button type="button" onClick={onCollection}>シールずかん</button>
        <button type="button" onClick={onSettings}>せってい</button>
        <button type="button" onClick={onParents}>おうちのひとへ</button>
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
      title: "ひかりが ○に かさなったら おす",
      body: "○に ぴったり かさなったら、したの「おす！」を タップ",
      type: "spark",
    },
    {
      title: "ながい ひかりは おしたまま",
      body: "ひかりの はじめから おわりまで、おしたまま",
      type: "beam",
    },
    {
      title: "「しずかに」は おやすみ",
      body: "「しずかに」が きたら、おとを きいて まとう",
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
    setPracticeMessage("おとの じゅんびが できなかったよ。もう いちど タップしてね");
  };

  const tryBeat = async () => {
    const attempt = beginAudioPreparation();
    if (attempt === null) return;
    setPracticeMessage("おとを じゅんびしているよ…");
    try {
      await audio.prepare(settings);
      if (attempt !== practiceAttemptRef.current) return;
      audio.previewBeat();
      finishPractice("できた！ ひかりと おとが かさなったね");
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
    setPracticeMessage("おとを じゅんびちゅう。そのまま おしていてね…");
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
      setPracticeMessage(audioPreparingRef.current ? "おとの じゅんびが おわったら、もう いちど ながおししてね" : "もう いちど、ながおししてみよう");
      return;
    }
    beamAudioReady.current = false;
    if (heldFor >= 650) {
      audio.previewBeat();
      finishPractice("ながおし できた！ はじめと おわりが わかったね");
    } else {
      setPracticeState("idle");
      setPracticeMessage("もう すこしだけ、ながく おしてみよう");
    }
  };

  const startQuiet = async () => {
    if (practiceState === "waiting") return;
    const attempt = beginAudioPreparation();
    if (attempt === null) return;
    clearPracticeTimer();
    setPracticeMessage("おとを じゅんびしているよ…");
    try {
      await audio.prepare(settings);
      if (attempt !== practiceAttemptRef.current) return;
      setPracticeState("waiting");
      setPracticeMessage("いまは おさずに、3はく まとう…");
      audio.previewBeat();
      practiceTimer.current = window.setTimeout(() => {
        audio.previewBeat();
        finishPractice("まてた！ おやすみも リズムだね");
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
        <button className="back-button" type="button" onClick={onBack}>もどる</button>
        <span>あそびかた</span>
        <span>{step + 1}/3</span>
      </div>
      <section className="tutorial-content">
        <div className={"tutorial-demo demo-" + steps[step].type + (pulse ? " is-hit" : "") + " practice-" + practiceState}>
          <div className="demo-track" />
          <div className="demo-gate" />
          <div className="demo-note" />
        </div>
        <div className="tutorial-instruction">
          <p className="eyebrow">れんしゅう {step + 1}</p>
          <h2>{steps[step].title}</h2>
          <p>{steps[step].body}</p>
          {step === 0 && (
            <button className="practice-pad" type="button" onClick={tryBeat} disabled={audioPreparing}>
              {audioPreparing ? "おとを じゅんびちゅう…" : "ひかりに あわせて おす！"}
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
              {audioPreparing ? "おとを じゅんびちゅう…" : practiceState === "holding" ? "そのまま おして！" : "ここを ながおし"}
            </button>
          )}
          {step === 2 && (
            <button className="practice-pad" type="button" onClick={startQuiet} disabled={practiceState === "waiting" || audioPreparing}>
              {audioPreparing ? "おとを じゅんびちゅう…" : practiceState === "waiting" ? "おさずに まってね…" : "3はく まつ れんしゅう"}
            </button>
          )}
          <p className={"practice-message practice-" + practiceState} aria-live="polite">{practiceMessage}</p>
        </div>
      </section>
      <div className="screen-footer-actions">
        {step > 0 && <button className="secondary-command" type="button" onClick={() => changeStep(step - 1)} disabled={audioPreparing}>ひとつ まえ</button>}
        {step < 2 ? (
          <button className="primary-command" type="button" onClick={() => changeStep(step + 1)} disabled={audioPreparing}>つぎへ</button>
        ) : (
          <button className="primary-command" type="button" onClick={onComplete} disabled={audioPreparing}>コースを えらぶ</button>
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
        <p className="eyebrow">いきさきを えらぼう</p>
        <h1>つぎは どこへ はしる？</h1>
        <p>3つの せかいで、ちがう リズムを みつけよう</p>
      </section>
      <aside className="journey-ticket-strip" aria-label={`あと${nextStickerIn}かいで おみやげシール`}>
        <span className="ticket-card-icon" aria-hidden="true">?</span>
        <span><small>つぎの シール</small><strong>あと {nextStickerIn} かいで おみやげシール</strong></span>
        <TicketStamps filled={ticketFilled} />
      </aside>
      <div className="route-line" aria-hidden="true" />
      <section className="stage-grid" aria-label="コースの いちらん">
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
              <span className="stage-scene" style={{ backgroundImage: `url(${routeArtwork(stage.id)})` }} aria-hidden="true" />
              <span className="stage-copy">
                <strong>{stage.name}</strong>
                <small>テンポ {stage.bpm}・やく {stage.duration}びょう</small>
                <span>{stage.description}</span>
              </span>
              <span className="stage-record">
                <span><b>★ {mastery}/9</b><small>{record ? `いちばん ${record.bestAccuracy}%` : "はじめて！"}</small></span>
                <i aria-hidden="true">→</i>
              </span>
            </button>
          );
        })}
      </section>
      <div className="map-tools">
        <button className="secondary-command" type="button" onClick={onCollection}>シールずかん</button>
        <button className="secondary-command" type="button" onClick={onCalibration}>おとと ひかりを あわせる</button>
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
        <button className="back-button" type="button" onClick={onBack}>コース</button>
        <span>{stage.name}</span>
        <span>テンポ {stage.bpm}</span>
      </div>
      <div className="route-preview" style={{ backgroundImage: `url(${routeArtwork(stage.id)})` }}>
        <span>0{stage.order} / {stage.shortName}</span><strong>{stage.destination}へ</strong><small>やく {Math.round(stage.duration)}びょうの たび</small>
      </div>
      <nav className="journey-steps" aria-label="しゅっぱつまで">
        <span className="is-done"><i aria-hidden="true">✓</i>コース</span>
        <span className="is-current">おねがい</span>
        <span>しゅっぱつ</span>
      </nav>
      <section className="screen-heading compact-heading">
        <p className="eyebrow">むずかしさ</p>
        <h1>どれに する？</h1>
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
      <button className="primary-command large-command centered-command dispatch-start-command" type="button" onClick={onStart}>
        この コースへ しゅっぱつ！ →
      </button>
      <details className="dispatch-details"><summary>れっしゃと おねがいを みる</summary>
      <section className="dispatch-board">
        <div className="mission-brief">
          <div className="dispatch-section-title"><span>3つの おねがい</span><strong>クリアした ★ {earnedStars}/3</strong></div>
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
          <div className="dispatch-section-title"><span>れっしゃを えらぶ</span><strong>すきな のうりょく</strong></div>
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
                  <span><strong>{unlocked ? train.name : "まだ みつけていない"}</strong><small>{unlocked ? train.perkShort : "コースを ゴールして みつけよう"}</small></span>
                </button>
              );
            })}
          </div>
        </div>
      </section>
      </details>
      <aside className="note-legend" aria-label="でてくる マーク">
        <span><i className="legend-spark" />タップ</span>
        <span><i className="legend-beam" />ながく おす</span>
        {stage.order >= 2 && <span><i className="legend-booster" />れんだ</span>}
        {stage.order >= 2 && <span><i className="legend-quiet" />まつ</span>}
        {stage.order >= 3 && selected !== "easy" && <span><i className="legend-switch" />ひだり・みぎ</span>}
      </aside>
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
        <span>れっしゃ</span>
        <span>{progress.unlockedTrains.length}/4</span>
      </div>
      <nav className="journey-steps" aria-label="しゅっぱつまで">
        <span className="is-done"><i aria-hidden="true">✓</i>コース</span>
        <span className="is-done"><i aria-hidden="true">✓</i>むずかしさ</span>
        <span className="is-current">れっしゃ</span>
      </nav>
      <section className="screen-heading compact-heading">
        <p className="eyebrow">れっしゃを えらぶ</p>
        <h1>きょうの れっしゃを えらぼう</h1>
      </section>
      <button className="primary-command large-command centered-command train-depart-command" type="button" onClick={onStart} data-testid="depart-stage">
        この れっしゃで しゅっぱつ！
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
              <strong>{unlocked ? train.name : "まだ みつけていない"}</strong>
              <small>{unlocked ? `${train.description}｜${train.perk}` : "コースを ゴールすると あえるよ"}</small>
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
        <button className="back-button" type="button" onClick={onBack}>もどる</button>
        <span>せってい</span>
        <span />
      </div>
      <section className="screen-heading compact-heading">
        <p className="eyebrow">せってい</p>
        <h1>あそびやすく しよう</h1>
      </section>
      <div className="settings-list">
        <label className="setting-row">
          <span className="setting-copy"><i aria-hidden="true">♪</i><span><strong>おんがくの おおきさ</strong><small>コースの おんがく</small></span></span>
          <span className="setting-control"><output>{Math.round(settings.musicVolume * 100)}%</output><input aria-label="おんがくの おおきさ" type="range" min="0" max="1" step="0.05" value={settings.musicVolume} onChange={(event) => update("musicVolume", Number(event.target.value))} /></span>
        </label>
        <label className="setting-row">
          <span className="setting-copy"><i aria-hidden="true">●</i><span><strong>おす おとの おおきさ</strong><small>きみが ひく メロディー</small></span></span>
          <span className="setting-control"><output>{Math.round(settings.sfxVolume * 100)}%</output><input aria-label="おす おとの おおきさ" type="range" min="0" max="1" step="0.05" value={settings.sfxVolume} onChange={(event) => update("sfxVolume", Number(event.target.value))} /></span>
        </label>
        <label className="setting-row">
          <span className="setting-copy"><i aria-hidden="true">✦</i><span><strong>ひかりの つよさ</strong><small>ひかりと れっしゃの うごき</small></span></span>
          <span className="setting-control"><output>{Math.round(settings.effectsStrength * 100)}%</output><input aria-label="ひかりの つよさ" type="range" min="0.25" max="1" step="0.05" value={settings.effectsStrength} onChange={(event) => update("effectsStrength", Number(event.target.value))} /></span>
        </label>
        <label className="toggle-row">
          <span className="setting-copy"><i aria-hidden="true">◐</i><span><strong>うごきを すくなく</strong><small>うしろの うごきと ピカピカを へらす</small></span></span>
          <span className="toggle-control"><input aria-label="うごきを すくなく" type="checkbox" checked={settings.reducedMotion} onChange={(event) => update("reducedMotion", event.target.checked)} /><i aria-hidden="true" /></span>
        </label>
      </div>
      <button className="secondary-command centered-command" type="button" onClick={onCalibration}>おとと ひかりを あわせる</button>
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
    setAudioMessage("おとを じゅんびしているよ…");
    try {
      await audio.prepare(settings);
      audio.previewBeat();
      setAudioMessage("おとが なったよ。ひかりと いっしょか たしかめてね");
    } catch {
      setAudioMessage("おとの じゅんびが できなかったよ。もう いちど ためしてね");
    } finally {
      audioPreparingRef.current = false;
      setAudioPreparing(false);
    }
  };

  return (
    <main className="panel-screen calibration-screen">
      <div className="screen-topline">
        <button className="back-button" type="button" onClick={onBack}>もどる</button>
        <span>おとと ひかり</span>
        <span />
      </div>
      <section className="calibration-content">
        <div className="calibration-dial">
          <span className="dial-minus">はやい</span>
          <i style={{ transform: `rotate(${(settings.timingOffsetMs / 180) * 68}deg)` }} />
          <strong>{settings.timingOffsetMs > 0 ? "+" : ""}{settings.timingOffsetMs} ms</strong>
          <span className="dial-plus">おそい</span>
        </div>
        <div>
          <p className="eyebrow">おす タイミング</p>
          <h1>おとと ひかりを いっしょに しよう</h1>
          <p>いつも はやい／おそい ときに、すこしずつ うごかそう</p>
          <input
            className="offset-slider"
            aria-label="おす タイミング"
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
              {audioPreparing ? "おとを じゅんびちゅう…" : "おとを ならす"}
            </button>
            <button className="primary-command" type="button" onClick={onBack}>これで オッケー！</button>
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
        <button className="back-button" type="button" onClick={onBack}>もどる</button>
        <span>コレクション</span>
        <span>{progress.stationStamps.length}こ</span>
      </div>
      <section className="screen-heading compact-heading">
        <p className="eyebrow">あつめたもの</p>
        <h1>あつめた なかまたち</h1>
      </section>
      <section className="collection-section sticker-album-section" data-testid="sticker-album">
        <header><h2>おみやげ シールずかん</h2><strong>{progress.souvenirStickers.length}/{SOUVENIR_STICKERS.length}</strong></header>
        <p>れっしゃに 3かい のると、シールを 1まい みつけるよ！</p>
        <div className="sticker-album-grid">
          {SOUVENIR_STICKERS.map((sticker) => {
            const unlocked = progress.souvenirStickers.includes(sticker.id);
            return (
              <article className={"souvenir-sticker" + (unlocked ? " is-unlocked" : " is-locked")} style={{ "--sticker-color": sticker.color } as React.CSSProperties} key={sticker.id}>
                <span aria-hidden="true">{unlocked ? sticker.symbol : "?"}</span>
                <strong>{unlocked ? sticker.name : "ひみつ"}</strong>
                <small>{unlocked ? sticker.hint : "きっぷを ためよう"}</small>
              </article>
            );
          })}
        </div>
      </section>
      <section className="collection-section">
        <h2>ビート れっしゃ</h2>
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
                <strong>{unlocked ? train.name : "まだ ひみつ"}</strong>
                <small>{unlocked ? train.description : "あたらしい コースを ゴールしよう"}</small>
              </article>
            );
          })}
        </div>
      </section>
      <section className="collection-section">
        <h2>なかまと えきスタンプ</h2>
        <div className="passenger-strip">
          {progress.unlockedPassengers.length ? progress.unlockedPassengers.map((name) => <span key={name}>{name}</span>) : <p>はじめの コースを ゴールすると、なかまが のってくるよ</p>}
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
        <button className="back-button" type="button" onClick={onBack}>もどる</button>
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
          <div><dt>走行中の発見</dt><dd>各路線に3つの短いお手伝いがあります。いつものリズム操作を3回合わせると達成できます。見逃しても減点はありません</dd></div>
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
  onNext: () => void;
}

export function ResultScreen({ stage, difficulty, result, unlocked, journeyReward, onRetry, onMap, onNext }: ResultScreenProps) {
  const goals = getRunGoals(stage, difficulty);
  const rewardSticker = journeyReward.stickerId ? getSouvenirSticker(journeyReward.stickerId) : undefined;
  const grade = result.accuracy >= 96 && result.missionStars === 3 ? "S+" : result.accuracy >= 92 ? "S" : result.accuracy >= 82 ? "A" : result.accuracy >= 68 ? "B" : "C";
  const gradeLabel = grade === "S+" ? "さいこう！" : grade === "S" ? "すごい！" : grade === "A" ? "いいね！" : "がんばった！";
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
      ? `つぎも「${DIFFICULTIES[difficulty].name}」で、すきな リズムを のばそう`
      : result.accuracy >= 88
        ? `つぎは「${DIFFICULTIES[recommendedDifficulty].name}」にも ちょうせん できそう！`
        : `つぎは「${DIFFICULTIES[recommendedDifficulty].name}」で リズムを つかもう`;
  return (
    <main className={"result-screen expedition-result result-" + stage.theme} data-testid="result-screen">
      <section className="arrival-banner" style={{ backgroundImage: `linear-gradient(0deg, #081b25, #081b2520), url(${routeArtwork(stage.id)})` }}>
        <p>とうちゃく！</p>
        <h1>{stage.destination}</h1>
        <span>{result.message}</span>
      </section>
      <section className="result-body">
        <section className={"ticket-reward-card" + (journeyReward.completedCard ? " is-complete" : "")} data-testid="journey-reward">
          <header><span>わくわく きっぷ</span><strong>スタンプ ゲット！</strong></header>
          <TicketStamps filled={journeyReward.stampPosition} />
          {rewardSticker ? (
            <div className="sticker-reveal" style={{ "--sticker-color": rewardSticker.color } as React.CSSProperties}>
              <span aria-hidden="true">{rewardSticker.symbol}</span>
              <span><small>シールを みつけた！</small><strong>{rewardSticker.name}</strong></span>
            </div>
          ) : journeyReward.completedCard ? (
            <div className="album-complete-message"><strong>シールを ぜんぶ あつめた！</strong><small>きみは でんせつの リズムうんてんし！</small></div>
          ) : (
            <p>あと <strong>{STAMPS_PER_STICKER - journeyReward.stampPosition}</strong> かい のると、ひみつシールが でてくるよ</p>
          )}
        </section>
        <div className="result-grade" aria-label={"リズムの けっか " + gradeLabel}>
          <span className="result-stars" aria-hidden="true">
            {[0, 1, 2].map((index) => <i className={index < (result.accuracy >= 90 ? 3 : result.accuracy >= 70 ? 2 : 1) ? "is-filled" : ""} key={index}>★</i>)}
          </span>
          <span>{gradeLabel}</span>
          <small>リズム ランク {grade}</small>
        </div>
        <div className="arrival-highlights">
          <span><small>てんすう</small><strong>{result.score.toLocaleString()}</strong></span>
          <span><small>つづけて できた</small><strong>{result.maxCombo}<em>かい</em></strong></span>
          <span><small>おねがい クリア</small><strong>★ {result.missionStars}<em>/3</em></strong></span>
        </div>
        <div className="result-actions">
          <button className="secondary-command" type="button" onClick={onRetry}>もう いちど はしる</button>
          <button className="primary-command" type="button" onClick={onNext}>{stage.order < 3 ? "つぎの けしきへ →" : "ほかの コースへ →"}</button>
        </div>
        <details className="result-details"><summary>くわしい きろくを みる</summary>
        <div className="result-metrics">
          <article><span>ぴったりど</span><strong>{result.accuracy}%</strong></article>
          <article><span>いちばん ながく</span><strong>{result.maxCombo}</strong></article>
          <article><span>おなじ テンポ</span><strong>{result.stability}%</strong></article>
          <article><span>しずかに できた</span><strong>{result.quietSuccess}/{result.quietTotal}</strong></article>
          <article><span>ながく おせた</span><strong>{result.beamSuccess}/{result.beamTotal}</strong></article>
          <article><span>れんだ できた</span><strong>{result.boosterSuccess}/{result.boosterTotal}</strong></article>
        </div>
        <section className="result-mission-board" aria-label={`3つの おねがい ${result.missionStars}/3 クリア`}>
          <header><span>おねがい クリア</span><strong>★ {result.missionStars}/3</strong></header>
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
          <span>いちばんの ノリ <strong>×{result.flowPeak.toFixed(2)}</strong></span>
          <span>スーパーそうこう <strong>{result.driveActivations}かい</strong></span>
          {result.switchTotal > 0 && <span>わかれみち <strong>{result.switchSuccess}/{result.switchTotal}</strong></span>}
        </div>
        <aside className="result-recommendation">
          <span>つぎのおすすめ</span>
          <strong>{recommendation}</strong>
        </aside>
        <div className="timing-tendency">
          <span>はやめ {result.earlyPercent}%</span>
          <div><i style={{ width: result.earlyPercent + "%" }} /><b /><i style={{ width: result.latePercent + "%" }} /></div>
          <span>おそめ {result.latePercent}%</span>
        </div>
        </details>
        {journeyReward.completedCard && (
          <aside className="rest-station">
            <span aria-hidden="true">☕</span>
            <span><strong>ひとやすみ えき</strong><small>シールを みつけたよ。ここで やすんでも、つづきは ちゃんと のこるよ</small></span>
          </aside>
        )}
        {unlocked.length > 0 && (
          <div className="unlock-banner">
            <strong>あたらしい れっしゃと なかまを みつけた！</strong>
            <span>{unlocked.join("・")}</span>
          </div>
        )}
        <button className="text-command result-map-link" type="button" onClick={onMap}>コースの いちらんへ</button>
      </section>
    </main>
  );
}

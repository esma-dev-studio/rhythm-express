"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GameCanvas } from "./ExpeditionCanvas";
import { getRhythmCue } from "../game/rhythmCue";
import { HAND_COLORS, handForAction, playModeFor } from "../game/handPlay";
import { rivalPointsAt } from "../game/rhythmRival";
import { AudioEngine } from "../game/engines/AudioEngine";
import { getTrain } from "../game/data/trains";
import { DIFFICULTIES } from "../game/engines/JudgementEngine";
import { EffectsManager, type EffectsSnapshot } from "../game/engines/EffectsManager";
import { GameSession } from "../game/engines/GameSession";
import { InputManager } from "../game/engines/InputManager";
import { getRunGoalProgress, getRunGoals } from "../game/runGoals";
import {
  getActiveAdventureEncounter,
  getAdventureEncounters,
  ENCOUNTER_TARGET,
  isEncounterRhythmHit,
  type AdventureEncounter,
} from "../game/adventureEvents";
import type {
  Difficulty,
  Direction,
  RhythmBest,
  GameAction,
  GameSettings,
  HitFeedback,
  SessionResult,
  StageDefinition,
} from "../game/types";
import { actionPulseAt, beatPosition } from "../game/musicScore";
import { HIT_LOOKS, HitFeedbackTimeline, type HitVisual } from "../game/hitFeedback";
import { observeMediaQuery, pointerEventsAvailable } from "../game/browserCompatibility";

interface GameScreenProps {
  stage: StageDefinition;
  difficulty: Difficulty;
  audioAnchorTime: number;
  audio: AudioEngine;
  settings: GameSettings;
  trainColor: string;
  trainId: string;
  rhythmBest?: RhythmBest;
  onComplete: (result: SessionResult) => void;
  onExit: () => void;
  onRestart: () => void;
}

type InputPointerEvent = React.PointerEvent<HTMLButtonElement>;
type InputTouchEvent = React.TouchEvent<HTMLButtonElement>;
type InputMouseEvent = React.MouseEvent<HTMLButtonElement>;
const MOUSE_INPUT_ID = -1;

function capturePointerSafely(event: InputPointerEvent): void {
  try {
    if (typeof event.currentTarget.setPointerCapture === "function") {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  } catch {
    // Safari can end a pointer before capture is established. Input still counts.
  }
}

function releasePointerSafely(event: InputPointerEvent): void {
  try {
    if (
      typeof event.currentTarget.hasPointerCapture === "function"
      && event.currentTarget.hasPointerCapture(event.pointerId)
    ) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  } catch {
    // The pointer may already have been released by iPadOS.
  }
}

export function GameScreen({
  stage,
  difficulty,
  audioAnchorTime,
  audio,
  settings,
  trainColor,
  trainId,
  rhythmBest,
  onComplete,
  onExit,
  onRestart,
}: GameScreenProps) {
  const playMode = playModeFor(settings);
  const duet = playMode === "duet";
  const session = useMemo(() => new GameSession(stage, difficulty, playMode), [stage, difficulty, playMode]);
  const effectsManager = useMemo(() => new EffectsManager(trainId), [trainId]);
  const goals = useMemo(() => getRunGoals(stage, difficulty), [stage, difficulty]);
  const encounters = useMemo(() => getAdventureEncounters(stage), [stage]);
  const selectedTrain = getTrain(trainId);
  const [playhead, setPlayhead] = useState(-2.5);
  const [effects, setEffects] = useState<EffectsSnapshot>(() => effectsManager.snapshot());
  const [feedback, setFeedback] = useState<HitFeedback | null>(null);
  const hitTimeline = useMemo(() => new HitFeedbackTimeline(), [session]);
  const [hitReceipt, setHitReceipt] = useState<HitVisual | null>(null);
  const [padReceipt, setPadReceipt] = useState<HitVisual | null>(null);
  const [handReceipts, setHandReceipts] = useState<Partial<Record<Direction, HitVisual>>>({});
  const [paused, setPaused] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [pausing, setPausing] = useState(false);
  const [silentPlayback, setSilentPlayback] = useState(audio.isSilent);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [routeLane, setRouteLane] = useState(0);
  const [activeEncounter, setActiveEncounter] = useState<AdventureEncounter | null>(null);
  const [encounterSuccess, setEncounterSuccess] = useState<AdventureEncounter | null>(null);
  const [completedEncounters, setCompletedEncounters] = useState(0);
  const [encounterHits, setEncounterHits] = useState(0);
  const encounterHitsRef = useRef(0);
  const lastUiFrame = useRef(0);
  const [systemReducedMotion, setSystemReducedMotion] = useState(false);
  const completedRef = useRef(false);
  const pausedRef = useRef(false);
  const startedRef = useRef(false);
  const feedbackTimer = useRef<number | null>(null);
  const encounterSuccessTimer = useRef<number | null>(null);
  const activeEncounterRef = useRef<AdventureEncounter | null>(null);
  const seenEncounterIdsRef = useRef<Set<string>>(new Set());
  const pauseInFlightRef = useRef(false);
  const resumeInFlightRef = useRef(false);
  const lastFallbackTouchAtRef = useRef(0);
  const activePointersRef = useRef<Record<GameAction, Set<number>>>({
    tap: new Set(),
    left: new Set(),
    right: new Set(),
    "pad-left": new Set(),
    "pad-right": new Set(),
  });
  const previousFrame = useRef(0);
  const pauseButtonRef = useRef<HTMLButtonElement>(null);
  const resumeButtonRef = useRef<HTMLButtonElement>(null);
  const pauseDialogRef = useRef<HTMLDivElement>(null);
  const hasPausedRef = useRef(false);
  const reducedMotion = settings.reducedMotion || systemReducedMotion;
  const hasSwitch = session.hasSwitch;

  useEffect(() => {
    return observeMediaQuery(
      "(prefers-reduced-motion: reduce)",
      setSystemReducedMotion,
    );
  }, []);

  useEffect(() => {
    session.start(audioAnchorTime, settings.timingOffsetMs);
    previousFrame.current = performance.now();
    startedRef.current = true;
    return () => {
      startedRef.current = false;
    };
  }, [audioAnchorTime, session, settings.timingOffsetMs]);

  const showFeedback = useCallback((next: HitFeedback | null, applyEffects = true, action?: GameAction) => {
    if (!next) return;
    if (applyEffects) effectsManager.apply(next);
    audio.feedback(next);
    const receipt = hitTimeline.record(next, session.playhead(audio.now()), session.stats.combo, action);
    if (receipt) {
      setHitReceipt(receipt);
      if (action === "tap") setPadReceipt(receipt);
      else if (receipt.kind === "miss") setPadReceipt(null);
      const hand = action && handForAction(action);
      if (hand) setHandReceipts(previous => ({ ...previous, [hand]: receipt }));
    }
    setFeedback(next);
    if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current);
    feedbackTimer.current = window.setTimeout(() => {
      setFeedback(null); setHitReceipt(null); setPadReceipt(null);
      setHandReceipts({});
    }, 760);
  }, [audio, effectsManager, hitTimeline, session]);

  const handleInput = useCallback((action: GameAction, isDown: boolean, eventTimeMs = performance.now()) => {
    if (!startedRef.current || pausedRef.current || completedRef.current) return;
    if (duet && (action === "left" || action === "right")) action = action === "left" ? "pad-left" : "pad-right";
    const result = session.input(action, isDown, audio.eventTimeToAudioTime(eventTimeMs));
    const encounter = activeEncounterRef.current;
    const now = session.playhead(audio.now());
    if (encounter && now >= encounter.startTime && now < encounter.startTime + encounter.duration && isEncounterRhythmHit(result)) {
      encounterHitsRef.current = Math.min(ENCOUNTER_TARGET, encounterHitsRef.current + 1);
      setEncounterHits(encounterHitsRef.current);
    }
    showFeedback(result, true, action);
    setScore(session.stats.score);
    setCombo(session.stats.combo);
    setRouteLane(session.routeLane);
  }, [audio, duet, session, showFeedback]);

  const beginPointerInput = useCallback((action: GameAction, event: InputPointerEvent) => {
    const activePointers = activePointersRef.current[action];
    if (!activePointers.has(event.pointerId)) {
      const wasInactive = activePointers.size === 0;
      activePointers.add(event.pointerId);
      if (wasInactive) handleInput(action, true, event.timeStamp);
    }
    capturePointerSafely(event);
  }, [handleInput]);

  const endPointerInput = useCallback((action: GameAction, event: InputPointerEvent) => {
    const activePointers = activePointersRef.current[action];
    const wasActive = activePointers.delete(event.pointerId);
    if (wasActive && activePointers.size === 0) {
      handleInput(action, false, event.timeStamp);
    }
    releasePointerSafely(event);
  }, [handleInput]);

  const beginTouchInput = useCallback((action: GameAction, event: InputTouchEvent) => {
    if (pointerEventsAvailable()) return;
    event.preventDefault();
    lastFallbackTouchAtRef.current = Date.now();
    const activePointers = activePointersRef.current[action];
    const wasInactive = activePointers.size === 0;
    for (let index = 0; index < event.changedTouches.length; index += 1) {
      const touch = event.changedTouches.item(index);
      if (touch) activePointers.add(touch.identifier);
    }
    if (wasInactive && activePointers.size > 0) {
      handleInput(action, true, event.timeStamp);
    }
  }, [handleInput]);

  const endTouchInput = useCallback((action: GameAction, event: InputTouchEvent) => {
    if (pointerEventsAvailable()) return;
    event.preventDefault();
    lastFallbackTouchAtRef.current = Date.now();
    const activePointers = activePointersRef.current[action];
    const wasActive = activePointers.size > 0;
    for (let index = 0; index < event.changedTouches.length; index += 1) {
      const touch = event.changedTouches.item(index);
      if (touch) activePointers.delete(touch.identifier);
    }
    if (wasActive && activePointers.size === 0) {
      handleInput(action, false, event.timeStamp);
    }
  }, [handleInput]);

  const beginMouseInput = useCallback((action: GameAction, event: InputMouseEvent) => {
    if (
      pointerEventsAvailable()
      || event.button !== 0
      || Date.now() - lastFallbackTouchAtRef.current < 900
    ) {
      return;
    }
    const activePointers = activePointersRef.current[action];
    if (!activePointers.has(MOUSE_INPUT_ID)) {
      activePointers.add(MOUSE_INPUT_ID);
      handleInput(action, true, event.timeStamp);
    }
  }, [handleInput]);

  const endMouseInput = useCallback((action: GameAction, event: InputMouseEvent) => {
    if (pointerEventsAvailable()) return;
    const activePointers = activePointersRef.current[action];
    if (activePointers.delete(MOUSE_INPUT_ID) && activePointers.size === 0) {
      handleInput(action, false, event.timeStamp);
    }
  }, [handleInput]);

  const clearActivePointers = useCallback(() => {
    Object.values(activePointersRef.current).forEach(pointers => pointers.clear());
  }, []);

  const readLivePlayhead = useCallback(() => session.playhead(audio.now()), [audio, session]);
  const readHitVisuals = useCallback((time: number) => hitTimeline.active(time), [hitTimeline]);

  const continueWithoutSound = useCallback((performanceNowMs?: number) => {
    audio.continueWithoutSound(performanceNowMs);
    setSilentPlayback(true);
  }, [audio]);

  useEffect(() => {
    const manager = new InputManager(handleInput);
    manager.attach();
    return () => manager.detach();
  }, [handleInput]);

  useEffect(() => {
    let frame = 0;
    const tick = (time: number) => {
      const delta = Math.min(0.05, (time - previousFrame.current) / 1000);
      previousFrame.current = time;
      if (!pausedRef.current && startedRef.current && !completedRef.current) {
        if (audio.hasClockStalled(time)) {
          continueWithoutSound(time);
        }
        const audioNow = audio.now();
        const current = session.playhead(audioNow);
        const refreshUi = time - lastUiFrame.current >= 1000 / 30;
        const nextEncounter = getActiveAdventureEncounter(
          encounters,
          current,
          seenEncounterIdsRef.current,
        );
        if (nextEncounter && activeEncounterRef.current?.id !== nextEncounter.id) {
          activeEncounterRef.current = nextEncounter;
          encounterHitsRef.current = 0;
          setEncounterHits(0);
          setActiveEncounter(nextEncounter);
        } else if (
          !nextEncounter
          && activeEncounterRef.current
          && current >= activeEncounterRef.current.startTime + activeEncounterRef.current.duration
        ) {
          seenEncounterIdsRef.current.add(activeEncounterRef.current.id);
          activeEncounterRef.current = null;
          setActiveEncounter(null);
        }
        const automaticFeedback = session.update(audioNow);
        for (const next of automaticFeedback) showFeedback(next);
        let nextEffects = effectsManager.tick(delta);
        if (duet && current >= 0 && nextEffects.driveReady && effectsManager.activateDrive()) {
          session.activateDrive();
          nextEffects = effectsManager.snapshot();
        }
        session.setDriveActive(nextEffects.overdrive);
        audio.setPerformance(session.stats.combo);
        audio.setDrive(nextEffects.overdrive);
        if (refreshUi) {
          setPlayhead(current);
          setScore(session.stats.score);
          setCombo(session.stats.combo);
          setEffects(nextEffects);
          lastUiFrame.current = time;
        }
        if (session.isComplete(current)) {
          completedRef.current = true;
          audio.stop();
          audio.arrival();
          onComplete({ ...session.result(), previousRhythmPoints: rhythmBest?.points });
          return;
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [audio, continueWithoutSound, duet, effectsManager, encounters, onComplete, rhythmBest, session, showFeedback]);

  const pauseGame = useCallback(async () => {
    if (pauseInFlightRef.current || pausedRef.current || completedRef.current) return;
    pauseInFlightRef.current = true;
    setPausing(true);
    try {
      session.protectHeldBeam(audio.now());
      session.pause(audio.now());
      setScore(session.stats.score);
      setCombo(session.stats.combo);
      pausedRef.current = true;
      clearActivePointers();
      setPaused(true);
      await audio.pause();
    } catch {
      continueWithoutSound();
    } finally {
      pauseInFlightRef.current = false;
      setPausing(false);
    }
  }, [audio, clearActivePointers, continueWithoutSound, session]);

  const cancelPointerInput = (action: GameAction, event: InputPointerEvent) => {
    if (activePointersRef.current[action].has(event.pointerId)) void pauseGame();
    releasePointerSafely(event);
  };
  const cancelTouchInput = (action: GameAction) => {
    if (!pointerEventsAvailable() && activePointersRef.current[action].size) void pauseGame();
  };

  const resumeGame = useCallback(async () => {
    if (!pausedRef.current || pauseInFlightRef.current || resumeInFlightRef.current) return;
    resumeInFlightRef.current = true;
    setResuming(true);
    try {
      await audio.resume();
      session.resume(audio.now());
      previousFrame.current = performance.now();
      pausedRef.current = false;
      setPaused(false);
    } catch {
      continueWithoutSound();
      session.resume(audio.now());
      previousFrame.current = performance.now();
      pausedRef.current = false;
      setPaused(false);
    } finally {
      resumeInFlightRef.current = false;
      setResuming(false);
    }
  }, [audio, continueWithoutSound, session]);

  const activateDrive = useCallback(() => {
    if (pausedRef.current || completedRef.current || !effectsManager.activateDrive()) return;
    session.activateDrive();
    session.setDriveActive(true);
    audio.setDrive(true);
    setEffects(effectsManager.snapshot());
    showFeedback({ label: "スーパーそうこう！ てんすう2ばい", energyDelta: 0 }, false);
  }, [audio, effectsManager, session, showFeedback]);

  const completeAdventureEncounter = useCallback(() => {
    const encounter = activeEncounterRef.current;
    if (
      !encounter
      || pausedRef.current
      || completedRef.current
      || seenEncounterIdsRef.current.has(encounter.id)
    ) {
      return;
    }
    seenEncounterIdsRef.current.add(encounter.id);
    activeEncounterRef.current = null;
    setActiveEncounter(null);
    session.addBonusScore(encounter.scoreBonus);
    setScore(session.stats.score);
    showFeedback({
      judgement: "perfect",
      noteType: "booster",
      label: encounter.successMessage + " +" + encounter.scoreBonus,
      energyDelta: encounter.energyBonus,
    });
    setEffects(effectsManager.snapshot());
    setCompletedEncounters((count) => count + 1);
    setEncounterSuccess(encounter);
    if (encounterSuccessTimer.current) window.clearTimeout(encounterSuccessTimer.current);
    encounterSuccessTimer.current = window.setTimeout(() => setEncounterSuccess(null), 1250);
  }, [effectsManager, session, showFeedback]);

  useEffect(() => {
    if (encounterHits >= ENCOUNTER_TARGET) completeAdventureEncounter();
  }, [encounterHits, completeAdventureEncounter]);

  useEffect(() => {
    const onPauseShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, select, textarea")) return;
      if (event.repeat) return;
      if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        activateDrive();
        return;
      }
      if (event.key !== "Escape" && event.key.toLowerCase() !== "p") return;
      event.preventDefault();
      if (pausedRef.current) void resumeGame();
      else void pauseGame();
    };
    document.addEventListener("keydown", onPauseShortcut);
    return () => document.removeEventListener("keydown", onPauseShortcut);
  }, [activateDrive, pauseGame, resumeGame]);

  useEffect(() => {
    const focusTimer = window.setTimeout(() => {
      if (paused && !pausing) {
        hasPausedRef.current = true;
        resumeButtonRef.current?.focus();
      } else if (hasPausedRef.current) {
        pauseButtonRef.current?.focus();
      }
    }, 0);
    return () => window.clearTimeout(focusTimer);
  }, [paused, pausing]);

  const trapPauseFocus = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const buttons = Array.from(
      pauseDialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [],
    );
    if (!buttons.length) return;
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && !pausedRef.current && startedRef.current) {
        void pauseGame().catch(() => undefined);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [pauseGame]);

  useEffect(() => () => {
    if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current);
    if (encounterSuccessTimer.current) window.clearTimeout(encounterSuccessTimer.current);
  }, []);

  const progress = Math.max(0, Math.min(1, playhead / stage.duration));
  const progressPercent = Math.round(progress * 100);
  const beatSeconds = 60 / stage.bpm;
  const countdown = playhead < 0 ? Math.min(4, Math.max(1, Math.ceil(-playhead / beatSeconds))) : 0;
  const goalProgress = getRunGoalProgress(goals, session.stats);
  const cue = getRhythmCue(session.chart.visible(playhead, DIFFICULTIES[difficulty].travelTime), playhead);
  const beat = beatPosition(playhead, stage.bpm);
  const scaledPulse = reducedMotion || paused ? 0 : Math.max(
    cue.mode === "rest" ? 0 : actionPulseAt(playhead, cue.time), effects.pulse * settings.effectsStrength,
  );
  const nextEvent = [...stage.events].reverse().find(event => event.time <= playhead);
  const rivalPoints = rhythmBest ? rivalPointsAt(rhythmBest.trace, playhead) : 0;
  const rhythmLead = session.rhythmPoints - rivalPoints;

  return (
    <main className={"game-screen expedition-game game-" + stage.theme + (duet ? " is-duet" : "") + (effects.overdrive ? " is-flow-drive" : "") + (reducedMotion ? " reduce-motion" : "")} data-testid="game-screen">
      <div className="game-hud" inert={paused}>
        <div className="hud-route">
          <span>{stage.name}</span>
          <strong><i aria-hidden="true" />{stage.destination}</strong>
          {silentPlayback && <small className="silent-mode-badge">おとなし</small>}
        </div>
        <div className="hud-progress-cluster">
          <div className="hud-progress" aria-label={"ゴールまで " + progressPercent + "%"}>
            <i style={{ width: progressPercent + "%" }} />
            <b style={{ left: `calc(${progressPercent}% - 6px)` }} aria-hidden="true" />
          </div>
          <span>あと {Math.max(0, Math.ceil(stage.duration - Math.max(0, playhead)))}びょう</span>
        </div>
        <div className={"hud-score" + (combo >= 5 ? " has-combo" : "")}>
          <span>てんすう <strong>{score.toLocaleString()}</strong></span>
          <span>つづいた <strong>{combo}</strong></span>
          <span className="music-band-level" aria-label={"おとの あつみ " + (audio.bandLevel + 1)}>
            おとの あつみ <strong>{["♪", "♪ ♪", "♪ ♪ ♪"][audio.bandLevel]}</strong>
          </span>
        </div>
        <button ref={pauseButtonRef} className="pause-button" type="button" onClick={pauseGame} disabled={pausing} aria-label="ちょっと やすむ">Ⅱ</button>
      </div>

      <div className="game-stage" inert={paused}>
        {duet && <div className={"rhythm-rival" + (rhythmLead > 0 ? " is-ahead" : "")}>
          <span>リズムてん <strong>{session.rhythmPoints.toLocaleString()}</strong></span>
          <small>{rhythmBest ? rhythmLead > 0 ? `まえの じぶんより +${rhythmLead}` : rhythmLead === 0 ? "まえの じぶんと おなじ！" : `まえの じぶんまで あと ${-rhythmLead}` : "はじめの きろくを つくろう"}</small>
          <i className="rival-track" aria-hidden="true"><b style={{ width: `${Math.min(100, session.rhythmPoints / Math.max(100, rhythmBest?.points ?? session.rhythmPoints) * 100)}%` }} /></i>
        </div>}
        <GameCanvas
          stage={stage}
          session={session}
          getPlayhead={readLivePlayhead}
          getHitVisuals={readHitVisuals}
          travelTime={DIFFICULTIES[difficulty].travelTime}
          effects={effects}
          reducedMotion={reducedMotion}
          effectsStrength={settings.effectsStrength}
          routeLane={routeLane}
          trainColor={trainColor}
        />
        <div className={"scenery-caption" + (hitReceipt ? " behind-hit" : "")}><small>0{stage.order} / {stage.shortName}</small><strong>{nextEvent?.target ?? "まもなく しゅっぱつ"}</strong></div>
        <div className="run-mission-strip" aria-label="3つの おねがい">
          <span className="run-train-perk">{selectedTrain.perkShort}</span>
          {goalProgress.map((goal) => (
            <span className={"mission-pill" + (goal.complete ? " is-complete" : "")} key={goal.id}>
              <i aria-hidden="true">{goal.complete ? "★" : "◇"}</i>
              <span>{goal.label}</span>
              <strong>{goal.valueLabel}</strong>
              <b style={{ "--goal-progress": goal.progress } as React.CSSProperties} aria-hidden="true" />
            </span>
          ))}
        </div>
        {!activeEncounter && !encounterSuccess && <div className="discovery-count">みつけた ★ {completedEncounters}/{encounters.length}</div>}
        {activeEncounter && (
          <section className={"rhythm-encounter encounter-" + stage.id} aria-live="polite">
            <div className="encounter-character" aria-hidden="true">{activeEncounter.icon}</div>
            <div className="encounter-copy">
              <small>リズムで おてつだい</small>
              <strong>{activeEncounter.title}</strong>
              <span>いつもの ボタンで {ENCOUNTER_TARGET}かい あわせよう</span>
            </div>
            <div className="encounter-beats" aria-label={`${encounterHits}/${ENCOUNTER_TARGET}`}>
              {Array.from({ length: ENCOUNTER_TARGET }, (_, i) => <i key={i} className={i < encounterHits ? "is-filled" : ""} aria-hidden="true">{i < encounterHits ? "★" : "○"}</i>)}
            </div>
          </section>
        )}
        {encounterSuccess && (
          <div className={"encounter-celebration celebration-" + stage.id} aria-live="polite">
            <span aria-hidden="true">{encounterSuccess.icon}</span>
            <strong>{encounterSuccess.successMessage}</strong>
            <small>+750 てん　+18 パワー</small>
            <i aria-hidden="true">★</i><i aria-hidden="true">●</i><i aria-hidden="true">◆</i>
          </div>
        )}
        {hitReceipt ? (
          <div key={hitReceipt.id} className={"hit-receipt hit-" + hitReceipt.kind}
            style={{ "--hit-color": HIT_LOOKS[hitReceipt.kind].color } as React.CSSProperties}
            data-testid="hit-receipt">
            <div className="hit-receipt-main">
              <i aria-hidden="true">{HIT_LOOKS[hitReceipt.kind].symbol}</i>
              <strong>{hitReceipt.title}</strong>
            </div>
            <small>{hitReceipt.hint}</small>
            {hitReceipt.combo >= 2 && <span className={"hit-chain" + (hitReceipt.combo % 5 === 0 ? " is-milestone" : "")}>
              <b>{hitReceipt.combo}</b> つづいた！
            </span>}
          </div>
        ) : feedback && (
          <div className={"hit-feedback judgement-" + (feedback.judgement ?? "hint")}>
            <strong>{feedback.label}</strong>
            {feedback.deltaMs !== undefined && feedback.judgement !== "miss" && (
              <small>{feedback.performance ? "♪ きみの おと" : "リズムが つながった"}{feedback.judgement === "perfect" ? "　ぴったり！" : feedback.deltaMs < 0 ? "　すこし はやめ" : "　すこし おそめ"}</small>
            )}
          </div>
        )}
        {countdown > 0 && (
          <div className="countdown-overlay" aria-live="assertive">
            <span>{countdown}</span>
            <small>{duet ? "← あおは ひだり　ピンクは みぎ →" : "きみが メロディーを ひくよ！"}<br />あと {countdown} はく。おとを きこう</small>
          </div>
        )}
      </div>

      <p id="beat-timing-help" className="sr-only">
        ひかりが ○に ぴったり かさなったら おす。ながい ひかりは おしたまま。
      </p>
      {duet ? <div className="duet-controls" aria-label="りょうてで あそぶ ボタン" inert={paused}>
        <div className="duet-instruction"><span>○に きたら おす</span><span>{effects.overdrive ? "★ スーパーそうこう！" : "← ひだり　・　みぎ →"}</span></div>
        {(["left", "right"] as const).map(hand => {
          const action: GameAction = hand === "left" ? "pad-left" : "pad-right";
          const receipt = handReceipts[hand];
          const activeReceipt = receipt && playhead - receipt.time <= .7 ? receipt : undefined;
          const expected = cue.hand === hand;
          return <button key={hand} type="button" className={"hand-pad hand-" + hand + (expected ? " is-next" : "")}
            style={{ "--hand-color": HAND_COLORS[hand], "--beat-pulse": expected ? scaledPulse : 0 } as React.CSSProperties}
            data-testid={"hand-" + hand} data-game-input="true" aria-describedby="beat-timing-help"
            aria-label={hand === "left" ? "あおの ひだり" : "ピンクの みぎ"}
            onPointerDown={event => beginPointerInput(action, event)} onPointerUp={event => endPointerInput(action, event)}
            onPointerCancel={event => cancelPointerInput(action, event)} onLostPointerCapture={event => cancelPointerInput(action, event)}
            onTouchStart={event => beginTouchInput(action, event)} onTouchEnd={event => endTouchInput(action, event)} onTouchCancel={() => cancelTouchInput(action)}
            onMouseDown={event => beginMouseInput(action, event)} onMouseUp={event => endMouseInput(action, event)} onMouseLeave={event => endMouseInput(action, event)}
            onContextMenu={event => event.preventDefault()}>
            <span className="hand-symbol" aria-hidden="true">{hand === "left" ? "←" : "→"}</span>
            <span className="hand-copy"><strong>{hand === "left" ? "ひだり" : "みぎ"}</strong><small>{expected ? cue.action : cue.mode === "rest" ? "おやすみ" : hand === "left" ? "あおの おと" : "ピンクの おと"}</small></span>
            {activeReceipt && <span key={activeReceipt.id} className={"hand-judgement hit-" + activeReceipt.kind} style={{ "--hit-color": HIT_LOOKS[activeReceipt.kind].color } as React.CSSProperties}>
              <b>{HIT_LOOKS[activeReceipt.kind].symbol}</b><small>{activeReceipt.title}</small>
            </span>}
          </button>;
        })}
      </div> : <div className={"touch-controls" + (hasSwitch ? "" : " beat-only")} aria-label="あそぶ ボタン" inert={paused}>
        <button
          type="button"
          className="direction-pad"
          onPointerDown={(event) => beginPointerInput("left", event)}
          onPointerUp={(event) => endPointerInput("left", event)}
          onPointerCancel={(event) => endPointerInput("left", event)}
          onLostPointerCapture={(event) => endPointerInput("left", event)}
          onTouchStart={(event) => beginTouchInput("left", event)}
          onTouchEnd={(event) => endTouchInput("left", event)}
          onTouchCancel={(event) => endTouchInput("left", event)}
          onMouseDown={(event) => beginMouseInput("left", event)}
          onMouseUp={(event) => endMouseInput("left", event)}
          onMouseLeave={(event) => endMouseInput("left", event)}
          aria-label="ひだりへ きりかえる"
          data-game-input="true"
        >
          ←
        </button>
        <button
          type="button"
          className={"beat-pad cue-" + cue.mode}
          style={{ "--beat-pulse": scaledPulse } as React.CSSProperties}
          onPointerDown={(event) => beginPointerInput("tap", event)}
          onPointerUp={(event) => endPointerInput("tap", event)}
          onPointerCancel={(event) => endPointerInput("tap", event)}
          onLostPointerCapture={(event) => endPointerInput("tap", event)}
          onTouchStart={(event) => beginTouchInput("tap", event)}
          onTouchEnd={(event) => endTouchInput("tap", event)}
          onTouchCancel={(event) => endTouchInput("tap", event)}
          onMouseDown={(event) => beginMouseInput("tap", event)}
          onMouseUp={(event) => endMouseInput("tap", event)}
          onMouseLeave={(event) => endMouseInput("tap", event)}
          onContextMenu={(event) => event.preventDefault()}
          aria-label="ひかりに あわせて おす。ながい ひかりは ながおし"
          aria-describedby="beat-timing-help"
          data-game-input="true"
          data-testid="beat-pad"
        >
          {padReceipt && <span key={padReceipt.id} className={"pad-impact hit-" + padReceipt.kind} aria-hidden="true"
            style={{ "--hit-color": HIT_LOOKS[padReceipt.kind].color } as React.CSSProperties}>
            <b>{HIT_LOOKS[padReceipt.kind].symbol}</b>
          </span>}
          <span className="music-beat-dots" aria-hidden="true">
            {[0, 1, 2, 3].map(index => <i key={index} className={!paused && index === beat.index ? "is-beat" : ""}>{index + 1}</i>)}
          </span>
          <span><i aria-hidden="true" /> {cue.action}</span>
          <small>{cue.mode === "release" ? "おとを のばして… ○で はなす" : cue.mode === "repeat" ? "トン トンで メロディー！" : cue.mode === "rest" ? "おとも ひとやすみ" : "○で おすと メロディーに！"}</small>
        </button>
        <button
          type="button"
          className="direction-pad"
          onPointerDown={(event) => beginPointerInput("right", event)}
          onPointerUp={(event) => endPointerInput("right", event)}
          onPointerCancel={(event) => endPointerInput("right", event)}
          onLostPointerCapture={(event) => endPointerInput("right", event)}
          onTouchStart={(event) => beginTouchInput("right", event)}
          onTouchEnd={(event) => endTouchInput("right", event)}
          onTouchCancel={(event) => endTouchInput("right", event)}
          onMouseDown={(event) => beginMouseInput("right", event)}
          onMouseUp={(event) => endMouseInput("right", event)}
          onMouseLeave={(event) => endMouseInput("right", event)}
          aria-label="みぎへ きりかえる"
          data-game-input="true"
        >
          →
        </button>
        <div className="drive-dock">
          <button className={"drive-command" + (effects.driveReady ? " is-ready" : "") + (effects.overdrive ? " is-active" : "")} type="button" onClick={activateDrive} disabled={!effects.driveReady}>
            <span>{effects.overdrive ? "スーパー！" : effects.driveReady ? "スーパー！" : "パワー"}</span>
            <small>{effects.overdrive ? `${Math.ceil(effects.overdriveRemaining)}びょう` : effects.driveReady ? "おして はっしん" : `${Math.round(effects.energy)}/80`}</small>
            <i className="drive-charge"><b style={{ width: `${Math.min(100, effects.driveProgress * 100)}%` }} /></i>
          </button>
        </div>
      </div>}

      <p className="keyboard-hint">
        {duet ? "パソコンなら A・L または ←・→　P: やすむ" : hasSwitch ? "スペース: おす　← →: みち　F: スーパー　P: やすむ" : "スペース: おす　F: スーパー　P: やすむ"}
      </p>

      {paused && (
        <div ref={pauseDialogRef} className="pause-overlay" role="dialog" aria-modal="true" aria-label="おやすみ ちゅう" onKeyDown={trapPauseFocus}>
          <section>
            <p className="eyebrow">ひとやすみ</p>
            <h2>れっしゃは おやすみちゅう</h2>
            <p>{pausing ? "おとを とめているよ…" : "じゅんびが できたら、ここから つづけるよ"}</p>
            <button ref={resumeButtonRef} className="primary-command" type="button" onClick={resumeGame} disabled={pausing || resuming}>
              {pausing ? "おとを とめているよ…" : resuming ? "おとを つなぎなおしているよ…" : "つづきから あそぶ"}
            </button>
            <button className="secondary-command" type="button" onClick={onRestart} disabled={pausing || resuming}>
              はじめから あそぶ
            </button>
            <button className="text-command" type="button" onClick={onExit} disabled={pausing || resuming}>
              コースを えらぶ
            </button>
          </section>
        </div>
      )}
    </main>
  );
}

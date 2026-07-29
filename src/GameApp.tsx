"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GameScreen } from "./components/GameScreen";
import {
  AppHeader,
  CalibrationScreen,
  CollectionScreen,
  DifficultyScreen,
  ParentsScreen,
  ResultScreen,
  SettingsScreen,
  TitleScreen,
  TutorialScreen,
  WorldScreen,
} from "./components/MenuScreens";
import { STAGES, getStage } from "./game/data/stages";
import { getTrain } from "./game/data/trains";
import { AudioEngine } from "./game/engines/AudioEngine";
import type { JourneyReward } from "./game/journeyRewards";
import {
  ProgressRepository,
  defaultProgress,
} from "./game/repository/ProgressRepository";
import type {
  Difficulty,
  GameSettings,
  ProgressData,
  SessionResult,
  StageDefinition,
  StageTheme,
} from "./game/types";

type Screen =
  | "title"
  | "tutorial"
  | "world"
  | "difficulty"
  | "game"
  | "result"
  | "collection"
  | "settings"
  | "calibration"
  | "parents";

interface GameRun {
  id: number;
  audioAnchorTime: number;
}

interface LaunchRequest {
  stage: StageDefinition;
  difficulty: Difficulty;
}

type LaunchStatus = "idle" | "preparing" | "error";

export default function GameApp() {
  const repository = useMemo(() => new ProgressRepository(), []);
  const [audio] = useState(() => new AudioEngine());

  const [progress, setProgress] = useState<ProgressData>(() => {
    if (typeof window === "undefined") return defaultProgress();
    return repository.load();
  });
  const [screen, setScreen] = useState<Screen>("title");
  const [collectionReturnScreen, setCollectionReturnScreen] = useState<Screen>("title");
  const [settingsReturnScreen, setSettingsReturnScreen] = useState<Screen>("title");
  const [calibrationReturnScreen, setCalibrationReturnScreen] = useState<Screen>("world");
  const [selectedStage, setSelectedStage] = useState<StageTheme>("city");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [gameRun, setGameRun] = useState<GameRun | null>(null);
  const [lastResult, setLastResult] = useState<SessionResult | null>(null);
  const [lastUnlocks, setLastUnlocks] = useState<string[]>([]);
  const [lastJourneyReward, setLastJourneyReward] = useState<JourneyReward | null>(null);
  const runCounter = useRef(0);
  const launchInFlightRef = useRef(false);
  const pendingLaunchRef = useRef<LaunchRequest | null>(null);
  const retryLaunchButtonRef = useRef<HTMLButtonElement>(null);
  const [launchStatus, setLaunchStatus] = useState<LaunchStatus>("idle");

  const stage = getStage(selectedStage);

  const saveProgress = (next: ProgressData) => {
    setProgress(next);
    repository.save(next);
    audio.setVolumes(next.settings.musicVolume, next.settings.sfxVolume);
  };

  const startJourney = async () => {
    const firstStage = getStage("city");
    setSelectedStage("city");
    setDifficulty("easy");
    if (!progress.seenTutorial || progress.selectedTrain !== "sunrise") {
      saveProgress({ ...progress, seenTutorial: true, selectedTrain: "sunrise" });
    }
    await launchGame(firstStage, "easy");
  };

  const completeTutorial = () => {
    const next = { ...progress, seenTutorial: true };
    saveProgress(next);
    setScreen("world");
  };

  const chooseStage = (stageId: StageTheme) => {
    setSelectedStage(stageId);
    setDifficulty(stageId === "city" ? "easy" : "normal");
    setScreen("difficulty");
  };

  const selectTrain = (trainId: string) => {
    saveProgress({ ...progress, selectedTrain: trainId });
  };

  const finishLaunch = (request: LaunchRequest, audioAnchorTime: number) => {
    runCounter.current += 1;
    setSelectedStage(request.stage.id);
    setDifficulty(request.difficulty);
    setGameRun({ id: runCounter.current, audioAnchorTime });
    setLastResult(null);
    setLastJourneyReward(null);
    pendingLaunchRef.current = null;
    setLaunchStatus("idle");
    setScreen("game");
  };

  const launchGame = async (stageToLaunch: StageDefinition = stage, difficultyToLaunch: Difficulty = difficulty) => {
    if (launchInFlightRef.current) return;

    const request = { stage: stageToLaunch, difficulty: difficultyToLaunch };
    pendingLaunchRef.current = request;
    launchInFlightRef.current = true;
    setLaunchStatus("preparing");

    try {
      const audioAnchorTime = await audio.start(request.stage, request.difficulty, progress.settings);
      if (!Number.isFinite(audioAnchorTime) || audioAnchorTime <= 0) {
        throw new Error("Audio engine returned an invalid start time");
      }
      finishLaunch(request, audioAnchorTime);
    } catch {
      audio.stop();
      setLaunchStatus("error");
    } finally {
      launchInFlightRef.current = false;
    }
  };

  const retryLaunch = () => {
    const request = pendingLaunchRef.current;
    if (request) void launchGame(request.stage, request.difficulty);
  };

  const launchWithoutSound = () => {
    const request = pendingLaunchRef.current;
    if (!request || launchInFlightRef.current) return;
    launchInFlightRef.current = true;
    setLaunchStatus("preparing");
    try {
      const audioAnchorTime = audio.startSilent(request.stage, request.difficulty);
      finishLaunch(request, audioAnchorTime);
    } catch {
      audio.stop();
      setLaunchStatus("error");
    } finally {
      launchInFlightRef.current = false;
    }
  };

  const dismissLaunchError = () => {
    pendingLaunchRef.current = null;
    setLaunchStatus("idle");
    if (screen === "game") {
      setGameRun(null);
      setScreen("world");
    }
  };

  useEffect(() => {
    if (launchStatus === "error") retryLaunchButtonRef.current?.focus();
  }, [launchStatus]);

  const completeGame = (result: SessionResult) => {
    const recorded = repository.recordResult(progress, selectedStage, difficulty, result);
    setProgress(recorded.progress);
    setLastUnlocks(recorded.unlocked);
    setLastJourneyReward(recorded.journeyReward);
    setLastResult(result);
    setScreen("result");
  };

  const leaveGame = () => {
    audio.stop();
    setGameRun(null);
    setScreen("world");
  };

  const openSettings = (from: Screen = screen) => {
    setSettingsReturnScreen(from);
    setScreen("settings");
  };

  const openCalibration = (from: Screen = screen) => {
    setCalibrationReturnScreen(from);
    setScreen("calibration");
  };

  const updateSettings = (settings: GameSettings) => {
    saveProgress({ ...progress, settings });
  };

  const goHome = () => {
    audio.stop();
    setScreen("title");
  };

  const showHeader = !["title", "game", "result"].includes(screen);

  return (
    <div className="app-shell" aria-busy={launchStatus === "preparing"}>
      <div className="app-main" inert={launchStatus !== "idle"}>
        {showHeader && (
        <AppHeader
          progress={progress}
          onHome={goHome}
          onSettings={() => openSettings(screen)}
        />
      )}

      {screen === "title" && (
        <TitleScreen
          progress={progress}
          onStart={startJourney}
          onTutorial={() => setScreen("tutorial")}
          onCollection={() => {
            setCollectionReturnScreen("title");
            setScreen("collection");
          }}
          onSettings={() => openSettings("title")}
          onParents={() => setScreen("parents")}
        />
      )}

      {screen === "tutorial" && (
        <TutorialScreen
          audio={audio}
          settings={progress.settings}
          onComplete={completeTutorial}
          onBack={goHome}
        />
      )}

      {screen === "world" && (
        <WorldScreen
          progress={progress}
          onSelect={chooseStage}
          onCollection={() => {
            setCollectionReturnScreen("world");
            setScreen("collection");
          }}
          onCalibration={() => openCalibration("world")}
        />
      )}

      {screen === "difficulty" && (
        <DifficultyScreen
          stage={stage}
          selected={difficulty}
          progress={progress}
          onSelect={setDifficulty}
          onSelectTrain={selectTrain}
          onStart={() => void launchGame()}
          onBack={() => setScreen("world")}
        />
      )}


      {screen === "game" && gameRun && (
        <GameScreen
          key={gameRun.id}
          stage={stage}
          difficulty={difficulty}
          audioAnchorTime={gameRun.audioAnchorTime}
          audio={audio}
          settings={progress.settings}
          trainColor={getTrain(progress.selectedTrain).color}
          trainId={progress.selectedTrain}
          onComplete={completeGame}
          onExit={leaveGame}
          onRestart={() => void launchGame()}
        />
      )}

      {screen === "result" && lastResult && lastJourneyReward && (
        <ResultScreen
          stage={stage}
          difficulty={difficulty}
          result={lastResult}
          unlocked={lastUnlocks}
          journeyReward={lastJourneyReward}
          onRetry={() => void launchGame()}
          onMap={() => setScreen("world")}
        />
      )}

      {screen === "collection" && (
        <CollectionScreen progress={progress} onBack={() => setScreen(collectionReturnScreen)} />
      )}

      {screen === "settings" && (
        <SettingsScreen
          settings={progress.settings}
          onChange={updateSettings}
          onCalibration={() => openCalibration("settings")}
          onBack={() => setScreen(settingsReturnScreen)}
        />
      )}

      {screen === "calibration" && (
        <CalibrationScreen
          audio={audio}
          settings={progress.settings}
          onChange={updateSettings}
          onBack={() => setScreen(calibrationReturnScreen)}
        />
      )}

      {screen === "parents" && <ParentsScreen onBack={goHome} />}

      <div className="sr-only" aria-live="polite">
        コースは {STAGES.length}こ。いまの がめんは {screen}
      </div>
      </div>

      {launchStatus !== "idle" && (
        <div
          className={"launch-overlay launch-" + launchStatus}
          role={launchStatus === "error" ? "alertdialog" : "dialog"}
          aria-modal="true"
          aria-labelledby="launch-dialog-title"
          aria-describedby="launch-dialog-description"
        >
          <section>
            {launchStatus === "preparing" ? (
              <>
                <span className="launch-spinner" aria-hidden="true"><i /><i /><i /></span>
                <p className="eyebrow">しゅっぱつ まえ</p>
                <h2 id="launch-dialog-title">おとと れっしゃを じゅんびちゅう</h2>
                <p id="launch-dialog-description">このまま すこし まってね</p>
              </>
            ) : (
              <>
                <span className="launch-warning" aria-hidden="true">!</span>
                <p className="eyebrow">もう いちど じゅんび</p>
                <h2 id="launch-dialog-title">おとの じゅんびが できなかったよ</h2>
                <p id="launch-dialog-description">おとが でないときは、もう いちど ためすか、おとなしで あそべるよ</p>
                <button ref={retryLaunchButtonRef} className="primary-command" type="button" onClick={retryLaunch}>もう いちど ためす</button>
                <button className="secondary-command" type="button" onClick={launchWithoutSound}>おとなしで あそぶ</button>
                <button className="text-command" type="button" onClick={dismissLaunchError}>いったん もどる</button>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
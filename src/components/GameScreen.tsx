"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getPuzzleById, getPuzzleForDate, PUZZLE_001 } from "@/data/puzzles";
import {
  buildBoard,
  calculateLaserPath,
  canPlaceMirror,
  cycleMirrorOrientation,
  getMirrorAt,
} from "@/lib/laserEngine";
import {
  createDefaultGameState,
  loadGameState,
  saveGameState,
  type SavedGameState,
} from "@/lib/gameStorage";
import type { MirrorPlacement, Puzzle } from "@/lib/puzzleTypes";
import { validateSequence, formatTime, getNumberTileStates } from "@/lib/validation";
import Board from "@/components/Board/Board";
import Header from "@/components/Header/Header";
import WarningBanner from "@/components/Header/WarningBanner";
import HowToPlayModal from "@/components/HowToPlayModal";
import PauseOverlay from "@/components/PauseOverlay";
import TargetCodeIntro from "@/components/Game/TargetCodeIntro";
import { useTimer } from "@/hooks/useTimer";
import { hasSeenTutorial, markTutorialSeen } from "@/lib/tutorialStorage";

const COMPLETION_NAV_DELAY_MS = 350;

function readSavedState(puzzleId: number, devReplay: boolean): SavedGameState {
  // Vetting only: /play?puzzle=N&replay=1 in development starts fresh. Never in production.
  if (devReplay) {
    return createDefaultGameState(puzzleId);
  }

  return loadGameState(puzzleId) ?? createDefaultGameState(puzzleId);
}

function resolvePuzzle(searchParams: URLSearchParams): Puzzle {
  if (process.env.NODE_ENV === "development") {
    const puzzleParam = searchParams.get("puzzle");
    if (puzzleParam !== null) {
      const id = Number(puzzleParam);
      return getPuzzleById(id) ?? PUZZLE_001;
    }
  }

  return getPuzzleForDate(new Date()) ?? PUZZLE_001;
}

function shouldShowTutorialOnLoad(saved: SavedGameState): boolean {
  if (hasSeenTutorial()) return false;
  if (saved.isViewingSolve || saved.isComplete) return false;
  return true;
}

export default function GameScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const puzzle = useMemo(() => resolvePuzzle(searchParams), [searchParams]);
  const devReplay =
    process.env.NODE_ENV === "development" &&
    searchParams.get("replay") === "1";
  const [saved] = useState(() => readSavedState(puzzle.id, devReplay));
  const [initialComplete] = useState(
    () => saved.isComplete && !saved.isViewingSolve
  );

  const [mirrors, setMirrors] = useState<MirrorPlacement[]>(saved.mirrors);
  const [isPaused, setIsPaused] = useState(saved.isPaused);
  const isViewingSolve = saved.isViewingSolve;
  const [savedComplete, setSavedComplete] = useState(saved.isComplete);
  const [completionSeconds, setCompletionSeconds] = useState<number | null>(
    saved.completionSeconds
  );
  const [pendingFirstPlay, setPendingFirstPlay] = useState(() =>
    shouldShowTutorialOnLoad(saved)
  );
  const [showHowToPlay, setShowHowToPlay] = useState(() =>
    shouldShowTutorialOnLoad(saved)
  );
  const shouldPlayCodeIntro = !isViewingSolve && !saved.isComplete;
  const [codeIntroComplete, setCodeIntroComplete] = useState(
    () => !shouldPlayCodeIntro
  );

  const initialSeconds =
    saved.isComplete && saved.completionSeconds !== null
      ? saved.completionSeconds
      : saved.elapsedSeconds;

  const laserResult = useMemo(
    () => calculateLaserPath(puzzle, mirrors),
    [puzzle, mirrors]
  );

  const validation = useMemo(
    () => validateSequence(puzzle.code, laserResult),
    [puzzle.code, laserResult]
  );

  const isComplete = savedComplete || validation.isComplete;

  const gameplayLocked =
    showHowToPlay || (shouldPlayCodeIntro && !codeIntroComplete);

  const { seconds } = useTimer({
    isPaused: isPaused || gameplayLocked,
    isComplete,
    initialSeconds,
    enabled: true,
  });

  const persistState = useCallback(
    (overrides: Partial<SavedGameState> = {}) => {
      const state: SavedGameState = {
        puzzleId: puzzle.id,
        mirrors: overrides.mirrors ?? mirrors,
        elapsedSeconds: overrides.elapsedSeconds ?? seconds,
        completionSeconds:
          overrides.completionSeconds !== undefined
            ? overrides.completionSeconds
            : completionSeconds,
        isComplete: overrides.isComplete ?? isComplete,
        isViewingSolve: overrides.isViewingSolve ?? isViewingSolve,
        isPaused: overrides.isPaused ?? isPaused,
      };

      saveGameState(state);
    },
    [
      puzzle.id,
      mirrors,
      seconds,
      completionSeconds,
      isComplete,
      isViewingSolve,
      isPaused,
    ]
  );

  useEffect(() => {
    persistState();
  }, [mirrors, seconds, isPaused, isViewingSolve, isComplete, persistState]);

  useEffect(() => {
    if (!validation.isComplete || savedComplete) return;

    setSavedComplete(true);
    setCompletionSeconds(seconds);
    markTutorialSeen();

    saveGameState({
      puzzleId: puzzle.id,
      mirrors,
      elapsedSeconds: seconds,
      completionSeconds: seconds,
      isComplete: true,
      isViewingSolve: false,
      isPaused,
    });
  }, [
    validation.isComplete,
    savedComplete,
    seconds,
    puzzle.id,
    mirrors,
    isPaused,
  ]);

  useEffect(() => {
    if (!initialComplete) return;
    router.replace("/complete");
  }, [initialComplete, router]);

  useEffect(() => {
    if (!savedComplete || isViewingSolve || initialComplete) return;

    const navTimer = window.setTimeout(() => {
      router.push("/complete");
    }, COMPLETION_NAV_DELAY_MS);

    return () => window.clearTimeout(navTimer);
  }, [savedComplete, isViewingSolve, initialComplete, router]);

  const board = useMemo(
    () => buildBoard(puzzle, mirrors),
    [puzzle, mirrors]
  );

  const { collectedKeys, incorrectKeys } = useMemo(
    () =>
      getNumberTileStates(puzzle.code, board, laserResult.visitedCells),
    [puzzle.code, board, laserResult.visitedCells]
  );

  const handleCellClick = useCallback(
    (x: number, y: number) => {
      if (isPaused || isComplete) return;

      const existing = getMirrorAt(mirrors, x, y);

      if (existing === null) {
        if (!canPlaceMirror(puzzle, mirrors, x, y)) return;
        setMirrors((prev) => [...prev, { x, y, orientation: "/" }]);
        return;
      }

      const nextOrientation = cycleMirrorOrientation(existing);
      if (nextOrientation === null) {
        setMirrors((prev) => prev.filter((m) => !(m.x === x && m.y === y)));
      } else {
        setMirrors((prev) =>
          prev.map((m) =>
            m.x === x && m.y === y
              ? { ...m, orientation: nextOrientation }
              : m
          )
        );
      }
    },
    [isPaused, isComplete, puzzle, mirrors]
  );

  const handleClearBoard = useCallback(() => {
    if (isComplete) return;
    setMirrors([]);
  }, [isComplete]);

  const handlePause = useCallback(() => {
    setIsPaused((p) => !p);
  }, []);

  const handleResume = useCallback(() => {
    setIsPaused(false);
  }, []);

  const handleHome = useCallback(() => {
    router.push("/");
  }, [router]);

  const handleRules = useCallback(() => {
    setShowHowToPlay(true);
  }, []);

  const handleHowToPlayConfirm = useCallback(() => {
    if (pendingFirstPlay) {
      markTutorialSeen();
      setPendingFirstPlay(false);
    }
    setShowHowToPlay(false);
  }, [pendingFirstPlay]);

  const handleHowToPlayClose = useCallback(() => {
    if (!pendingFirstPlay) {
      setShowHowToPlay(false);
    }
  }, [pendingFirstPlay]);

  const handleCodeIntroComplete = useCallback(() => {
    setCodeIntroComplete(true);
  }, []);

  const showVictoryLaser =
    validation.isComplete && laserResult.reachedFlag;

  const isFlagIncorrect =
    laserResult.reachedFlag &&
    validation.generatedSequence !== puzzle.code;

  const interactionsDisabled =
    isPaused || isComplete || gameplayLocked;

  const displaySeconds =
    isComplete && completionSeconds !== null ? completionSeconds : seconds;

  const displayTime = formatTime(displaySeconds);

  const codeIntroActive =
    shouldPlayCodeIntro && !codeIntroComplete && !showHowToPlay;

  const boardObscured =
    gameplayLocked || (isPaused && !isComplete);
  const contentDimClass = codeIntroActive
    ? "pointer-events-none opacity-[0.12]"
    : boardObscured
      ? "pointer-events-none opacity-40"
      : "opacity-100";
  const showPauseOverlay =
    isPaused && !isComplete && !gameplayLocked;

  const boardSlotRef = useRef<HTMLDivElement>(null);
  const [boardSlotHeight, setBoardSlotHeight] = useState<number | undefined>();

  useEffect(() => {
    const slot = boardSlotRef.current;
    if (!slot) return;

    const updateHeight = () => {
      setBoardSlotHeight(slot.clientHeight);
    };

    updateHeight();

    const observer = new ResizeObserver(updateHeight);
    observer.observe(slot);

    return () => observer.disconnect();
  }, []);

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-black">
      <Header
        time={displayTime}
        isPaused={isPaused}
        onHome={handleHome}
        onRules={handleRules}
        onPause={handlePause}
        onClear={handleClearBoard}
        disabled={isComplete || gameplayLocked}
      />

      <div className="flex min-h-0 flex-1 flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 md:pt-4">
        <div className="flex min-h-0 flex-1 flex-col items-center gap-3 md:gap-5">
          <div
            className={`shrink-0 transition-opacity duration-500 ${contentDimClass}`}
          >
            <h1 className="text-center text-2xl font-light tracking-[0.4em] text-white md:text-4xl">
              LATTICE
            </h1>
          </div>

          <TargetCodeIntro
            code={puzzle.code}
            isComplete={isComplete}
            playIntro={shouldPlayCodeIntro}
            introPaused={showHowToPlay}
            onIntroComplete={handleCodeIntroComplete}
          />

          <div
            ref={boardSlotRef}
            className={`flex min-h-0 w-full flex-1 items-start justify-center transition-opacity duration-500 ${contentDimClass}`}
          >
            <Board
              puzzle={puzzle}
              board={board}
              laserResult={laserResult}
              collectedNumberKeys={collectedKeys}
              incorrectNumberKeys={incorrectKeys}
              isFlagIncorrect={isFlagIncorrect}
              onCellClick={handleCellClick}
              disabled={interactionsDisabled}
              showVictoryLaser={showVictoryLaser}
              maxBoardHeight={boardSlotHeight}
            />
          </div>
        </div>

        <div
          className={`flex shrink-0 flex-col items-center transition-opacity duration-500 ${contentDimClass}`}
        >
          <p className="mt-3 text-center text-xs tracking-wider text-white/70 md:mt-6 md:text-sm">
            {isViewingSolve
              ? "Your solution — mirrors locked."
              : "Click empty cells to place mirrors. Click again to rotate or remove."}
          </p>

          {!isViewingSolve && (
            <WarningBanner message={validation.warningMessage} inline />
          )}
        </div>
      </div>

      <HowToPlayModal
        isOpen={showHowToPlay}
        onClose={handleHowToPlayClose}
        onConfirm={handleHowToPlayConfirm}
        overlayOnGame
        dismissOnBackdrop={!pendingFirstPlay}
      />

      <PauseOverlay isOpen={showPauseOverlay} onResume={handleResume} />
    </main>
  );
}

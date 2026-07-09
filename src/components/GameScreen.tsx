"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getPuzzleById, getPuzzleForDate, PUZZLE_001 } from "@/data/puzzles";
import { isPuzzleUnlocked } from "@/lib/archive";
import {
  buildBoard,
  calculateLaserPath,
  canPlaceMirror,
  cycleMirrorOrientation,
  getMirrorAt,
} from "@/lib/laserEngine";
import {
  createDefaultGameState,
  isPuzzleComplete,
  loadGameState,
  saveGameState,
  type GameMode,
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

function readSavedState(
  puzzleId: number,
  mode: GameMode,
  wantsReplay: boolean
): SavedGameState {
  // Practice replays and record-mode replays (dev vetting / replaying an
  // unsolved puzzle) both start from a clean board.
  if (mode === "practice" || wantsReplay) {
    return createDefaultGameState(puzzleId);
  }

  return loadGameState(puzzleId) ?? createDefaultGameState(puzzleId);
}

function resolvePuzzle(searchParams: URLSearchParams): Puzzle {
  const puzzleParam = searchParams.get("puzzle");
  if (puzzleParam !== null) {
    const id = Number(puzzleParam);
    // Dev vetting has unrestricted access. Production only unlocks puzzles
    // scheduled on or before today, so players cannot jump to future puzzles.
    if (process.env.NODE_ENV === "development") {
      return getPuzzleById(id) ?? PUZZLE_001;
    }
    if (isPuzzleUnlocked(id, new Date())) {
      return getPuzzleById(id) ?? getPuzzleForDate(new Date()) ?? PUZZLE_001;
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
  const wantsReplay = searchParams.get("replay") === "1";
  // Replaying a puzzle that already has a canonical solve runs as a practice
  // session — it never overwrites the recorded time.
  const [mode] = useState<GameMode>(() =>
    wantsReplay && isPuzzleComplete(puzzle.id) ? "practice" : "record"
  );
  const isPractice = mode === "practice";
  const [saved] = useState(() =>
    readSavedState(puzzle.id, mode, wantsReplay)
  );

  // Where to send the player on completion — preserve ?puzzle=N for archives,
  // and tag practice runs so the completion screen shows only Replay.
  const completeRoute = useMemo(() => {
    const dailyId = getPuzzleForDate(new Date())?.id;
    const base =
      puzzle.id === dailyId ? "/complete" : `/complete?puzzle=${puzzle.id}`;
    if (isPractice) {
      return `${base}${base.includes("?") ? "&" : "?"}practice=1`;
    }
    return base;
  }, [puzzle.id, isPractice]);
  const [initialComplete] = useState(
    () => saved.isComplete && !saved.isViewingSolve
  );

  const [mirrors, setMirrors] = useState<MirrorPlacement[]>(saved.mirrors);
  const [wrongNumberHits, setWrongNumberHits] = useState(saved.wrongNumberHits);
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
        wrongNumberHits: overrides.wrongNumberHits ?? wrongNumberHits,
      };

      saveGameState(state, mode);
    },
    [
      puzzle.id,
      mirrors,
      seconds,
      completionSeconds,
      isComplete,
      isViewingSolve,
      isPaused,
      wrongNumberHits,
      mode,
    ]
  );

  useEffect(() => {
    persistState();
  }, [
    mirrors,
    seconds,
    isPaused,
    isViewingSolve,
    isComplete,
    wrongNumberHits,
    persistState,
  ]);

  useEffect(() => {
    if (!validation.isComplete || savedComplete) return;

    setSavedComplete(true);
    setCompletionSeconds(seconds);
    markTutorialSeen();

    // Practice solves persist only to the throwaway practice slot — the
    // canonical record (and its shareable time) is never touched.
    saveGameState(
      {
        puzzleId: puzzle.id,
        mirrors,
        elapsedSeconds: seconds,
        completionSeconds: seconds,
        isComplete: true,
        isViewingSolve: false,
        isPaused,
        wrongNumberHits,
      },
      mode
    );
  }, [
    validation.isComplete,
    savedComplete,
    seconds,
    puzzle.id,
    mirrors,
    isPaused,
    wrongNumberHits,
    mode,
  ]);

  useEffect(() => {
    if (!initialComplete) return;
    router.replace(completeRoute);
  }, [initialComplete, router, completeRoute]);

  useEffect(() => {
    if (!savedComplete || isViewingSolve || initialComplete) return;

    // Same victory beat as the daily; practice runs land on a Replay-only
    // completion screen (completeRoute carries practice=1).
    const navTimer = window.setTimeout(() => {
      router.push(completeRoute);
    }, COMPLETION_NAV_DELAY_MS);

    return () => window.clearTimeout(navTimer);
  }, [savedComplete, isViewingSolve, initialComplete, router, completeRoute]);

  const board = useMemo(
    () => buildBoard(puzzle, mirrors),
    [puzzle, mirrors]
  );

  const { collectedKeys, incorrectKeys, correctPrefixLength } = useMemo(
    () =>
      getNumberTileStates(puzzle.code, board, laserResult.visitedCells),
    [puzzle.code, board, laserResult.visitedCells]
  );

  // Passive misroute tracking: count each number tile the laser collects out of
  // Target Code order at most once per session. Never decrements when mirrors
  // change — only reset on clear-board / a fresh (replay) session. Seeded on
  // first run so a mid-solve reload doesn't recount misroutes already persisted.
  const countedWrongKeysRef = useRef<Set<string>>(new Set());
  const wrongInitRef = useRef(false);

  useEffect(() => {
    if (!wrongInitRef.current) {
      wrongInitRef.current = true;
      countedWrongKeysRef.current = new Set(incorrectKeys);
      return;
    }

    let newlyWrong = 0;
    for (const cellKey of incorrectKeys) {
      if (!countedWrongKeysRef.current.has(cellKey)) {
        countedWrongKeysRef.current.add(cellKey);
        newlyWrong += 1;
      }
    }
    if (newlyWrong > 0) {
      setWrongNumberHits((count) => count + newlyWrong);
    }
  }, [incorrectKeys]);

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
    // Clearing the board resets the session misroute counter.
    setWrongNumberHits(0);
    countedWrongKeysRef.current = new Set();
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
  const [boardSlotSize, setBoardSlotSize] = useState<{
    width?: number;
    height?: number;
  }>({});

  useEffect(() => {
    const slot = boardSlotRef.current;
    if (!slot) return;

    const updateSize = () => {
      setBoardSlotSize({
        width: slot.clientWidth,
        height: slot.clientHeight,
      });
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
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
            collectedDigitCount={correctPrefixLength}
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
              maxBoardWidth={boardSlotSize.width}
              maxBoardHeight={boardSlotSize.height}
            />
          </div>
        </div>

        <div
          className={`flex shrink-0 flex-col items-center transition-opacity duration-500 ${contentDimClass}`}
        >
          <p className="mt-3 text-center text-xs tracking-wider text-white/70 md:mt-6 md:text-sm">
            {isViewingSolve
              ? "Your solution — mirrors locked."
              : "Click on laser to place mirror to redirect it. Click again to rotate or remove mirror. Lasers may intersect each other."}
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

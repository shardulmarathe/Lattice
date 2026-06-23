"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
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
import { validateSequence, formatTime } from "@/lib/validation";
import Board from "@/components/Board/Board";
import Header from "@/components/Header/Header";
import WarningBanner from "@/components/Header/WarningBanner";
import { useTimer } from "@/hooks/useTimer";

const CompletionModal = dynamic(
  () => import("@/components/CompletionModal/CompletionModal"),
  { ssr: false }
);

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

export default function GameScreen() {
  const searchParams = useSearchParams();
  const puzzle = useMemo(() => resolvePuzzle(searchParams), [searchParams]);
  const devReplay =
    process.env.NODE_ENV === "development" &&
    searchParams.get("replay") === "1";
  const [saved] = useState(() => readSavedState(puzzle.id, devReplay));

  const [mirrors, setMirrors] = useState<MirrorPlacement[]>(saved.mirrors);
  const [isPaused, setIsPaused] = useState(saved.isPaused);
  const [showCompletionModal, setShowCompletionModal] = useState(
    saved.isComplete && !saved.isViewingSolve
  );
  const [isViewingSolve, setIsViewingSolve] = useState(saved.isViewingSolve);
  const [savedComplete, setSavedComplete] = useState(saved.isComplete);
  const [completionSeconds, setCompletionSeconds] = useState<number | null>(
    saved.completionSeconds
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

  const { seconds } = useTimer({
    isPaused,
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
    setShowCompletionModal(true);

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

  const board = useMemo(
    () => buildBoard(puzzle, mirrors),
    [puzzle, mirrors]
  );

  const collectedSet = useMemo(() => {
    const targetDigits = puzzle.code.split("").map(Number);
    const collected: Set<number> = new Set();
    let matchIndex = 0;
    for (const num of laserResult.collectedNumbers) {
      if (matchIndex < targetDigits.length && num === targetDigits[matchIndex]) {
        collected.add(num);
        matchIndex++;
      }
    }
    return collected;
  }, [laserResult.collectedNumbers, puzzle.code]);

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
    if (isPaused || isComplete) return;
    setMirrors([]);
  }, [isPaused, isComplete]);

  const handleSeeSolve = useCallback(() => {
    setShowCompletionModal(false);
    setIsViewingSolve(true);
    persistState({ isViewingSolve: true });
  }, [persistState]);

  const handlePause = useCallback(() => {
    setIsPaused((p) => !p);
  }, []);

  const interactionsDisabled = isPaused || isComplete;

  const displaySeconds =
    isComplete && completionSeconds !== null ? completionSeconds : seconds;

  const displayTime = formatTime(displaySeconds);

  return (
    <main className="flex min-h-screen flex-col bg-black">
      <Header
        time={displayTime}
        isPaused={isPaused}
        onPause={handlePause}
        onClear={handleClearBoard}
        disabled={isComplete}
      />

      <div className="flex flex-1 flex-col items-center justify-center px-4 pb-8 pt-4">
        <h1 className="mb-2 text-center text-3xl font-light tracking-[0.4em] text-white md:text-4xl">
          LATTICE
        </h1>

        <p className="mb-8 text-center text-lg tracking-wider text-white md:text-2xl">
          Target Code:{" "}
          <span className="font-mono text-white">{puzzle.code}</span>
        </p>

        <Board
          puzzle={puzzle}
          board={board}
          laserResult={laserResult}
          collectedNumbers={collectedSet}
          onCellClick={handleCellClick}
          disabled={interactionsDisabled}
        />

        <p className="mt-6 text-center text-sm tracking-wider text-white/70">
          {isViewingSolve
            ? "Your solution — mirrors locked."
            : "Click empty cells to place mirrors. Click again to rotate or remove."}
        </p>

        {!isViewingSolve && (
          <WarningBanner message={validation.warningMessage} inline />
        )}
      </div>

      {isComplete && showCompletionModal && (
        <CompletionModal
          puzzleId={puzzle.id}
          timeSeconds={displaySeconds}
          onSeeSolve={handleSeeSolve}
        />
      )}
    </main>
  );
}

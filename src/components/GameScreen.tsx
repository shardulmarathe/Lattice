"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PUZZLE_001 } from "@/data/puzzles";
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
import type { MirrorPlacement } from "@/lib/puzzleTypes";
import { validateSequence, formatTime } from "@/lib/validation";
import Board from "@/components/Board/Board";
import CompletionModal from "@/components/CompletionModal/CompletionModal";
import Header from "@/components/Header/Header";
import WarningBanner from "@/components/Header/WarningBanner";
import { useTimer } from "@/hooks/useTimer";

export default function GameScreen() {
  const puzzle = PUZZLE_001;
  const [isLoaded, setIsLoaded] = useState(false);
  const [mirrors, setMirrors] = useState<MirrorPlacement[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [isViewingSolve, setIsViewingSolve] = useState(false);
  const [savedComplete, setSavedComplete] = useState(false);
  const [initialSeconds, setInitialSeconds] = useState(0);
  const [completionSeconds, setCompletionSeconds] = useState<number | null>(null);

  useEffect(() => {
    const saved = loadGameState(puzzle.id) ?? createDefaultGameState(puzzle.id);

    setMirrors(saved.mirrors);
    setIsPaused(saved.isPaused);
    setSavedComplete(saved.isComplete);
    setIsViewingSolve(saved.isViewingSolve);
    setInitialSeconds(
      saved.isComplete && saved.completionSeconds !== null
        ? saved.completionSeconds
        : saved.elapsedSeconds
    );
    setCompletionSeconds(saved.completionSeconds);

    if (saved.isComplete && !saved.isViewingSolve) {
      setShowCompletionModal(true);
    }

    setIsLoaded(true);
  }, [puzzle.id]);

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
    enabled: isLoaded,
  });

  const persistState = useCallback(
    (overrides: Partial<SavedGameState> = {}) => {
      if (!isLoaded) return;

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
      isLoaded,
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
    if (!isLoaded) return;
    persistState();
  }, [isLoaded, mirrors, seconds, isPaused, isViewingSolve, isComplete, persistState]);

  useEffect(() => {
    if (!isLoaded || !validation.isComplete || savedComplete) return;

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
    isLoaded,
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

  if (!isLoaded) {
    return <main className="min-h-screen bg-black" />;
  }

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

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
  puzzleSignature,
  saveGameState,
  type GameMode,
  type SavedGameState,
} from "@/lib/gameStorage";
import type { MirrorPlacement, Puzzle } from "@/lib/puzzleTypes";
import { validateSequence, formatTime, getNumberTileStates } from "@/lib/validation";
import { getPuzzleSolution } from "@/lib/puzzleSolutions";
import { applyHint, getNextHint } from "@/lib/hints";
import Board from "@/components/Board/Board";
import Header from "@/components/Header/Header";
import WarningBanner from "@/components/Header/WarningBanner";
import HowToPlayModal from "@/components/HowToPlayModal";
import PauseOverlay from "@/components/PauseOverlay";
import TargetCodeIntro from "@/components/Game/TargetCodeIntro";
import { useTimer } from "@/hooks/useTimer";
import { useDailyRollover } from "@/hooks/useDailyRollover";
import { hasSeenTutorial, markTutorialSeen } from "@/lib/tutorialStorage";
import {
  duck,
  play,
  playDigit,
  setBeamActive,
  setBeamState,
} from "@/lib/audio/engine";
import { armVictoryResolve } from "@/lib/audio/victoryHandoff";

const COMPLETION_NAV_DELAY_MS = 350;

function readSavedState(
  puzzle: Puzzle,
  mode: GameMode,
  wantsReplay: boolean
): SavedGameState {
  // Practice replays and record-mode replays (dev vetting / replaying an
  // unsolved puzzle) both start from a clean board.
  if (mode === "practice" || wantsReplay) {
    return createDefaultGameState(puzzle);
  }

  return loadGameState(puzzle) ?? createDefaultGameState(puzzle);
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
  // A tab left open overnight has yesterday's puzzle frozen in the memo above.
  // Deliberately not `atMidnight`, a solve running at 23:59 is never yanked;
  // the swap waits until the player leaves the tab and comes back.
  useDailyRollover({
    enabled: searchParams.get("puzzle") === null,
    destination: "/play",
  });
  // Replaying a puzzle that already has a canonical solve runs as a practice
  // session, it never overwrites the recorded time.
  const [mode] = useState<GameMode>(() =>
    wantsReplay && isPuzzleComplete(puzzle) ? "practice" : "record"
  );
  const isPractice = mode === "practice";
  const [saved] = useState(() =>
    readSavedState(puzzle, mode, wantsReplay)
  );
  // Content signature stamped on every save so a regenerated puzzle that reused
  // this id can't load a stale completion (see gameStorage.loadGameState).
  const signature = useMemo(() => puzzleSignature(puzzle), [puzzle]);

  // Where to send the player on completion, preserve ?puzzle=N for archives,
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
  const [hintsUsed, setHintsUsed] = useState(saved.hintsUsed);
  const [hintFlash, setHintFlash] = useState<{
    key: number;
    x: number;
    y: number;
  } | null>(null);
  // Tap-on-number feedback only, does not affect the mistakes counter.
  const [placementWarning, setPlacementWarning] = useState<string | null>(null);
  const placementWarningTimerRef = useRef<number | null>(null);
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
        signature,
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
        hintsUsed: overrides.hintsUsed ?? hintsUsed,
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
      hintsUsed,
      mode,
      signature,
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
    hintsUsed,
    persistState,
  ]);

  useEffect(() => {
    if (!validation.isComplete || savedComplete) return;

    setSavedComplete(true);
    setCompletionSeconds(seconds);
    markTutorialSeen();
    // Part one of the sting. Its tail is still sounding when the route changes
    // COMPLETION_NAV_DELAY_MS later, where CompleteScreen resolves it.
    play("victoryCharge");
    armVictoryResolve();

    // Practice solves persist only to the throwaway practice slot, the
    // canonical record (and its shareable time) is never touched.
    saveGameState(
      {
        puzzleId: puzzle.id,
        signature,
        mirrors,
        elapsedSeconds: seconds,
        completionSeconds: seconds,
        isComplete: true,
        isViewingSolve: false,
        isPaused,
        wrongNumberHits,
        hintsUsed,
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
    hintsUsed,
    mode,
    signature,
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

  // Passive mistake tracking: wrong number tiles + premature flag hits.
  // Counts every time a wrong number newly appears on the path (including the
  // same tile again after you fix and re-hit it) and every time the path newly
  // reaches the flag early. Never decrements, only reset on clear-board / a
  // fresh (replay) session. Seeded on first run so a mid-solve reload doesn't
  // recount mistakes already persisted.
  const prevIncorrectKeysRef = useRef<Set<string>>(new Set());
  const wasEarlyFlagRef = useRef(false);
  const wrongInitRef = useRef(false);

  const isEarlyFlagMistake =
    laserResult.reachedFlag &&
    validation.generatedSequence !== puzzle.code &&
    !validation.isComplete;

  useEffect(() => {
    if (!wrongInitRef.current) {
      wrongInitRef.current = true;
      prevIncorrectKeysRef.current = new Set(incorrectKeys);
      wasEarlyFlagRef.current = isEarlyFlagMistake;
      return;
    }

    let newlyWrong = 0;
    for (const key of incorrectKeys) {
      // Count each transition into "this cell is wrong on the path", leaving
      // and re-entering (same cell hit again) counts as another mistake.
      if (!prevIncorrectKeysRef.current.has(key)) {
        newlyWrong += 1;
      }
    }
    prevIncorrectKeysRef.current = new Set(incorrectKeys);

    // Count each time the path newly reaches the flag before the code is done.
    if (isEarlyFlagMistake && !wasEarlyFlagRef.current) {
      newlyWrong += 1;
    }
    wasEarlyFlagRef.current = isEarlyFlagMistake;

    if (newlyWrong > 0) {
      setWrongNumberHits((count) => count + newlyWrong);
      // Edge-triggered, unlike the red glow, which loops for as long as the
      // board stays wrong. One buzz per new mistake, never a repeating alarm.
      play("wrongState");
    }
  }, [incorrectKeys, isEarlyFlagMistake]);

  // Rising ping per code digit collected in order, pitched by position so the
  // last digit is the highest. Seeded on first run like the mistake tracker so
  // a mid-solve reload is silent, and suppressed when HINT caused the gain.
  const prevPrefixRef = useRef(0);
  const prefixInitRef = useRef(false);
  const suppressDigitPingRef = useRef(false);

  useEffect(() => {
    const previous = prevPrefixRef.current;
    prevPrefixRef.current = correctPrefixLength;

    if (!prefixInitRef.current) {
      prefixInitRef.current = true;
      return;
    }

    if (suppressDigitPingRef.current) {
      suppressDigitPingRef.current = false;
      return;
    }

    if (correctPrefixLength <= previous) return;

    for (let i = previous; i < correctPrefixLength; i++) {
      playDigit(i);
    }
  }, [correctPrefixLength]);

  // The background is not ambience, it is the beam itself: the same path the
  // board is drawing, so every mirror placed audibly rewrites what you hear.
  // Kept on for the solved board and for SEE SOLVE too - a beam is still drawn
  // in both, and cutting the sound at the moment of the solve made the laser
  // stop dead right where it should be most present.
  useEffect(() => {
    setBeamActive(true);
  }, []);

  // A bounce is a visited cell that holds a mirror, counted per visit: a path
  // that crosses the same mirror twice really does sizzle twice.
  const beamBounces = useMemo(
    () =>
      laserResult.visitedCells.filter(
        (cell) => getMirrorAt(mirrors, cell.x, cell.y) !== null
      ).length,
    [laserResult.visitedCells, mirrors]
  );

  useEffect(() => {
    setBeamState({
      length: laserResult.segments.length,
      bounces: beamBounces,
      // "revisit" is vestigial in the LaserResult union, calculateLaserPath
      // never emits it, and the voice only models terminations that exist.
      terminatedBy:
        laserResult.terminatedBy === "revisit" ? null : laserResult.terminatedBy,
      mistake: incorrectKeys.size > 0 || isEarlyFlagMistake,
    });
  }, [laserResult, beamBounces, incorrectKeys, isEarlyFlagMistake]);

  useEffect(() => {
    return () => {
      setBeamActive(false);
      duck("paused", false);
      duck("locked", false);
    };
  }, []);

  const handleCellClick = useCallback(
    (x: number, y: number) => {
      if (isPaused || isComplete) return;

      const cell = board[y]?.[x];
      if (
        cell?.type === "number" ||
        cell?.type === "flag" ||
        cell?.type === "source"
      ) {
        play("illegalTap");
        if (placementWarningTimerRef.current !== null) {
          window.clearTimeout(placementWarningTimerRef.current);
        }
        setPlacementWarning(
          cell.type === "number"
            ? "You cannot place a mirror on a number."
            : cell.type === "flag"
              ? "You cannot place a mirror on the flag."
              : "You cannot place a mirror on the laser source."
        );
        placementWarningTimerRef.current = window.setTimeout(() => {
          setPlacementWarning(null);
          placementWarningTimerRef.current = null;
        }, 2500);
        return;
      }

      const existing = getMirrorAt(mirrors, x, y);

      if (existing === null) {
        if (!canPlaceMirror(puzzle, mirrors, x, y)) return;
        setPlacementWarning(null);
        if (placementWarningTimerRef.current !== null) {
          window.clearTimeout(placementWarningTimerRef.current);
          placementWarningTimerRef.current = null;
        }
        play("mirrorPlace");
        setMirrors((prev) => [...prev, { x, y, orientation: "/" }]);
        return;
      }

      const nextOrientation = cycleMirrorOrientation(existing);
      if (nextOrientation === null) {
        play("mirrorRemove");
        setMirrors((prev) => prev.filter((m) => !(m.x === x && m.y === y)));
      } else {
        play("mirrorRotate");
        setMirrors((prev) =>
          prev.map((m) =>
            m.x === x && m.y === y
              ? { ...m, orientation: nextOrientation }
              : m
          )
        );
      }
    },
    [isPaused, isComplete, puzzle, mirrors, board]
  );

  useEffect(() => {
    return () => {
      if (placementWarningTimerRef.current !== null) {
        window.clearTimeout(placementWarningTimerRef.current);
      }
    };
  }, []);

  const handleClearBoard = useCallback(() => {
    if (isComplete) return;
    play("mirrorRemove");
    setMirrors([]);
    // Clearing the board resets the session mistake and hint counters.
    setWrongNumberHits(0);
    setHintsUsed(0);
    prevIncorrectKeysRef.current = new Set();
    wasEarlyFlagRef.current = false;
  }, [isComplete]);

  // Canonical proven-minimal solution, when one has shipped for this puzzle.
  const solutionMirrors = useMemo(
    () => getPuzzleSolution(puzzle.id),
    [puzzle.id]
  );

  const nextHint = useMemo(
    () =>
      solutionMirrors && !isComplete
        ? getNextHint(puzzle, solutionMirrors, mirrors)
        : null,
    [puzzle, solutionMirrors, mirrors, isComplete]
  );

  const handleHint = useCallback(() => {
    if (isPaused || isComplete || gameplayLocked || isViewingSolve) return;
    if (!nextHint) return;

    const next = applyHint(mirrors, nextHint);

    // Pre-seed the passive mistake tracker with whatever the hinted board
    // produces, so a hint can never be charged as a player mistake (solution
    // mirrors placed in beam order can transiently route into a wrong number
    // or the flag).
    const nextLaser = calculateLaserPath(puzzle, next);
    const { incorrectKeys: nextIncorrect } = getNumberTileStates(
      puzzle.code,
      buildBoard(puzzle, next),
      nextLaser.visitedCells
    );
    prevIncorrectKeysRef.current = new Set(nextIncorrect);
    const nextValidation = validateSequence(puzzle.code, nextLaser);
    wasEarlyFlagRef.current =
      nextLaser.reachedFlag &&
      nextValidation.generatedSequence !== puzzle.code &&
      !nextValidation.isComplete;

    // The hint has its own voice; the digit pings it would otherwise trigger
    // would read as the player having earned them.
    suppressDigitPingRef.current = true;
    play("hintChime");
    setMirrors(next);
    setHintsUsed((h) => h + 1);
    setHintFlash({
      key: Date.now(),
      x: nextHint.mirror.x,
      y: nextHint.mirror.y,
    });
  }, [
    isPaused,
    isComplete,
    gameplayLocked,
    isViewingSolve,
    nextHint,
    mirrors,
    puzzle,
  ]);

  // The engine ducks the bed on tab-hide itself; these are the in-app reasons.
  useEffect(() => {
    duck("paused", isPaused);
  }, [isPaused]);

  useEffect(() => {
    duck("locked", gameplayLocked);
  }, [gameplayLocked]);

  const handlePause = useCallback(() => {
    play("uiTick");
    setIsPaused((p) => !p);
  }, []);

  const handleResume = useCallback(() => {
    play("uiTick");
    setIsPaused(false);
  }, []);

  const handleHome = useCallback(() => {
    play("uiTick");
    router.push("/");
  }, [router]);

  const handleRules = useCallback(() => {
    play("uiTick");
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

  const boardRegionRef = useRef<HTMLDivElement>(null);
  const clusterHeaderRef = useRef<HTMLDivElement>(null);
  const [boardRegionSize, setBoardRegionSize] = useState<{
    width?: number;
    height?: number;
    headerHeight?: number;
  }>({});

  useEffect(() => {
    const region = boardRegionRef.current;
    if (!region) return;

    const updateSize = () => {
      setBoardRegionSize({
        width: region.clientWidth,
        height: region.clientHeight,
        headerHeight: clusterHeaderRef.current?.clientHeight ?? 0,
      });
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(region);
    if (clusterHeaderRef.current) observer.observe(clusterHeaderRef.current);

    return () => observer.disconnect();
  }, []);

  // Slack between the header block and the board (region gap + rounding). The
  // board's height budget is the region minus the header so it never overflows.
  const BOARD_REGION_GAP_PX = 24;
  const boardMaxHeight =
    boardRegionSize.height !== undefined
      ? Math.max(
          0,
          boardRegionSize.height -
            (boardRegionSize.headerHeight ?? 0) -
            BOARD_REGION_GAP_PX
        )
      : undefined;

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-black">
      <Header
        time={displayTime}
        isPaused={isPaused}
        onHome={handleHome}
        onRules={handleRules}
        onPause={handlePause}
        onClear={handleClearBoard}
        onHint={
          solutionMirrors && !isViewingSolve ? handleHint : undefined
        }
        hintDisabled={nextHint === null || isPaused}
        disabled={isComplete || gameplayLocked}
      />

      <div className="flex min-h-0 flex-1 flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 md:pt-4">
        <div
          ref={boardRegionRef}
          className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-3 md:gap-5"
        >
          <div
            ref={clusterHeaderRef}
            className="flex shrink-0 flex-col items-center gap-3 md:gap-5"
          >
            <h1
              className={`text-center text-2xl font-light tracking-[0.4em] text-white transition-opacity duration-500 md:text-4xl ${contentDimClass}`}
            >
              LATTICE
            </h1>

            <TargetCodeIntro
              code={puzzle.code}
              isComplete={isComplete}
              collectedDigitCount={correctPrefixLength}
              playIntro={shouldPlayCodeIntro}
              introPaused={showHowToPlay}
              onIntroComplete={handleCodeIntroComplete}
            />
          </div>

          <div
            className={`flex min-h-0 w-full items-center justify-center transition-opacity duration-500 ${contentDimClass}`}
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
              maxBoardWidth={boardRegionSize.width}
              maxBoardHeight={boardMaxHeight}
              hintFlash={hintFlash}
            />
          </div>
        </div>

        <div
          className={`mt-3 flex shrink-0 flex-col items-center transition-opacity duration-500 md:mt-6 ${contentDimClass}`}
        >
          {/* The warning sits above the how-to line: it is the urgent text, so
              it reads first and never has to be hunted for below the prose. */}
          {!isViewingSolve && (
            <WarningBanner
              message={placementWarning ?? validation.warningMessage}
              inline
            />
          )}

          <p className="text-center text-xs tracking-wider text-white/70 md:text-sm">
            {isViewingSolve
              ? "Your solution — mirrors locked."
              : "Place a mirror on the laser to redirect it — tap again to rotate or remove it. Lasers can cross paths and pass through the source."}
          </p>
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

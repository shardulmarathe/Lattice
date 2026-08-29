"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Board from "@/components/Board/Board";
import TargetCodeIntro from "@/components/Game/TargetCodeIntro";
import WarningBanner from "@/components/Header/WarningBanner";
import HowToPlayModal from "@/components/HowToPlayModal";
import SoundToggle from "@/components/Sound/SoundToggle";
import { TUTORIAL_PUZZLE } from "@/data/tutorialPuzzle";
import {
  TUTORIAL_ERROR_STEP_ID,
  TUTORIAL_HIT_THREE_STEP_ID,
  TUTORIAL_REBUILD_STEP_ID,
  TUTORIAL_SOLUTION,
  TUTORIAL_STEPS,
  type IllegalCellType,
} from "@/data/tutorialSteps";
import {
  buildBoard,
  calculateLaserPath,
  canPlaceMirror,
  cycleMirrorOrientation,
  getMirrorAt,
} from "@/lib/laserEngine";
import { applyHint, getNextHint } from "@/lib/hints";
import {
  play,
  playDigit,
  playIn,
  setBeamActive,
  setBeamPresence,
  setBeamState,
} from "@/lib/audio/engine";
import { armVictoryResolve, consumeVictoryResolve } from "@/lib/audio/victoryHandoff";
import type { MirrorPlacement } from "@/lib/puzzleTypes";
import { markTutorialSeen } from "@/lib/tutorialStorage";
import {
  cellKey,
  getNumberTileStates,
  validateSequence,
} from "@/lib/validation";

const puzzle = TUTORIAL_PUZZLE;
const BOARD_REGION_GAP_PX = 24;
const TUTORIAL_MAX_CELL_SIZE = 96;
/** Beat after the laser hits the flag before the ready overlay (same as play). */
const COMPLETION_NAV_DELAY_MS = 350;
/** Delay on the ready overlay's reveal, which the victory resolve lands on. */
const READY_REVEAL_DELAY_S = 0.3;

const navButtonClass =
  "bg-transparent px-1.5 py-1.5 text-[0.72rem] tracking-[0.1em] text-white/88 transition-colors outline-none hover:text-white disabled:cursor-not-allowed disabled:text-white/38 sm:px-3 sm:text-[0.83rem] sm:tracking-[0.15em] md:px-4 md:py-2 md:text-[0.97rem] [-webkit-tap-highlight-color:transparent]";

export default function TutorialScreen() {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [mirrors, setMirrors] = useState<MirrorPlacement[]>([]);
  const [rotatedCells, setRotatedCells] = useState(() => new Set<string>());
  const [removedCells, setRemovedCells] = useState(() => new Set<string>());
  const [triedIllegal, setTriedIllegal] = useState(
    () => new Set<IllegalCellType>()
  );
  const [usedHint, setUsedHint] = useState(false);
  const [usedReset, setUsedReset] = useState(false);
  const [placementWarning, setPlacementWarning] = useState<string | null>(null);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  const [showReady, setShowReady] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [codeIntroComplete, setCodeIntroComplete] = useState(false);
  const [hintFlash, setHintFlash] = useState<{
    key: number;
    x: number;
    y: number;
  } | null>(null);
  const [boardRegionSize, setBoardRegionSize] = useState<{
    width?: number;
    height?: number;
    headerHeight?: number;
  }>({});
  const boardRegionRef = useRef<HTMLDivElement>(null);
  const clusterHeaderRef = useRef<HTMLDivElement>(null);
  const placementWarningTimerRef = useRef<number | null>(null);
  const completionTimerRef = useRef<number | null>(null);
  const advancingRef = useRef(false);

  const step = TUTORIAL_STEPS[stepIndex];
  const isLastStep = stepIndex >= TUTORIAL_STEPS.length - 1;
  const introLocked = !codeIntroComplete;
  const boardLocked =
    introLocked || showReady || (step?.allowCells.length === 0);

  const board = useMemo(() => buildBoard(puzzle, mirrors), [mirrors]);
  const laserResult = useMemo(
    () => calculateLaserPath(puzzle, mirrors),
    [mirrors]
  );
  const validation = useMemo(
    () => validateSequence(puzzle.code, laserResult),
    [laserResult]
  );
  const { collectedKeys, incorrectKeys, correctPrefixLength } = useMemo(
    () => getNumberTileStates(puzzle.code, board, laserResult.visitedCells),
    [board, laserResult.visitedCells]
  );

  const isFlagIncorrect = laserResult.reachedFlag && !validation.isComplete;

  const pulseKeys = useMemo(() => {
    if (introLocked || showReady || !step || step.pulse.length === 0) return null;
    return new Set(step.pulse.map((c) => cellKey(c.x, c.y)));
  }, [step, introLocked, showReady]);

  const allowSet = useMemo(() => {
    if (!step || step.allowCells.length === 0) return null;
    return new Set(step.allowCells.map((c) => cellKey(c.x, c.y)));
  }, [step]);

  const nextHint = useMemo(() => {
    if (!step?.allowHint) return null;
    return getNextHint(puzzle, TUTORIAL_SOLUTION, mirrors);
  }, [step, mirrors]);

  const pulseHint = Boolean(step?.pulseControls?.includes("hint"));
  const pulseReset = Boolean(step?.pulseControls?.includes("reset"));

  const beamBounces = useMemo(
    () =>
      laserResult.visitedCells.filter(
        (cell) => getMirrorAt(mirrors, cell.x, cell.y) !== null
      ).length,
    [laserResult.visitedCells, mirrors]
  );

  useEffect(() => {
    setBeamPresence(1);
    setBeamActive(true);
    return () => {
      setBeamActive(false);
      setBeamPresence(1);
    };
  }, []);

  useEffect(() => {
    setBeamState({
      length: laserResult.segments.length,
      bounces: beamBounces,
      terminatedBy:
        laserResult.terminatedBy === "revisit" ? null : laserResult.terminatedBy,
      mistake: incorrectKeys.size > 0 || isFlagIncorrect,
    });
  }, [laserResult, beamBounces, incorrectKeys, isFlagIncorrect]);

  // Rising ping per code digit collected in order (same as play).
  // Buzz when a wrong number or early flag newly appears.
  const prevPrefixRef = useRef(0);
  const prefixInitRef = useRef(false);
  const suppressDigitPingRef = useRef(false);
  const prevIncorrectKeysRef = useRef<Set<string>>(new Set());
  const wasEarlyFlagRef = useRef(false);
  const wrongInitRef = useRef(false);
  const suppressWrongBuzzRef = useRef(false);

  useEffect(() => {
    // Seeded step transitions rewrite the board; don't fanfare those jumps.
    suppressDigitPingRef.current = true;
    suppressWrongBuzzRef.current = true;
  }, [stepIndex]);

  useEffect(() => {
    const previous = prevPrefixRef.current;
    prevPrefixRef.current = correctPrefixLength;

    if (!prefixInitRef.current) {
      prefixInitRef.current = true;
      return;
    }
    if (introLocked || showReady) return;
    if (suppressDigitPingRef.current) {
      suppressDigitPingRef.current = false;
      return;
    }
    if (correctPrefixLength <= previous) return;

    for (let i = previous; i < correctPrefixLength; i++) {
      playDigit(i);
    }
  }, [correctPrefixLength, introLocked, showReady]);

  useEffect(() => {
    if (!wrongInitRef.current) {
      wrongInitRef.current = true;
      prevIncorrectKeysRef.current = new Set(incorrectKeys);
      wasEarlyFlagRef.current = isFlagIncorrect;
      return;
    }
    if (introLocked || showReady) return;
    if (suppressWrongBuzzRef.current) {
      suppressWrongBuzzRef.current = false;
      prevIncorrectKeysRef.current = new Set(incorrectKeys);
      wasEarlyFlagRef.current = isFlagIncorrect;
      return;
    }

    let newlyWrong = 0;
    for (const key of incorrectKeys) {
      if (!prevIncorrectKeysRef.current.has(key)) newlyWrong += 1;
    }
    prevIncorrectKeysRef.current = new Set(incorrectKeys);

    if (isFlagIncorrect && !wasEarlyFlagRef.current) newlyWrong += 1;
    wasEarlyFlagRef.current = isFlagIncorrect;

    if (newlyWrong > 0) play("wrongState");
  }, [incorrectKeys, isFlagIncorrect, introLocked, showReady]);

  useEffect(() => {
    if (!showReady) return;
    setBeamPresence(0.4);
    if (consumeVictoryResolve()) {
      playIn("victoryResolve", READY_REVEAL_DELAY_S);
    }
  }, [showReady]);

  useEffect(() => {
    const first = TUTORIAL_STEPS[0];
    if (first?.seedMirrors) {
      setMirrors(first.seedMirrors.map((m) => ({ ...m })));
    }
  }, []);

  useEffect(() => {
    setUsedHint(false);
    setUsedReset(false);
    setTriedIllegal(new Set());
  }, [stepIndex]);

  useEffect(() => {
    if (!step || showReady || introLocked || advancingRef.current) return;
    const ctx = {
      mirrors,
      laserResult,
      validation,
      correctPrefixLength,
      incorrectKeys,
      rotatedCells,
      removedCells,
      triedIllegal,
      usedHint,
      usedReset,
    };
    if (!step.advanceWhen(ctx)) return;

    advancingRef.current = true;

    if (isLastStep) {
      markTutorialSeen();
      // Same beat as play: charge on the board while the victory laser shows,
      // then reveal the ready card so resolve can land on the checkmark.
      play("victoryCharge");
      armVictoryResolve();
      if (completionTimerRef.current !== null) {
        window.clearTimeout(completionTimerRef.current);
      }
      completionTimerRef.current = window.setTimeout(() => {
        completionTimerRef.current = null;
        setShowReady(true);
        advancingRef.current = false;
      }, COMPLETION_NAV_DELAY_MS);
      return;
    }

    // HINT fixes the wrong mirror and continues to hit_three.
    // RESET clears the board; player rebuilds the first mirror, then hit_three.
    if (step.id === TUTORIAL_ERROR_STEP_ID) {
      const rebuildIndex = TUTORIAL_STEPS.findIndex(
        (s) => s.id === TUTORIAL_REBUILD_STEP_ID
      );
      const hitThreeIndex = TUTORIAL_STEPS.findIndex(
        (s) => s.id === TUTORIAL_HIT_THREE_STEP_ID
      );
      if (usedReset) {
        setMirrors([]);
        setStepIndex(rebuildIndex);
      } else {
        // Keep HINT-fixed mirrors; do not re-seed.
        setStepIndex(hitThreeIndex);
      }
      queueMicrotask(() => {
        advancingRef.current = false;
      });
      return;
    }

    const next = TUTORIAL_STEPS[stepIndex + 1];
    if (next?.seedMirrors) {
      setMirrors(next.seedMirrors.map((m) => ({ ...m })));
    }
    setStepIndex((i) => i + 1);
    queueMicrotask(() => {
      advancingRef.current = false;
    });
  }, [
    step,
    stepIndex,
    mirrors,
    laserResult,
    validation,
    correctPrefixLength,
    incorrectKeys,
    rotatedCells,
    removedCells,
    triedIllegal,
    usedHint,
    usedReset,
    isLastStep,
    showReady,
    introLocked,
  ]);

  useEffect(() => {
    const region = boardRegionRef.current;
    const header = clusterHeaderRef.current;
    if (!region) return;

    const measure = () => {
      setBoardRegionSize({
        width: region.clientWidth,
        height: region.clientHeight,
        headerHeight: header?.offsetHeight ?? 0,
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(region);
    if (header) observer.observe(header);
    return () => observer.disconnect();
  }, [codeIntroComplete, stepIndex]);

  useEffect(() => {
    return () => {
      if (placementWarningTimerRef.current !== null) {
        window.clearTimeout(placementWarningTimerRef.current);
      }
      if (completionTimerRef.current !== null) {
        window.clearTimeout(completionTimerRef.current);
      }
    };
  }, []);

  const flashWarning = useCallback((message: string) => {
    if (placementWarningTimerRef.current !== null) {
      window.clearTimeout(placementWarningTimerRef.current);
    }
    setPlacementWarning(message);
    placementWarningTimerRef.current = window.setTimeout(() => {
      setPlacementWarning(null);
      placementWarningTimerRef.current = null;
    }, 2500);
  }, []);

  const handleReset = useCallback(() => {
    if (introLocked || showReady || !step?.allowReset) return;
    // Same as play: wipe every mirror off the board.
    play("mirrorRemove");
    setMirrors([]);
    setPlacementWarning(null);
    setUsedReset(true);
  }, [introLocked, showReady, step]);

  const handleHint = useCallback(() => {
    if (introLocked || showReady || !step?.allowHint || !nextHint) return;
    // Same as play: one step toward the canonical solution.
    const next = applyHint(mirrors, nextHint);
    play("hintChime");
    suppressDigitPingRef.current = true;
    setMirrors(next);
    setHintFlash({
      key: Date.now(),
      x: nextHint.mirror.x,
      y: nextHint.mirror.y,
    });
    setPlacementWarning(null);
    setUsedHint(true);
  }, [introLocked, showReady, step, nextHint, mirrors]);

  const handleCellClick = useCallback(
    (x: number, y: number) => {
      if (boardLocked) return;

      const cell = board[y]?.[x];
      if (
        cell?.type === "number" ||
        cell?.type === "flag" ||
        cell?.type === "source"
      ) {
        const illegalType = cell.type as IllegalCellType;
        if (allowSet && !allowSet.has(cellKey(x, y))) {
          play("illegalTap");
          flashWarning("Follow the glowing square for now.");
          return;
        }
        play("illegalTap");
        setTriedIllegal((prev) => new Set(prev).add(illegalType));
        flashWarning(
          cell.type === "number"
            ? "You cannot place a mirror on a number."
            : cell.type === "flag"
              ? "You cannot place a mirror on the flag."
              : "You cannot place a mirror on the laser source."
        );
        return;
      }

      if (allowSet && !allowSet.has(cellKey(x, y))) {
        play("illegalTap");
        flashWarning("Follow the glowing square for now.");
        return;
      }

      const existing = getMirrorAt(mirrors, x, y);
      const key = cellKey(x, y);

      if (existing === null) {
        if (!canPlaceMirror(puzzle, mirrors, x, y)) return;
        setPlacementWarning(null);
        play("mirrorPlace");
        setMirrors((prev) => [...prev, { x, y, orientation: "/" }]);
        return;
      }

      const nextOrientation = cycleMirrorOrientation(existing);
      if (nextOrientation === null) {
        play("mirrorRemove");
        setRemovedCells((prev) => new Set(prev).add(key));
        setMirrors((prev) => prev.filter((m) => !(m.x === x && m.y === y)));
      } else {
        play("mirrorRotate");
        setRotatedCells((prev) => new Set(prev).add(key));
        setMirrors((prev) =>
          prev.map((m) =>
            m.x === x && m.y === y
              ? { ...m, orientation: nextOrientation }
              : m
          )
        );
      }
    },
    [boardLocked, board, allowSet, mirrors, flashWarning]
  );

  const boardMaxHeight =
    boardRegionSize.height !== undefined
      ? Math.max(
          0,
          boardRegionSize.height -
            (boardRegionSize.headerHeight ?? 0) -
            BOARD_REGION_GAP_PX
        )
      : undefined;

  const boardDimClass = introLocked ? "opacity-40 pointer-events-none" : "";

  const instructionText = introLocked
    ? "Watch the target code, then follow each step."
    : (step?.caption ?? "");

  const showControlArrows = pulseHint || pulseReset;

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-black">
      <header className={`relative z-20 flex w-full shrink-0 items-center justify-between gap-2 px-2 pt-[max(0.75rem,env(safe-area-inset-top))] pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] sm:px-4 md:px-6 ${showControlArrows ? "pb-14" : "pb-3"}`}>
        <div className="flex gap-1 sm:gap-2 md:gap-3">
          <button
            type="button"
            onClick={() => {
              play("uiTick");
              router.push("/");
            }}
            className={navButtonClass}
          >
            HOME
          </button>
          <div className="relative w-fit">
            <button
              type="button"
              onClick={handleReset}
              disabled={introLocked || showReady || !step?.allowReset}
              className={`${navButtonClass} ${pulseReset ? "tutorial-pulse" : ""}`}
            >
              RESET
            </button>
            {pulseReset && (
              <div
                className="pointer-events-none absolute left-0 right-0 top-[calc(100%+0.35rem)] z-30 flex justify-center"
                aria-hidden
              >
                <div className="tutorial-control-arrow flex flex-col items-center">
                  <svg
                    width="14"
                    height="10"
                    viewBox="0 0 14 10"
                    fill="none"
                    className="text-[#FF2D2D]"
                  >
                    <path
                      d="M7 0L13.0622 9.75H0.937822L7 0Z"
                      fill="currentColor"
                    />
                  </svg>
                  <span className="mt-1 text-[0.72rem] tracking-[0.1em] text-[#FF2D2D] sm:text-[0.83rem] sm:tracking-[0.15em]">
                    RESET
                  </span>
                </div>
              </div>
            )}
          </div>
          <div className="relative w-fit">
            <button
              type="button"
              onClick={handleHint}
              disabled={
                introLocked || showReady || !step?.allowHint || nextHint === null
              }
              className={`${navButtonClass} ${pulseHint ? "tutorial-pulse" : ""}`}
            >
              HINT
            </button>
            {pulseHint && (
              <div
                className="pointer-events-none absolute left-0 right-0 top-[calc(100%+0.35rem)] z-30 flex justify-center"
                aria-hidden
              >
                <div className="tutorial-control-arrow flex flex-col items-center">
                  <svg
                    width="14"
                    height="10"
                    viewBox="0 0 14 10"
                    fill="none"
                    className="text-[#FF2D2D]"
                  >
                    <path
                      d="M7 0L13.0622 9.75H0.937822L7 0Z"
                      fill="currentColor"
                    />
                  </svg>
                  <span className="mt-1 text-[0.72rem] tracking-[0.1em] text-[#FF2D2D] sm:text-[0.83rem] sm:tracking-[0.15em]">
                    HINT
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-3 md:gap-4">
          <SoundToggle
            className={`${navButtonClass} flex items-center justify-center`}
          />
          <button
            type="button"
            onClick={() => {
              play("uiTick");
              setShowRules(true);
            }}
            className={navButtonClass}
          >
            RULES
          </button>
          <button
            type="button"
            onClick={() => {
              play("uiTick");
              setShowSkipConfirm(true);
            }}
            className={navButtonClass}
          >
            SKIP
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 md:pt-4">
        <div
          ref={boardRegionRef}
          className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-3 md:gap-5"
        >
          <div
            ref={clusterHeaderRef}
            className="flex shrink-0 flex-col items-center gap-3 md:gap-4"
          >
            <h1 className="text-center text-2xl font-light tracking-[0.4em] text-white md:text-4xl">
              LATTICE
            </h1>

            <TargetCodeIntro
              code={puzzle.code}
              isComplete={validation.isComplete}
              collectedDigitCount={correctPrefixLength}
              playIntro
              introPaused={showRules || showSkipConfirm || showReady}
              onIntroComplete={() => setCodeIntroComplete(true)}
            />

            <div className="flex max-w-lg flex-col items-center gap-1.5 px-2">
              <p className="text-center text-[0.65rem] tracking-[0.2em] text-white/55">
                TUTORIAL · {Math.min(stepIndex + 1, TUTORIAL_STEPS.length)}/
                {TUTORIAL_STEPS.length}
              </p>
              <p className="text-center text-base font-light leading-snug tracking-wide text-white md:text-lg">
                {instructionText}
              </p>
            </div>
          </div>

          <div
            className={`flex min-h-0 w-full items-center justify-center transition-opacity duration-500 ${boardDimClass}`}
          >
            <Board
              puzzle={puzzle}
              board={board}
              laserResult={laserResult}
              collectedNumberKeys={collectedKeys}
              incorrectNumberKeys={incorrectKeys}
              isFlagIncorrect={isFlagIncorrect}
              onCellClick={handleCellClick}
              disabled={boardLocked}
              showVictoryLaser={validation.isComplete}
              maxBoardWidth={boardRegionSize.width}
              maxBoardHeight={boardMaxHeight}
              pulseKeys={pulseKeys}
              hintFlash={hintFlash}
              maxCellSize={TUTORIAL_MAX_CELL_SIZE}
            />
          </div>
        </div>

        <div className="mt-2 flex shrink-0 flex-col items-center md:mt-3">
          <WarningBanner
            message={
              introLocked
                ? null
                : (placementWarning ?? validation.warningMessage)
            }
            inline
          />
        </div>
      </div>

      {showSkipConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black px-4">
          <div className="w-full max-w-sm border border-white/10 bg-black p-6">
            <p className="mb-6 text-center text-sm leading-relaxed tracking-wide text-white/80">
              Skip the whole tutorial and return home?
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  play("uiTick");
                  router.push("/");
                }}
                className="w-full border border-white/20 py-2.5 text-sm tracking-[0.2em] text-white transition-colors hover:border-white/70 hover:bg-white/5"
              >
                SKIP TUTORIAL
              </button>
              <button
                type="button"
                onClick={() => {
                  play("uiTick");
                  setShowSkipConfirm(false);
                }}
                className="w-full border border-transparent py-2.5 text-sm tracking-[0.2em] text-white/60 transition-colors hover:text-white"
              >
                KEEP GOING
              </button>
            </div>
          </div>
        </div>
      )}

      {showReady && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black px-[max(1rem,env(safe-area-inset-left))] py-[max(0.75rem,env(safe-area-inset-bottom))] sm:py-[max(2rem,env(safe-area-inset-bottom))]">
          {/* Same shape as the play completion screen: heading, one primary
              button, secondary actions as text links. No checkmark, and no
              filler caption, because unlike a solve there is no result to
              report here. */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="flex w-full max-w-md flex-col items-center gap-6 border border-white/10 bg-black px-5 py-8 sm:px-12 sm:py-10"
          >
            <h2 className="text-balance text-center text-[clamp(1.15rem,5.5vw,1.5rem)] tracking-[0.3em] text-white">
              TUTORIAL COMPLETE
            </h2>

            <div className="flex w-full flex-col items-center gap-4">
              <button
                type="button"
                onClick={() => {
                  play("uiTick");
                  router.push("/play");
                }}
                className="w-full border border-white/70 py-3 text-sm tracking-[0.2em] text-white transition-colors hover:border-white hover:bg-white/5"
              >
                SOLVE TODAY&apos;S PUZZLE
              </button>

              <button
                type="button"
                onClick={() => {
                  play("uiTick");
                  router.push("/");
                }}
                className="px-2 py-2 text-sm text-white/70 transition-colors hover:text-white"
              >
                Home
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <HowToPlayModal
        isOpen={showRules}
        onClose={() => setShowRules(false)}
        confirmLabel="CLOSE"
        overlayOnGame
      />
    </main>
  );
}

"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getPuzzleById, getPuzzleForDate, PUZZLE_001 } from "@/data/puzzles";
import { isPuzzleUnlocked } from "@/lib/archive";
import { loadGameState } from "@/lib/gameStorage";
import { markTutorialSeen } from "@/lib/tutorialStorage";
import type { Puzzle } from "@/lib/puzzleTypes";
import { getShareText } from "@/lib/shareText";
import {
  getAccuracyScore,
  getEfficiencyScore,
  getPuzzleStats,
  getSpeedScore,
  type MeterScore,
} from "@/lib/puzzleStats";
import { formatTime } from "@/lib/validation";
import { useDailyRollover } from "@/hooks/useDailyRollover";
import {
  play,
  playIn,
  setBeamActive,
  setBeamPresence,
  setBeamState,
} from "@/lib/audio/engine";
import { calculateLaserPath, getMirrorAt } from "@/lib/laserEngine";
import { consumeVictoryResolve } from "@/lib/audio/victoryHandoff";

/** Spring delay on the scorecard reveal, which the victory resolve lands on. */
const SCORECARD_DELAY_S = 0.3;

/**
 * Secondary text on black. white/50 clears WCAG AA (5.28:1) while still reading
 * as recessive, so labels stay dim without dropping under the threshold the way
 * the old white/40 (3.66:1) and white/45 (4.42:1) did.
 */
const LABEL_CLASS = "text-xs text-white/55 sm:text-sm";
const DETAIL_CLASS = "text-xs text-white/50 sm:text-sm";

/**
 * The secondary actions under SHARE. Brighter and larger than the surrounding
 * labels because they are controls, not annotation, and padded so they are a
 * real tap target rather than bare 12px text.
 */
const SECONDARY_LINK_CLASS =
  "px-2 py-2 text-sm text-white/70 transition-colors hover:text-white";

/**
 * One 1-5 meter: label, five dots, a short detail. Same three meters and the
 * same scores as the share text (see getShareText), so the screen and the
 * clipboard can never tell different stories.
 *
 * Filled dots are laser red, empty dots are dim white, so red reads as "lit"
 * rather than as a verdict: a 1-of-5 row is mostly unlit, not mostly wrong.
 *
 * Sizes step up at sm rather than unconditionally. At 320px the row has 248px
 * to work with, and label + dots + the longest detail ("+3 over min") already
 * fills 238px of it at the smaller scale.
 */
function Meter({
  label,
  score,
  detail,
}: {
  label: string;
  score: MeterScore;
  detail: string;
}) {
  return (
    <div className="flex w-full items-center gap-2.5 sm:gap-3">
      <span className={`w-[5.25rem] shrink-0 sm:w-24 ${LABEL_CLASS}`}>
        {label}
      </span>
      <span
        className="flex shrink-0 items-center gap-1 sm:gap-1.5"
        aria-hidden
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <span
            key={i}
            className={`h-2 w-2 rounded-full sm:h-2.5 sm:w-2.5 ${
              i < score ? "bg-laser" : "bg-white/15"
            }`}
          />
        ))}
      </span>
      <span className="sr-only">{`${score} out of 5`}</span>
      <span className={`min-w-0 ${DETAIL_CLASS}`}>{detail}</span>
    </div>
  );
}

/** Live HH:MM:SS until local midnight, when the next daily puzzle unlocks. */
function useNextPuzzleCountdown(enabled: boolean): string {
  const compute = () => {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const totalSeconds = Math.max(
      0,
      Math.floor((midnight.getTime() - now.getTime()) / 1000)
    );
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  };

  const [countdown, setCountdown] = useState(compute);

  useEffect(() => {
    if (!enabled) return;
    const interval = setInterval(() => setCountdown(compute()), 1000);
    return () => clearInterval(interval);
  }, [enabled]);

  return countdown;
}

function resolvePuzzle(searchParams: URLSearchParams): Puzzle {
  const puzzleParam = searchParams.get("puzzle");
  if (puzzleParam !== null) {
    const id = Number(puzzleParam);
    if (process.env.NODE_ENV === "development") {
      return getPuzzleById(id) ?? PUZZLE_001;
    }
    if (isPuzzleUnlocked(id, new Date())) {
      return getPuzzleById(id) ?? getPuzzleForDate(new Date()) ?? PUZZLE_001;
    }
  }

  return getPuzzleForDate(new Date()) ?? PUZZLE_001;
}

function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export default function CompleteScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const puzzle = useMemo(() => resolvePuzzle(searchParams), [searchParams]);
  // A practice run's completion: same victory screen, but Replay-only, the
  // recorded time (read from the record slot) is untouched and not re-shared.
  const isPractice = searchParams.get("practice") === "1";
  // Nothing is at stake on this screen, so when the countdown below reaches
  // 00:00:00 we go straight into the new day's board.
  useDailyRollover({
    enabled: searchParams.get("puzzle") === null,
    atMidnight: true,
    destination: "/play",
  });

  // The daily is a one-time solve, no replay. Only past puzzles can be replayed.
  const isDaily = useMemo(
    () => puzzle.id === getPuzzleForDate(new Date())?.id,
    [puzzle.id]
  );

  // Preserve ?puzzle=N so play/replay navigation stays on the archived puzzle.
  const playRoute = isDaily ? "/play" : `/play?puzzle=${puzzle.id}`;
  const replayRoute = `${playRoute}${playRoute.includes("?") ? "&" : "?"}replay=1`;
  // Carries the viewing intent in the URL rather than in the save, so it
  // applies to this trip only and a later plain /play still lands here.
  const solveRoute = `${playRoute}${playRoute.includes("?") ? "&" : "?"}solve=1`;

  // Only today's solve leads into tomorrow's puzzle, so an archive completion
  // has nothing to count down to.
  const countdown = useNextPuzzleCountdown(isDaily);
  const [copied, setCopied] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [timeSeconds, setTimeSeconds] = useState(0);
  const [mirrorsUsed, setMirrorsUsed] = useState(0);
  const [wrongNumberHits, setWrongNumberHits] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);

  useEffect(() => {
    const saved = loadGameState(puzzle, isPractice ? "practice" : "record");
    if (!saved?.isComplete || saved.completionSeconds === null) {
      router.replace(playRoute);
      return;
    }

    setTimeSeconds(saved.completionSeconds);
    setMirrorsUsed(saved.mirrors.length);
    setWrongNumberHits(saved.wrongNumberHits);
    setHintsUsed(saved.hintsUsed);
    setIsReady(true);

    // The solved beam keeps running under the results. It is the same voice the
    // board was driving, handed the winning path, so the laser does not just
    // stop dead at the moment you finish.
    const solved = calculateLaserPath(puzzle, saved.mirrors);
    setBeamState({
      length: solved.segments.length,
      bounces: solved.visitedCells.filter(
        (cell) => getMirrorAt(saved.mirrors, cell.x, cell.y) !== null
      ).length,
      terminatedBy: "flag",
      mistake: false,
    });
    // Same beam voice as /play, but quieter so it sits under the results.
    setBeamPresence(0.4);
    setBeamActive(true);

    // Part two of the victory sting, scheduled to land on the scorecard's
    // spring below. Only a solve arms it, so revisiting this screen is silent.
    if (consumeVictoryResolve()) {
      playIn("victoryResolve", SCORECARD_DELAY_S);
    }
  }, [puzzle, router, playRoute, isPractice]);

  useEffect(
    () => () => {
      setBeamActive(false);
      setBeamPresence(1);
    },
    []
  );

  // Text the SHARE button copies to the clipboard (revealed only when pasted).
  const shareText = useMemo(
    () =>
      getShareText(puzzle.id, timeSeconds, mirrorsUsed, wrongNumberHits, hintsUsed),
    [puzzle.id, timeSeconds, mirrorsUsed, wrongNumberHits, hintsUsed]
  );

  // Same three scores the share text prints, from the same source, so the dots
  // on screen and the dots in the paste always agree.
  const efficiencyScore = getEfficiencyScore(puzzle.id, mirrorsUsed);
  const speedScore = getSpeedScore(puzzle, timeSeconds);
  const accuracyScore = getAccuracyScore(wrongNumberHits);

  // Short screen-side wording for the same figures the share spells out in
  // full. Both read minMirrors from getPuzzleStats, so they cannot drift.
  const minMirrors = getPuzzleStats(puzzle.id).minMirrors;
  const efficiencyDetail =
    minMirrors === undefined
      ? pluralize(mirrorsUsed, "mirror")
      : mirrorsUsed - minMirrors <= 0
        ? "optimal"
        : `+${mirrorsUsed - minMirrors} over min`;

  const handleHome = useCallback(() => {
    play("uiTick");
    router.push("/");
  }, [router]);

  const handleSeeSolve = useCallback(() => {
    play("uiTick");
    if (!loadGameState(puzzle)) return;

    markTutorialSeen();
    router.push(solveRoute);
  }, [puzzle, router, solveRoute]);

  const handleReplay = useCallback(() => {
    play("uiTick");
    router.push(replayRoute);
  }, [router, replayRoute]);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      play("hintChime");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for environments without clipboard API
    }
  };

  if (!isReady) {
    return <main className="min-h-screen bg-black" />;
  }

  // Qualifiers only. Grid size was difficulty context the meters already
  // account for, so it is gone; what is left has to be disclosed. A clean
  // unhinted record solve is the common case and renders no line at all.
  const meta = [
    hintsUsed > 0 ? pluralize(hintsUsed, "hint") : null,
    isPractice ? "practice" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-black px-[max(1rem,env(safe-area-inset-left))] py-[max(0.75rem,env(safe-area-inset-bottom))] sm:py-[max(2rem,env(safe-area-inset-bottom))]">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="flex w-full max-w-md flex-col items-center gap-6 border border-white/10 bg-black px-5 py-8 sm:px-12 sm:py-10"
      >
        <div className="flex flex-col items-center gap-1.5">
          <h2 className="text-center text-[clamp(1.15rem,5.5vw,1.5rem)] tracking-[0.3em] text-white">
            LATTICE #{puzzle.id.toString().padStart(3, "0")}
          </h2>
          {meta !== "" && <span className={DETAIL_CLASS}>{meta}</span>}
        </div>

        {/* No caption. A 48px mono clock does not need to be told it is a time. */}
        <span className="font-mono text-4xl text-white sm:text-5xl">
          {formatTime(timeSeconds)}
        </span>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: SCORECARD_DELAY_S, duration: 0.4 }}
          // Centred as a group, not stretched: the rows are a fixed-width
          // block so their dot columns line up, and the block sits on the same
          // centre line as the heading and the time.
          className="mx-auto flex w-fit flex-col gap-2.5"
        >
          {efficiencyScore !== null && (
            <Meter
              label="Efficiency"
              score={efficiencyScore}
              detail={efficiencyDetail}
            />
          )}
          <Meter
            label="Speed"
            score={speedScore}
            detail={formatTime(timeSeconds)}
          />
          <Meter
            label="Accuracy"
            score={accuracyScore}
            detail={
              wrongNumberHits === 0
                ? "clean"
                : pluralize(wrongNumberHits, "mistake")
            }
          />
        </motion.div>

        {isDaily && (
          <div className="flex flex-col items-center gap-1">
            <span className={LABEL_CLASS}>Next puzzle in</span>
            <span className="font-mono text-lg text-white/80">{countdown}</span>
          </div>
        )}

        <div className="flex w-full flex-col items-center gap-4">
          {/* The share button's height is pinned rather than derived from
              padding plus the font's line-height, so swapping to the smaller
              confirmation size cannot resize the box. 46px is what py-3 +
              text-sm + the 1px borders already measured. whitespace-nowrap is
              safe because the confirmation measures 226.8px at these sizes,
              inside the 248px a 320px phone leaves for it. */}
          {!isPractice && (
            <button
              onClick={handleShare}
              className={`flex h-[46px] w-full items-center justify-center whitespace-nowrap border border-white/70 text-white transition-colors hover:border-white hover:bg-white/5 ${
                copied
                  ? "text-xs tracking-[0.1em] sm:text-sm"
                  : "text-sm tracking-[0.2em]"
              }`}
            >
              {copied ? "Copied! Share with Friends!" : "SHARE"}
            </button>
          )}

          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {!isDaily && (
              <button
                onClick={handleReplay}
                className={SECONDARY_LINK_CLASS}
              >
                Replay
              </button>
            )}
            {!isPractice && (
              <button
                onClick={handleSeeSolve}
                className={SECONDARY_LINK_CLASS}
              >
                See solve
              </button>
            )}
            <button onClick={handleHome} className={SECONDARY_LINK_CLASS}>
              Home
            </button>
          </div>
        </div>
      </motion.div>
    </main>
  );
}

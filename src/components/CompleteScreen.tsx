"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getPuzzleById, getPuzzleForDate, PUZZLE_001 } from "@/data/puzzles";
import { isPuzzleUnlocked } from "@/lib/archive";
import { loadGameState, saveGameState } from "@/lib/gameStorage";
import { markTutorialSeen } from "@/lib/tutorialStorage";
import type { Puzzle } from "@/lib/puzzleTypes";
import { getShareText } from "@/lib/shareText";
import { formatTime } from "@/lib/validation";

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

export default function CompleteScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const puzzle = useMemo(() => resolvePuzzle(searchParams), [searchParams]);
  // A practice run's completion: same victory screen, but Replay-only — the
  // recorded time (read from the record slot) is untouched and not re-shared.
  const isPractice = searchParams.get("practice") === "1";

  // The daily is a one-time solve — no replay. Only past puzzles can be replayed.
  const isDaily = useMemo(
    () => puzzle.id === getPuzzleForDate(new Date())?.id,
    [puzzle.id]
  );

  // Preserve ?puzzle=N so play/replay navigation stays on the archived puzzle.
  const playRoute = isDaily ? "/play" : `/play?puzzle=${puzzle.id}`;
  const replayRoute = `${playRoute}${playRoute.includes("?") ? "&" : "?"}replay=1`;

  const [copied, setCopied] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [timeSeconds, setTimeSeconds] = useState(0);
  const [mirrorsUsed, setMirrorsUsed] = useState(0);

  useEffect(() => {
    const saved = loadGameState(puzzle.id, isPractice ? "practice" : "record");
    if (!saved?.isComplete || saved.completionSeconds === null) {
      router.replace(playRoute);
      return;
    }

    setTimeSeconds(saved.completionSeconds);
    setMirrorsUsed(saved.mirrors.length);
    setIsReady(true);
  }, [puzzle.id, router, playRoute, isPractice]);

  const handleSeeSolve = useCallback(() => {
    const saved = loadGameState(puzzle.id);
    if (!saved) return;

    saveGameState({ ...saved, isViewingSolve: true });
    markTutorialSeen();
    router.push(playRoute);
  }, [puzzle.id, router, playRoute]);

  const handleReplay = useCallback(() => {
    router.push(replayRoute);
  }, [router, replayRoute]);

  const handleShare = async () => {
    const text = getShareText(puzzle.id, timeSeconds, mirrorsUsed);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for environments without clipboard API
    }
  };

  if (!isReady) {
    return <main className="min-h-screen bg-black" />;
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-black px-[max(1rem,env(safe-area-inset-left))] py-[max(2rem,env(safe-area-inset-bottom))]">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="flex w-full max-w-md flex-col items-center gap-6 border border-white/10 bg-black px-6 py-8 sm:px-12 sm:py-10"
      >
        <h2 className="text-[clamp(1.35rem,6.5vw,1.875rem)] tracking-[0.3em] text-white">
          LATTICE #{puzzle.id.toString().padStart(3, "0")}
        </h2>

        <div className="flex flex-col items-center gap-2">
          <span className="text-xs tracking-[0.2em] text-white/40">
            {isPractice ? "PRACTICE TIME" : "COMPLETION TIME"}
          </span>
          <span className="font-mono text-4xl text-white md:text-5xl">
            {formatTime(timeSeconds)}
          </span>
        </div>

        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
          className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#FF2D2D]"
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#FF2D2D"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </motion.div>

        <div className="mt-4 flex flex-wrap justify-center gap-4">
          {/* Daily is one-time; only past puzzles show Replay. */}
          {!isDaily && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleReplay}
              className="border border-white/20 px-6 py-3 text-sm tracking-[0.2em] text-white transition-colors hover:border-[#FF2D2D]/50"
            >
              REPLAY
            </motion.button>
          )}
          {!isPractice && (
            <>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSeeSolve}
                className="border border-white/20 px-6 py-3 text-sm tracking-[0.2em] text-white transition-colors hover:border-[#FF2D2D]/50"
              >
                SEE SOLVE
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleShare}
                className="border border-white/20 px-6 py-3 text-sm tracking-[0.2em] text-white transition-colors hover:border-[#FF2D2D]/50"
              >
                {copied ? "COPIED!" : "SHARE"}
              </motion.button>
            </>
          )}
        </div>
      </motion.div>
    </main>
  );
}

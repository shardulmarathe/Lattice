"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getPuzzleById, getPuzzleForDate, PUZZLE_001 } from "@/data/puzzles";
import { loadGameState, saveGameState } from "@/lib/gameStorage";
import type { Puzzle } from "@/lib/puzzleTypes";
import { getShareText } from "@/lib/shareText";
import { formatTime } from "@/lib/validation";

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

export default function CompleteScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const puzzle = useMemo(() => resolvePuzzle(searchParams), [searchParams]);
  const [copied, setCopied] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [timeSeconds, setTimeSeconds] = useState(0);
  const [mirrorsUsed, setMirrorsUsed] = useState(0);

  useEffect(() => {
    const saved = loadGameState(puzzle.id);
    if (!saved?.isComplete || saved.completionSeconds === null) {
      router.replace("/play");
      return;
    }

    setTimeSeconds(saved.completionSeconds);
    setMirrorsUsed(saved.mirrors.length);
    setIsReady(true);
  }, [puzzle.id, router]);

  const handleSeeSolve = useCallback(() => {
    const saved = loadGameState(puzzle.id);
    if (!saved) return;

    saveGameState({ ...saved, isViewingSolve: true });
    router.push("/play");
  }, [puzzle.id, router]);

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
    <main className="flex min-h-screen items-center justify-center bg-black px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="flex flex-col items-center gap-6 border border-white/10 bg-black px-12 py-10"
      >
        <h2 className="text-2xl tracking-[0.3em] text-white md:text-3xl">
          LATTICE #{puzzle.id.toString().padStart(3, "0")}
        </h2>

        <div className="flex flex-col items-center gap-2">
          <span className="text-xs tracking-[0.2em] text-white/40">
            COMPLETION TIME
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

        <div className="mt-4 flex gap-4">
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
        </div>
      </motion.div>
    </main>
  );
}

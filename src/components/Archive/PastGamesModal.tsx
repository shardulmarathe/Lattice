"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getPastPuzzleEntries } from "@/lib/archive";
import { getPuzzleById } from "@/data/puzzles";
import { getPuzzleProgress, type PuzzleProgress } from "@/lib/gameStorage";
import type { Puzzle } from "@/lib/puzzleTypes";
import { formatTime } from "@/lib/validation";
import PuzzleThumbnail from "./PuzzleThumbnail";

interface PastGamesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ArchiveCard {
  puzzle: Puzzle;
  dateKey: string;
  progress: PuzzleProgress;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** Format a YYYY-MM-DD key without constructing a timezone-sensitive Date. */
function formatDateLabel(dateKey: string): string {
  const [, month, day] = dateKey.split("-").map(Number);
  const monthName = MONTHS[(month ?? 1) - 1] ?? "";
  return `${monthName} ${day}`;
}

function statusLabel(progress: PuzzleProgress): string {
  if (progress.status === "solved" && progress.completionSeconds !== null) {
    return `SOLVED · ${formatTime(progress.completionSeconds)}`;
  }
  if (progress.status === "in-progress") return "IN PROGRESS";
  return "NEW";
}

function statusColor(progress: PuzzleProgress): string {
  if (progress.status === "solved") return "text-[#FF3B1F]";
  if (progress.status === "in-progress") return "text-white/80";
  return "text-white/40";
}

export default function PastGamesModal({
  isOpen,
  onClose,
}: PastGamesModalProps) {
  const router = useRouter();
  const [cards, setCards] = useState<ArchiveCard[]>([]);

  // localStorage + new Date() must run client-side; recompute each open so
  // status badges reflect solves the player just made.
  useEffect(() => {
    if (!isOpen) return;

    const entries = getPastPuzzleEntries(new Date());
    const next: ArchiveCard[] = [];

    for (const entry of entries) {
      const puzzle = getPuzzleById(entry.id);
      if (!puzzle) continue;
      next.push({
        puzzle,
        dateKey: entry.dateKey,
        progress: getPuzzleProgress(entry.id),
      });
    }

    setCards(next);
  }, [isOpen]);

  const handleSelect = (card: ArchiveCard) => {
    const route =
      card.progress.status === "solved"
        ? `/complete?puzzle=${card.puzzle.id}`
        : `/play?puzzle=${card.puzzle.id}`;
    router.push(route);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3 }}
            className="max-h-[90vh] w-full max-w-md overflow-y-auto border border-white/10 bg-black p-6 shadow-2xl md:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-1 text-xl tracking-[0.3em] text-white">
              PAST GAMES
            </h2>
            <p className="mb-6 text-sm leading-relaxed text-white/60">
              Replay a recent daily or catch up on one you missed.
            </p>

            {cards.length === 0 ? (
              <p className="py-8 text-center text-sm text-white/40">
                No past puzzles yet — check back tomorrow.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {cards.map((card) => (
                  <motion.button
                    key={card.puzzle.id}
                    type="button"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => handleSelect(card)}
                    className="flex items-center gap-4 border border-white/15 bg-black p-3 text-left transition-colors hover:border-[#FF2D2D]/60"
                  >
                    <PuzzleThumbnail
                      puzzle={card.puzzle}
                      size={56}
                      className="shrink-0"
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="text-sm tracking-[0.2em] text-white">
                        LATTICE #{card.puzzle.id.toString().padStart(3, "0")}
                      </span>
                      <span className="text-xs tracking-wider text-white/40">
                        {formatDateLabel(card.dateKey)}
                      </span>
                      <span
                        className={`text-xs tracking-[0.15em] ${statusColor(
                          card.progress
                        )}`}
                      >
                        {statusLabel(card.progress)}
                      </span>
                    </div>
                    <span className="shrink-0 text-white/30" aria-hidden>
                      →
                    </span>
                  </motion.button>
                ))}
              </div>
            )}

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onClose}
              className="mt-8 w-full border border-white/20 py-3 text-sm tracking-[0.2em] text-white transition-colors hover:border-[#FF2D2D]/50"
            >
              CLOSE
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

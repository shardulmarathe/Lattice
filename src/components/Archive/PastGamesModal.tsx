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

interface ArchiveRow {
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

/**
 * The outcome column. An unplayed puzzle shows a dim middle dot: it has no
 * result rather than a status worth a word, and "---" read as broken data.
 * The dot is decorative, so the accessible name is spelled out separately.
 */
function outcomeLabel(progress: PuzzleProgress): string {
  if (progress.status === "solved" && progress.completionSeconds !== null) {
    return formatTime(progress.completionSeconds);
  }
  if (progress.status === "in-progress") return "In progress";
  return "·";
}

function outcomeDescription(progress: PuzzleProgress): string {
  if (progress.status === "solved") return "solved";
  if (progress.status === "in-progress") return "in progress";
  return "not played";
}

function outcomeClass(progress: PuzzleProgress): string {
  if (progress.status === "solved") return "text-sm text-white";
  if (progress.status === "in-progress") return "text-sm text-white/70";
  // Bigger and a little brighter than the times, because a 14px middle dot at
  // white/30 disappeared entirely and read as a rendering gap.
  return "text-xl leading-none text-white/40";
}

export default function PastGamesModal({
  isOpen,
  onClose,
}: PastGamesModalProps) {
  const router = useRouter();
  const [rows, setRows] = useState<ArchiveRow[]>([]);

  // localStorage + new Date() must run client-side; recompute each open so
  // outcomes reflect solves the player just made.
  useEffect(() => {
    if (!isOpen) return;

    const entries = getPastPuzzleEntries(new Date());
    const next: ArchiveRow[] = [];

    for (const entry of entries) {
      const puzzle = getPuzzleById(entry.id);
      if (!puzzle) continue;
      next.push({
        puzzle,
        dateKey: entry.dateKey,
        progress: getPuzzleProgress(puzzle),
      });
    }

    setRows(next);
  }, [isOpen]);

  // Escape closes, which no modal in this app used to support.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  const handleSelect = (row: ArchiveRow) => {
    const route =
      row.progress.status === "solved"
        ? `/complete?puzzle=${row.puzzle.id}`
        : `/play?puzzle=${row.puzzle.id}`;
    router.push(route);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          // Opaque. At bg-black/80 the LATTICE wordmark stayed legible behind
          // the panel, which read as a rendering bug rather than as depth, and
          // even 3% of a wordmark that large still shows. Separation is carried
          // by the panel's hairline border instead of by a scrim gradient.
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black px-4 py-6"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.25 }}
            role="dialog"
            aria-modal="true"
            aria-label="Past games"
            className="max-h-[90vh] w-full max-w-sm overflow-y-auto border border-white/15 bg-black p-5 sm:p-6 md:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <h2 className="text-base tracking-[0.3em] text-white">
                PAST GAMES
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="-mr-1 -mt-1 px-2 py-1 text-lg leading-none text-white/50 transition-colors hover:text-white"
              >
                ×
              </button>
            </div>

            {rows.length === 0 ? (
              <p className="py-8 text-center text-xs text-white/50">
                No past puzzles yet. Check back tomorrow.
              </p>
            ) : (
              <div className="flex flex-col">
                {rows.map((row) => (
                  <button
                    key={row.puzzle.id}
                    type="button"
                    onClick={() => handleSelect(row)}
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-t border-white/10 py-3 text-left transition-colors last:border-b hover:bg-white/5 sm:gap-4"
                  >
                    <PuzzleThumbnail
                      puzzle={row.puzzle}
                      className="h-12 w-12 shrink-0 sm:h-16 sm:w-16"
                    />
                    {/* Date and number as one group, so the result is the only
                        thing on the far right and there is no dead gap. */}
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-sm text-white/85">
                        {formatDateLabel(row.dateKey)}
                      </span>
                      <span className="text-xs text-white/45">
                        #{row.puzzle.id.toString().padStart(3, "0")}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 font-mono ${outcomeClass(row.progress)}`}
                    >
                      {outcomeLabel(row.progress)}
                      <span className="sr-only">
                        {" "}
                        {outcomeDescription(row.progress)}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

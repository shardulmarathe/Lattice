"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { formatTime } from "@/lib/validation";
import { getShareText } from "@/lib/shareText";

interface CompletionModalProps {
  puzzleId: number;
  timeSeconds: number;
  mirrorsUsed: number;
  onSeeSolve: () => void;
}

export default function CompletionModal({
  puzzleId,
  timeSeconds,
  mirrorsUsed,
  onSeeSolve,
}: CompletionModalProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const text = getShareText(puzzleId, timeSeconds, mirrorsUsed);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for environments without clipboard API
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="flex flex-col items-center gap-6 border border-white/10 bg-black px-12 py-10"
        >
          <h2 className="text-2xl tracking-[0.3em] text-white md:text-3xl">
            LATTICE #{puzzleId.toString().padStart(3, "0")}
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
              onClick={onSeeSolve}
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
      </motion.div>
    </AnimatePresence>
  );
}

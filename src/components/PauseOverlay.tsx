"use client";

import { AnimatePresence, motion } from "framer-motion";

interface PauseOverlayProps {
  isOpen: boolean;
  onResume: () => void;
}

export default function PauseOverlay({ isOpen, onResume }: PauseOverlayProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 px-4 backdrop-blur-[2px]"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.25 }}
            className="flex w-full max-w-xs flex-col items-center gap-8 border border-white/10 bg-black px-10 py-10"
          >
            <h2 className="text-xl tracking-[0.3em] text-white">PAUSED</h2>

            <button
              onClick={onResume}
              className="w-full border border-white/20 py-3 text-sm tracking-[0.2em] text-white transition-colors hover:border-white/70 hover:bg-white/5"
            >
              RESUME
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

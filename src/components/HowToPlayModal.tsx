"use client";

import { AnimatePresence, motion } from "framer-motion";

interface HowToPlayModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function HowToPlayModal({ isOpen, onClose }: HowToPlayModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 px-6 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3 }}
            className="max-h-[80vh] w-full max-w-lg overflow-y-auto border border-white/10 bg-black p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-6 text-xl tracking-[0.3em] text-white">
              HOW TO PLAY
            </h2>

            <div className="space-y-4 text-sm leading-relaxed text-white/70">
              <p>
                Route the laser from the source through numbered tiles in the
                exact order shown by the target code, then reach the flag.
              </p>
              <p>
                Click empty cells to place mirrors. Click again to cycle between{" "}
                <span className="text-white">/</span> and{" "}
                <span className="text-white">\</span>, then remove.
              </p>
              <p>
                The laser updates instantly as you place mirrors. It cannot pass
                through obstacles or revisit cells.
              </p>
              <p>
                Your score is based on completion time. Solve faster for a
                better result.
              </p>
            </div>

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

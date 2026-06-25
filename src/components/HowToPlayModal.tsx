"use client";

import { AnimatePresence, motion } from "framer-motion";
import { TUTORIAL_SCENARIOS } from "@/data/tutorialScenarios";
import TutorialDemo from "./HowToPlay/TutorialDemo";

interface HowToPlayModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called when the user confirms (e.g. mark tutorial seen before playing). */
  onConfirm?: () => void;
  confirmLabel?: string;
  /** Lighter backdrop so a loaded game board stays visible behind the modal. */
  overlayOnGame?: boolean;
  /** When false, clicking the backdrop does not close the modal. */
  dismissOnBackdrop?: boolean;
}

export default function HowToPlayModal({
  isOpen,
  onClose,
  onConfirm,
  confirmLabel = "LET'S PLAY!",
  overlayOnGame = false,
  dismissOnBackdrop = true,
}: HowToPlayModalProps) {
  const handleConfirm = () => {
    onConfirm?.();
    onClose();
  };

  const handleBackdropClick = () => {
    if (dismissOnBackdrop) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`fixed inset-0 z-[100] flex items-center justify-center px-4 py-6 ${
            overlayOnGame
              ? "bg-black/45 backdrop-blur-[2px]"
              : "bg-black/80 backdrop-blur-sm"
          }`}
          onClick={handleBackdropClick}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3 }}
            className="max-h-[90vh] w-full max-w-md overflow-y-auto border border-white/10 bg-black p-6 shadow-2xl md:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-3 text-xl tracking-[0.3em] text-white">
              HOW TO PLAY
            </h2>

            <p className="mb-4 text-sm leading-relaxed text-white/80">
              Route the laser from the source through numbered tiles in the
              exact order shown by the target code, then reach the flag.
            </p>

            <ul className="mb-6 list-disc space-y-2 pl-5 text-sm leading-relaxed text-white/70">
              <li>
                Click empty cells to place mirrors. Click again to cycle{" "}
                <span className="text-white">/</span> and{" "}
                <span className="text-white">\</span>, then remove.
              </li>
              <li>Collect every digit of the target code in order.</li>
              <li>
                Lasers can cross paths and revisit cells. Hitting the flag
                early does not solve the puzzle.
              </li>
              <li>
                Your score is based on completion time — solve faster for a
                better result.
              </li>
            </ul>

            <p className="mb-4 text-sm font-medium text-white/90">Examples</p>

            <div className="space-y-5">
              {TUTORIAL_SCENARIOS.map((scenario) => (
                <div key={scenario.id} className="flex items-center gap-4">
                  <TutorialDemo scenario={scenario} />
                  <p className="flex-1 text-sm leading-snug text-white/75">
                    {scenario.caption}
                  </p>
                </div>
              ))}
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleConfirm}
              className="mt-8 w-full border border-white/20 py-3 text-sm tracking-[0.2em] text-white transition-colors hover:border-[#FF2D2D]/50"
            >
              {confirmLabel}
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

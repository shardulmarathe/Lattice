"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  MIRROR_CYCLE_SECTION,
  TUTORIAL_SCENARIOS,
} from "@/data/tutorialScenarios";
import MirrorCycleDemo from "./HowToPlay/MirrorCycleDemo";
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

function DemoRow({
  title,
  caption,
  children,
}: {
  title: string;
  caption: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      {children}
      <div className="min-w-0 flex-1">
        <p className="mb-1 text-[11px] uppercase tracking-[0.25em] text-white">
          {title}
        </p>
        <p className="text-xs leading-snug text-white/70">{caption}</p>
      </div>
    </div>
  );
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
            className="max-h-[90vh] w-full max-w-md overflow-y-auto border border-white/10 bg-black p-4 shadow-2xl md:max-w-lg md:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-2 text-xl tracking-[0.3em] text-white">
              HOW TO PLAY
            </h2>

            <p className="mb-4 text-sm leading-relaxed text-white/80">
              Guide the laser through every number in the target code, then
              reach the flag.
            </p>

            <div className="space-y-3">
              <DemoRow
                title={MIRROR_CYCLE_SECTION.title}
                caption={MIRROR_CYCLE_SECTION.caption}
              >
                <MirrorCycleDemo />
              </DemoRow>

              {TUTORIAL_SCENARIOS.map((scenario) => (
                <DemoRow
                  key={scenario.id}
                  title={scenario.title}
                  caption={scenario.caption}
                >
                  <TutorialDemo scenario={scenario} />
                </DemoRow>
              ))}
            </div>

            <div className="mt-4 border border-white/10 bg-white/[0.03] p-3">
              <p className="mb-1.5 text-[10px] uppercase tracking-[0.3em] text-white/50">
                Remember
              </p>
              <ul className="space-y-1 text-xs leading-snug text-white/70">
                <li>• Laser paths can overlap.</li>
                <li>• The source does not block lasers.</li>
                <li>• Reach the flag after collecting every number.</li>
              </ul>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleConfirm}
              className="mt-4 w-full border border-white/20 py-2.5 text-sm tracking-[0.2em] text-white transition-colors hover:border-[#FF2D2D]/50"
            >
              {confirmLabel}
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

"use client";

import { useEffect, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  MIRROR_CYCLE_SECTION,
  TUTORIAL_SCENARIOS,
} from "@/data/tutorialScenarios";
import { play } from "@/lib/audio/engine";
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
    <div className="flex items-center gap-4">
      {children}
      <div className="min-w-0 flex-1">
        <p className="mb-1.5 text-xs uppercase tracking-[0.2em] text-white">
          {title}
        </p>
        <p className="text-[13px] leading-snug text-white/70">{caption}</p>
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
  // Escape closes, which no modal in this app used to support. Gated on
  // dismissOnBackdrop so a forced first-run reading cannot be keyed past.
  useEffect(() => {
    if (!isOpen || !dismissOnBackdrop) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, dismissOnBackdrop, onClose]);

  const handleConfirm = () => {
    play("uiTick");
    onConfirm?.();
    onClose();
  };

  const handleBackdropClick = () => {
    if (dismissOnBackdrop) {
      play("uiTick");
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
          // Over the board the scrim stays translucent on purpose: you need
          // to see the puzzle you are reading the rules for. Over the menu it
          // is opaque, because a partly-transparent black scrim on a black page
          // only let the wordmark bleed through.
          className={`fixed inset-0 z-[100] flex items-center justify-center px-3 py-3 ${
            overlayOnGame ? "bg-black/45 backdrop-blur-[2px]" : "bg-black"
          }`}
          onClick={handleBackdropClick}
        >
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.25 }}
            // No shadow: a drop shadow under a black panel on a black page
            // renders nothing.
            className="flex w-full max-w-[30rem] flex-col border border-white/15 bg-black p-7 md:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h2 className="mb-2 text-xl tracking-[0.3em] text-white">
                HOW TO PLAY
              </h2>

              <p className="mb-6 text-[15px] leading-relaxed text-white/80">
                Hit every number in the target code, in order, then the flag.
              </p>

              <div className="space-y-5">
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

              <p className="mt-6 text-[13px] leading-snug text-white/70">
                The laser can cross itself, revisit squares, and pass through
                the source.
              </p>
            </div>

            <button
              onClick={handleConfirm}
              className="mt-8 w-full shrink-0 border border-white/20 py-3 text-[15px] tracking-[0.2em] text-white transition-colors hover:border-white/70 hover:bg-white/5"
            >
              {confirmLabel}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

"use client";

import { AnimatePresence, motion } from "framer-motion";

interface WarningBannerProps {
  message: string | null;
  inline?: boolean;
}

const warningClass =
  "animate-warning-flash-glow text-center text-[1.5rem] font-bold leading-snug text-[#FF4444] md:text-[1.85rem]";

export default function WarningBanner({ message, inline = false }: WarningBannerProps) {
  if (inline) {
    // A min-height slot, not a fixed one: two lines are reserved so a warning
    // appearing never shifts the text under it, and the rare third line grows
    // the slot instead of spilling onto that text.
    return (
      <div className="flex min-h-[4.25rem] w-full max-w-lg items-start justify-center md:min-h-[5.25rem]">
        <AnimatePresence>
          {message && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className={`w-full ${warningClass}`}
            >
              {message}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="overflow-hidden"
        >
          <p className={`px-4 py-3 ${warningClass}`}>{message}</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

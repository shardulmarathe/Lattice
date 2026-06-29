"use client";

import { AnimatePresence, motion } from "framer-motion";

interface WarningBannerProps {
  message: string | null;
  inline?: boolean;
}

const warningClass =
  "animate-warning-flash-glow text-center text-xl font-medium text-[#FF4444] md:text-[1.4rem]";

export default function WarningBanner({ message, inline = false }: WarningBannerProps) {
  if (inline) {
    return (
      <div className="relative h-10 w-full max-w-lg md:h-[3.75rem]">
        <AnimatePresence>
          {message && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className={`absolute inset-x-0 top-0 ${warningClass}`}
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

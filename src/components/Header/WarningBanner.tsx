"use client";

import { AnimatePresence, motion } from "framer-motion";

interface WarningBannerProps {
  message: string | null;
  inline?: boolean;
}

export default function WarningBanner({ message, inline = false }: WarningBannerProps) {
  if (inline) {
    return (
      <div className="relative h-6 w-full max-w-lg">
        <AnimatePresence>
          {message && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="absolute inset-x-0 top-0 text-center text-sm text-[#FF4444] md:text-base"
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
          <p className="px-4 py-2 text-center text-sm text-[#FF4444] md:text-base">
            {message}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

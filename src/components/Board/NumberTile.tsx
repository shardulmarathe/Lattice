"use client";

import { motion } from "framer-motion";

interface NumberTileProps {
  value: number;
  size: number;
  isCollected: boolean;
  isIncorrect: boolean;
}

export default function NumberTile({
  value,
  size,
  isCollected,
  isIncorrect,
}: NumberTileProps) {
  const isActive = isIncorrect || isCollected;

  return (
    <motion.div
      className={`flex items-center justify-center font-mono font-light ${
        isIncorrect
          ? "animate-number-error-glow rounded-sm"
          : isCollected
            ? "animate-number-glow rounded-sm text-white"
            : "text-white"
      }`}
      style={{ width: size, height: size, fontSize: size * 0.45 }}
      animate={isActive ? { scale: [1, 1.05, 1] } : { scale: 1 }}
      transition={{ duration: 2, repeat: isActive ? Infinity : 0 }}
    >
      {value}
    </motion.div>
  );
}

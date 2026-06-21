"use client";

import { motion } from "framer-motion";

interface NumberTileProps {
  value: number;
  size: number;
  isCollected: boolean;
}

export default function NumberTile({
  value,
  size,
  isCollected,
}: NumberTileProps) {
  return (
    <motion.div
      className={`flex items-center justify-center font-mono font-light text-white ${
        isCollected ? "animate-number-glow rounded-sm" : ""
      }`}
      style={{ width: size, height: size, fontSize: size * 0.45 }}
      animate={isCollected ? { scale: [1, 1.05, 1] } : { scale: 1 }}
      transition={{ duration: 2, repeat: isCollected ? Infinity : 0 }}
    >
      {value}
    </motion.div>
  );
}

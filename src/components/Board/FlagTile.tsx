"use client";

import { motion } from "framer-motion";

interface FlagTileProps {
  size: number;
  isIncorrect?: boolean;
}

export default function FlagTile({
  size,
  isIncorrect = false,
}: FlagTileProps) {
  const flagSize = size * 0.5;

  return (
    <motion.div
      className={`flex items-center justify-center ${
        isIncorrect ? "animate-number-error-glow rounded-sm" : ""
      }`}
      style={{ width: size, height: size }}
      animate={isIncorrect ? { scale: [1, 1.05, 1] } : { scale: 1 }}
      transition={{ duration: 2, repeat: isIncorrect ? Infinity : 0 }}
    >
      <svg
        width={flagSize}
        height={flagSize}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={isIncorrect ? "text-[#FF3B1F]" : "text-white"}
      >
        <g transform="translate(2 0)">
          <path
            d="M5 21V3M5 3L15 7L5 11"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </svg>
    </motion.div>
  );
}

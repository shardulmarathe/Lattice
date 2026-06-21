"use client";

import { motion } from "framer-motion";
import { useId } from "react";
import type { MirrorOrientation } from "@/lib/puzzleTypes";

interface MirrorTileProps {
  orientation: MirrorOrientation;
  size: number;
}

export default function MirrorTile({ orientation, size }: MirrorTileProps) {
  const uid = useId().replace(/:/g, "");
  const pad = size * 0.14;
  const isForwardSlash = orientation === "/";

  // "/" → y = -x (SW to NE); "\" → y = x (NW to SE)
  const x1 = isForwardSlash ? pad : pad;
  const y1 = isForwardSlash ? size - pad : pad;
  const x2 = isForwardSlash ? size - pad : size - pad;
  const y2 = isForwardSlash ? pad : size - pad;

  const faceId = `mirror-face-${uid}`;
  const shineId = `mirror-shine-${uid}`;

  return (
    <motion.div
      className="pointer-events-none relative flex items-center justify-center"
      style={{ width: size, height: size }}
      initial={false}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.15 }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0"
        aria-hidden
      >
        <defs>
          <linearGradient
            id={faceId}
            gradientUnits="userSpaceOnUse"
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
          >
            <stop offset="0%" stopColor="rgba(255,255,255,0.15)" />
            <stop offset="35%" stopColor="rgba(255,255,255,0.85)" />
            <stop offset="65%" stopColor="rgba(255,255,255,0.95)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.2)" />
          </linearGradient>
          <linearGradient
            id={shineId}
            gradientUnits="userSpaceOnUse"
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
          >
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="48%" stopColor="rgba(255,255,255,0)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.7)" />
            <stop offset="52%" stopColor="rgba(255,255,255,0)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>

        {/* Glass backing */}
        <rect
          x={pad * 0.5}
          y={pad * 0.5}
          width={size - pad}
          height={size - pad}
          fill="rgba(255,255,255,0.03)"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="0.5"
        />

        {/* Mirror surface glow */}
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="rgba(255,255,255,0.25)"
          strokeWidth={size * 0.1}
          strokeLinecap="round"
        />

        {/* Mirror face */}
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={`url(#${faceId})`}
          strokeWidth={size * 0.055}
          strokeLinecap="round"
        />

        {/* Specular highlight */}
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={`url(#${shineId})`}
          strokeWidth={size * 0.02}
          strokeLinecap="round"
        />
      </svg>
    </motion.div>
  );
}

"use client";

import { motion } from "framer-motion";
import { useId } from "react";
import type { MirrorOrientation } from "@/lib/puzzleTypes";
import {
  getMirrorLineInCell,
  MIRROR_FACE_STROKE_RATIO,
  MIRROR_GLOW_STROKE_RATIO,
  MIRROR_PAD_RATIO,
} from "@/lib/laserPathUtils";

interface MirrorTileProps {
  orientation: MirrorOrientation;
  size: number;
  offsetX?: number;
  offsetY?: number;
}

export default function MirrorTile({
  orientation,
  size,
  offsetX = 0,
  offsetY = 0,
}: MirrorTileProps) {
  const uid = useId().replace(/:/g, "");
  const { x1, y1, x2, y2 } = getMirrorLineInCell(size, orientation);
  const pad = size * MIRROR_PAD_RATIO;

  const faceId = `mirror-face-${uid}`;
  const shineId = `mirror-shine-${uid}`;

  return (
    <motion.div
      className="pointer-events-none relative z-40 flex items-center justify-center"
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
        <g transform={`translate(${offsetX} ${offsetY})`}>
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

          <rect
            x={pad * 0.5}
            y={pad * 0.5}
            width={size - pad}
            height={size - pad}
            fill="rgba(255,255,255,0.02)"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="0.5"
          />

          <line
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="rgba(255,255,255,0.2)"
            strokeWidth={size * MIRROR_GLOW_STROKE_RATIO}
            strokeLinecap="round"
          />

          <line
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={`url(#${faceId})`}
            strokeWidth={size * MIRROR_FACE_STROKE_RATIO}
            strokeLinecap="round"
          />

          <line
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={`url(#${shineId})`}
            strokeWidth={size * 0.015}
            strokeLinecap="round"
          />
        </g>
      </svg>
    </motion.div>
  );
}

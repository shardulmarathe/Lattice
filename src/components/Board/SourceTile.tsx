"use client";

import type { Direction } from "@/lib/puzzleTypes";

interface SourceTileProps {
  direction: Direction;
  size: number;
}

const ROTATION: Record<Direction, number> = {
  right: 0,
  down: 90,
  left: 180,
  up: -90,
};

export default function SourceTile({ direction, size }: SourceTileProps) {
  const uid = `src-${direction}`;
  const rotation = ROTATION[direction];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className="relative z-10"
      aria-hidden
    >
      <defs>
        <radialGradient id={`${uid}-base`} cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#3a3a3a" />
          <stop offset="55%" stopColor="#141414" />
          <stop offset="100%" stopColor="#050505" />
        </radialGradient>
        <linearGradient id={`${uid}-barrel`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2a2a2a" />
          <stop offset="40%" stopColor="#0a0a0a" />
          <stop offset="100%" stopColor="#1a1a1a" />
        </linearGradient>
        <filter id={`${uid}-glow`} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g transform={`rotate(${rotation} 24 24)`}>
        {/* Outer ring */}
        <circle
          cx="24"
          cy="24"
          r="15"
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="0.75"
        />

        {/* Metallic base */}
        <circle cx="24" cy="24" r="13.5" fill={`url(#${uid}-base)`} />
        <ellipse
          cx="20"
          cy="19"
          rx="5"
          ry="3"
          fill="rgba(255,255,255,0.06)"
          transform="rotate(-20 20 19)"
        />

        {/* Inner recess */}
        <circle cx="24" cy="24" r="9" fill="#080808" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />

        {/* Turret barrel */}
        <rect
          x="22"
          y="21.5"
          width="14"
          height="5"
          rx="1.5"
          fill={`url(#${uid}-barrel)`}
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="0.5"
        />
        <rect
          x="22.5"
          y="22.2"
          width="12"
          height="1.2"
          rx="0.5"
          fill="rgba(255,255,255,0.07)"
        />

        {/* Barrel tip housing */}
        <rect
          x="34"
          y="21"
          width="3.5"
          height="6"
          rx="1"
          fill="#111"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="0.4"
        />

        {/* Emitter glow halo */}
        <circle cx="37.5" cy="24" r="4" fill="#FF2D2D" opacity="0.15" filter={`url(#${uid}-glow)`} />

        {/* Emitter aperture */}
        <circle cx="37.5" cy="24" r="2" fill="#FF2D2D" filter={`url(#${uid}-glow)`} />
        <circle cx="37.5" cy="24" r="0.8" fill="#FFFFFF" opacity="0.9" />
      </g>
    </svg>
  );
}

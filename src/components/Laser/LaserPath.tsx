"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { LaserSegment, Position } from "@/lib/puzzleTypes";
import {
  buildContinuousPath,
  buildVictoryLinearPath,
  FLAG_ORBIT_RADIUS_RATIO,
  getFlagVisualCenter,
  getPointOnPath,
  toPixel,
} from "@/lib/laserPathUtils";

interface LaserPathProps {
  segments: LaserSegment[];
  gridSize: number;
  cellSize: number;
  /** When true, beam stops at flag orbit; path particles still flow along the solution. */
  victoryMode?: boolean;
  flagPosition?: Position;
}

const PARTICLE_COUNT = 7;
const PARTICLE_OFFSETS = Array.from(
  { length: PARTICLE_COUNT },
  (_, i) => i / PARTICLE_COUNT
);

interface Particle {
  x: number;
  y: number;
  opacity: number;
  radius: number;
}

export default function LaserPath({
  segments,
  gridSize,
  cellSize,
  victoryMode = false,
  flagPosition,
}: LaserPathProps) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [particlesEnabled, setParticlesEnabled] = useState(false);
  const phaseRef = useRef(0);
  const rafRef = useRef<number>(0);

  const boardSize = gridSize * cellSize;
  const path = useMemo(() => {
    if (victoryMode && flagPosition) {
      return buildVictoryLinearPath(segments, cellSize, flagPosition);
    }
    return buildContinuousPath(segments, cellSize);
  }, [segments, cellSize, victoryMode, flagPosition]);

  useEffect(() => {
    const id = requestAnimationFrame(() => setParticlesEnabled(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!particlesEnabled || path.totalLength === 0) {
      setParticles([]);
      return;
    }

    const animate = () => {
      phaseRef.current += 0.004;
      const phase = phaseRef.current;

      const nextParticles: Particle[] = PARTICLE_OFFSETS.map((offset, i) => {
        const t = (phase + offset) % 1;
        const point = getPointOnPath(path, t);
        if (!point) return { x: 0, y: 0, opacity: 0, radius: 0 };

        const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 + i * 1.2);
        return {
          x: point.x,
          y: point.y,
          opacity: 0.35 + pulse * 0.55,
          radius: 1.2 + pulse * 0.8,
        };
      });

      setParticles(nextParticles);
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [path, particlesEnabled]);

  const orbitRadius = cellSize * FLAG_ORBIT_RADIUS_RATIO;

  const getSegmentPixels = (seg: LaserSegment, index: number) => {
    let from = toPixel(seg.from.x, seg.from.y, cellSize);
    let to = toPixel(seg.to.x, seg.to.y, cellSize);

    const isLast = index === segments.length - 1;
    if (
      victoryMode &&
      flagPosition &&
      isLast &&
      seg.to.x === flagPosition.x &&
      seg.to.y === flagPosition.y
    ) {
      const flagCenter = getFlagVisualCenter(
        flagPosition.x,
        flagPosition.y,
        cellSize
      );
      const dx = flagCenter.x - from.x;
      const dy = flagCenter.y - from.y;
      const mag = Math.hypot(dx, dy) || 1;
      to = {
        x: flagCenter.x - (dx / mag) * orbitRadius,
        y: flagCenter.y - (dy / mag) * orbitRadius,
      };
    }

    return { from, to };
  };

  if (segments.length === 0) return null;

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-30"
      width={boardSize}
      height={boardSize}
      style={{ overflow: "visible" }}
    >
      <defs>
        <filter id="beam-bloom" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {segments.map((seg, i) => {
        const { from, to } = getSegmentPixels(seg, i);
        const key = `${seg.from.x}-${seg.from.y}-${seg.to.x}-${seg.to.y}-${i}`;

        return (
          <g key={key}>
            {/* Layer 3: outer bloom */}
            <line
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="#FF2D2D"
              strokeWidth={8}
              strokeLinecap="round"
              strokeOpacity={0.18}
              filter="url(#beam-bloom)"
            />
            {/* Layer 2: red beam body */}
            <line
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="#FF2D2D"
              strokeWidth={3.5}
              strokeLinecap="round"
              strokeOpacity={0.85}
            />
            {/* Layer 1: white core */}
            <line
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="#FFFFFF"
              strokeWidth={1}
              strokeLinecap="round"
              strokeOpacity={0.95}
            />
          </g>
        );
      })}

      {/* Energy particles */}
      {particles.map((p, i) => (
        <g key={`particle-${i}`}>
          <circle
            cx={p.x}
            cy={p.y}
            r={p.radius + 2}
            fill="#FF2D2D"
            opacity={p.opacity * 0.25}
          />
          <circle
            cx={p.x}
            cy={p.y}
            r={p.radius}
            fill="#FFFFFF"
            opacity={p.opacity}
          />
        </g>
      ))}
    </svg>
  );
}

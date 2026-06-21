"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { LaserSegment } from "@/lib/puzzleTypes";
import {
  buildContinuousPath,
  getPointOnPath,
  toPixel,
} from "@/lib/laserPathUtils";

interface LaserPathProps {
  segments: LaserSegment[];
  gridSize: number;
  cellSize: number;
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
}: LaserPathProps) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const phaseRef = useRef(0);
  const rafRef = useRef<number>(0);

  const boardSize = gridSize * cellSize;
  const path = useMemo(
    () => buildContinuousPath(segments, cellSize),
    [segments, cellSize]
  );

  useEffect(() => {
    if (path.totalLength === 0) {
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
  }, [path]);

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
        const from = toPixel(seg.from.x, seg.from.y, cellSize);
        const to = toPixel(seg.to.x, seg.to.y, cellSize);
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

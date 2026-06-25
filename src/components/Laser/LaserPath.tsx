"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { LaserSegment, Position } from "@/lib/puzzleTypes";
import {
  buildContinuousPath,
  buildVictoryLinearPath,
  getPointOnPath,
  type ContinuousPath,
  type PathPoint,
} from "@/lib/laserPathUtils";

interface LaserPathProps {
  segments: LaserSegment[];
  gridSize: number;
  cellSize: number;
  victoryMode?: boolean;
  flagPosition?: Position;
  /** 0–1: partial beam draw for tutorial animations. Default 1 = full beam. */
  drawProgress?: number;
  showParticles?: boolean;
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

interface ClippedSegment {
  from: PathPoint;
  to: PathPoint;
}

function clipPathToProgress(
  path: ContinuousPath,
  progress: number
): ClippedSegment[] {
  if (path.points.length < 2 || progress <= 0) return [];

  const clamped = Math.min(1, Math.max(0, progress));
  if (clamped >= 1) {
    return path.points.slice(1).map((to, i) => ({
      from: path.points[i],
      to,
    }));
  }

  const targetLength = clamped * path.totalLength;
  const clipped: ClippedSegment[] = [];
  let walked = 0;

  for (let i = 0; i < path.segmentLengths.length; i++) {
    const segLen = path.segmentLengths[i];
    const from = path.points[i];
    const to = path.points[i + 1];

    if (walked + segLen <= targetLength) {
      clipped.push({ from, to });
      walked += segLen;
      continue;
    }

    if (walked < targetLength) {
      const ratio = segLen === 0 ? 0 : (targetLength - walked) / segLen;
      clipped.push({
        from,
        to: {
          x: from.x + (to.x - from.x) * ratio,
          y: from.y + (to.y - from.y) * ratio,
        },
      });
    }
    break;
  }

  return clipped;
}

export default function LaserPath({
  segments,
  gridSize,
  cellSize,
  victoryMode = false,
  flagPosition,
  drawProgress = 1,
  showParticles = true,
}: LaserPathProps) {
  const filterId = useId().replace(/:/g, "");
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

  const clippedSegments = useMemo(
    () => clipPathToProgress(path, drawProgress),
    [path, drawProgress]
  );

  useEffect(() => {
    if (!showParticles) return;
    const id = requestAnimationFrame(() => setParticlesEnabled(true));
    return () => cancelAnimationFrame(id);
  }, [showParticles]);

  useEffect(() => {
    if (!showParticles || !particlesEnabled || path.totalLength === 0) {
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
  }, [path, particlesEnabled, showParticles]);

  if (segments.length === 0) return null;

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-30"
      width={boardSize}
      height={boardSize}
      style={{ overflow: "visible" }}
    >
      <defs>
        <filter
          id={`beam-bloom-${filterId}`}
          x="-80%"
          y="-80%"
          width="260%"
          height="260%"
        >
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {clippedSegments.map((seg, i) => {
        const key = `clip-${seg.from.x}-${seg.from.y}-${seg.to.x}-${seg.to.y}-${i}`;

        return (
          <g key={key}>
            <line
              x1={seg.from.x}
              y1={seg.from.y}
              x2={seg.to.x}
              y2={seg.to.y}
              stroke="#FF4A2D"
              strokeWidth={8}
              strokeLinecap="round"
              strokeOpacity={0.28}
              filter={`url(#beam-bloom-${filterId})`}
            />
            <line
              x1={seg.from.x}
              y1={seg.from.y}
              x2={seg.to.x}
              y2={seg.to.y}
              stroke="#FF3B1F"
              strokeWidth={3.5}
              strokeLinecap="round"
              strokeOpacity={0.95}
            />
            <line
              x1={seg.from.x}
              y1={seg.from.y}
              x2={seg.to.x}
              y2={seg.to.y}
              stroke="#FFFFFF"
              strokeWidth={1}
              strokeLinecap="round"
              strokeOpacity={0.95}
            />
          </g>
        );
      })}

      {showParticles &&
        particles.map((p, i) => (
          <g key={`particle-${i}`}>
            <circle
              cx={p.x}
              cy={p.y}
              r={p.radius + 2}
              fill="#FF3B1F"
              opacity={p.opacity * 0.3}
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

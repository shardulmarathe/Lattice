"use client";

import { useEffect, useRef, useState } from "react";
import {
  FLAG_ORBIT_RADIUS_RATIO,
  getFlagVisualCenter,
  getPointOnCircle,
} from "@/lib/laserPathUtils";

interface FlagVictoryLaserProps {
  flagX: number;
  flagY: number;
  cellSize: number;
  boardSize: number;
}

const ORBIT_PARTICLE_COUNT = 5;
const ORBIT_SPEED = 0.007;

interface Particle {
  x: number;
  y: number;
  opacity: number;
  radius: number;
}

export default function FlagVictoryLaser({
  flagX,
  flagY,
  cellSize,
  boardSize,
}: FlagVictoryLaserProps) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const phaseRef = useRef(0);
  const rafRef = useRef<number>(0);

  const center = getFlagVisualCenter(flagX, flagY, cellSize);
  const radius = cellSize * FLAG_ORBIT_RADIUS_RATIO;

  useEffect(() => {
    const animate = () => {
      phaseRef.current += ORBIT_SPEED;
      const phase = phaseRef.current;

      const nextParticles: Particle[] = Array.from(
        { length: ORBIT_PARTICLE_COUNT },
        (_, i) => {
          const t = (phase + i / ORBIT_PARTICLE_COUNT) % 1;
          const point = getPointOnCircle(center, radius, t);
          const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 + i * 1.2);
          return {
            x: point.x,
            y: point.y,
            opacity: 0.35 + pulse * 0.55,
            radius: 1.2 + pulse * 0.8,
          };
        }
      );

      setParticles(nextParticles);
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [center.x, center.y, radius]);

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-[35]"
      width={boardSize}
      height={boardSize}
      style={{ overflow: "visible" }}
    >
      <defs>
        <filter id="flag-victory-bloom" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Static ring — same three layers as LaserPath line segments */}
      <circle
        cx={center.x}
        cy={center.y}
        r={radius}
        fill="none"
        stroke="#FF2D2D"
        strokeWidth={8}
        strokeLinecap="round"
        strokeOpacity={0.18}
        filter="url(#flag-victory-bloom)"
      />
      <circle
        cx={center.x}
        cy={center.y}
        r={radius}
        fill="none"
        stroke="#FF2D2D"
        strokeWidth={3.5}
        strokeLinecap="round"
        strokeOpacity={0.85}
      />
      <circle
        cx={center.x}
        cy={center.y}
        r={radius}
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={1}
        strokeLinecap="round"
        strokeOpacity={0.95}
      />

      {particles.map((p, i) => (
        <g key={`victory-particle-${i}`}>
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

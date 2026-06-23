"use client";

import { useId } from "react";

export const LASER_BOX_TRACE_DURATION_MS = 1400;

interface LaserBoxTraceProps {
  width: number;
  height: number;
  className?: string;
  /** 0–1 controlled progress. When set, autonomous SVG animation is disabled. */
  progress?: number;
  /** When true, repeats forever (autonomous mode only). */
  loop?: boolean;
  durationMs?: number;
}

export default function LaserBoxTrace({
  width,
  height,
  className = "",
  progress,
  loop = false,
  durationMs = LASER_BOX_TRACE_DURATION_MS,
}: LaserBoxTraceProps) {
  const uid = useId().replace(/:/g, "");
  const inset = 1.5;
  const w = width - inset * 2;
  const h = height - inset * 2;
  const perimeter = 2 * (w + h);
  const duration = `${durationMs}ms`;
  const isControlled = progress !== undefined;
  const clampedProgress = isControlled ? Math.min(1, Math.max(0, progress)) : 0;
  const dashOffset = isControlled ? perimeter * (1 - clampedProgress) : perimeter;

  const rectProps = {
    x: inset,
    y: inset,
    width: w,
    height: h,
    fill: "none" as const,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeDasharray: perimeter,
    filter: `url(#cursor-laser-glow-${uid})`,
  };

  return (
    <svg
      width={width}
      height={height}
      className={`pointer-events-none overflow-visible ${className}`}
      aria-hidden
    >
      <defs>
        <filter
          id={`cursor-laser-glow-${uid}`}
          x="-80%"
          y="-80%"
          width="260%"
          height="260%"
        >
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect
        {...rectProps}
        stroke="#FF2D2D"
        strokeWidth={6}
        strokeOpacity={0.25}
        strokeDashoffset={isControlled ? dashOffset : perimeter}
      >
        {!isControlled && (
          <animate
            attributeName="stroke-dashoffset"
            from={perimeter}
            to={0}
            dur={duration}
            repeatCount={loop ? "indefinite" : 1}
            fill="freeze"
          />
        )}
      </rect>

      <rect
        {...rectProps}
        stroke="rgba(255, 45, 45, 0.9)"
        strokeWidth={2.5}
        strokeDashoffset={isControlled ? dashOffset : perimeter}
      >
        {!isControlled && (
          <animate
            attributeName="stroke-dashoffset"
            from={perimeter}
            to={0}
            dur={duration}
            repeatCount={loop ? "indefinite" : 1}
            fill="freeze"
          />
        )}
      </rect>
    </svg>
  );
}

"use client";

import { motion } from "framer-motion";
import { useCallback, useRef, useState } from "react";
import { play } from "@/lib/audio/engine";
import LaserBoxTrace from "./LaserBoxTrace";

/** Frontend-owned minimum time for one full perimeter lap (ms). */
const MIN_FULL_LAP_MS = 400;
/** Frontend-only: ~30% slower laser trace around the button. */
const LAP_VISUAL_SLOWDOWN = 1.3;
const LAP_DURATION_MS = MIN_FULL_LAP_MS * LAP_VISUAL_SLOWDOWN;
const PROGRESS_SMOOTHING = 5;

const buttonClass =
  "relative z-10 w-[min(85vw,14rem)] whitespace-nowrap border border-white/20 bg-black px-9 py-[0.9rem] text-center text-[clamp(0.8rem,3.4vw,0.95rem)] tracking-[0.28em] text-white transition-colors hover:border-[#FF2D2D] hover:bg-[#FF2D2D]/25 hover:text-white -mr-[0.28em]";

function easeOutCubic(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return 1 - (1 - clamped) ** 3;
}

function smoothProgress(
  current: number,
  target: number,
  dtMs: number
): number {
  const speed = target > 0.85 ? 10 : PROGRESS_SMOOTHING;
  const alpha = 1 - Math.exp(-speed * (dtMs / 1000));
  const next = current + (target - current) * alpha;
  return Math.min(1, Math.max(current, next));
}

interface LaserTraceButtonProps {
  label: string;
  /** Runs after the laser finishes one lap around the button. */
  onActivate: () => void | Promise<void>;
  className?: string;
}

/**
 * Home-menu button with the same perimeter laser lap as Play, then the action.
 * Fixed-duration lap (no bundle preload wait).
 */
export default function LaserTraceButton({
  label,
  onActivate,
  className = buttonClass,
}: LaserTraceButtonProps) {
  const [isTracing, setIsTracing] = useState(false);
  const [traceProgress, setTraceProgress] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [boxSize, setBoxSize] = useState({ width: 224, height: 52 });
  const displayProgressRef = useRef(0);
  const lastFrameTimeRef = useRef(0);
  const rafRef = useRef<number>(0);
  const busyRef = useRef(false);

  const handleClick = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;

    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      setBoxSize({ width: rect.width, height: rect.height });
    }

    const startTime = performance.now();
    displayProgressRef.current = 0;
    lastFrameTimeRef.current = 0;
    setTraceProgress(0);
    setIsTracing(true);
    play("navCharge");

    await new Promise<void>((resolve) => {
      const animate = (now: number) => {
        const elapsed = now - startTime;
        const dt =
          lastFrameTimeRef.current > 0 ? now - lastFrameTimeRef.current : 16;
        lastFrameTimeRef.current = now;

        const target = easeOutCubic(Math.min(1, elapsed / LAP_DURATION_MS));
        const smoothed = smoothProgress(
          displayProgressRef.current,
          target,
          dt
        );
        displayProgressRef.current = smoothed;
        setTraceProgress(smoothed);

        if (elapsed >= LAP_DURATION_MS && smoothed >= 0.995) {
          displayProgressRef.current = 1;
          setTraceProgress(1);
          resolve();
          return;
        }

        rafRef.current = requestAnimationFrame(animate);
      };

      rafRef.current = requestAnimationFrame(animate);
    });

    cancelAnimationFrame(rafRef.current);
    play("navFire");

    try {
      await onActivate();
    } finally {
      setIsTracing(false);
      setTraceProgress(0);
      busyRef.current = false;
    }
  }, [onActivate]);

  return (
    <div className="relative inline-block">
      <motion.button
        ref={buttonRef}
        type="button"
        // Glow on hover, but no scale. The laser bloom is diegetic; a 2%
        // nudge applied to every button in the app was not.
        whileHover={
          isTracing ? undefined : { boxShadow: "0 0 30px rgba(255,45,45,0.4)" }
        }
        onClick={() => void handleClick()}
        disabled={isTracing}
        className={`${className} ${isTracing ? "border-transparent text-white/80" : ""}`}
      >
        {label}
      </motion.button>

      {isTracing && (
        <div className="pointer-events-none absolute inset-0 z-30">
          <LaserBoxTrace
            width={boxSize.width}
            height={boxSize.height}
            progress={traceProgress}
          />
        </div>
      )}
    </div>
  );
}

export { buttonClass as homeLaserButtonClass };

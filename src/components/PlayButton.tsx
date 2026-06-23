"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import LaserBoxTrace from "./LaserBoxTrace";

/** Frontend-owned minimum time for one full perimeter lap (ms). */
const MIN_FULL_LAP_MS = 400;
/** Frontend-only: ~30% slower laser trace around the button. */
const LAP_VISUAL_SLOWDOWN = 1.3;
const LOADING_CREEP_DURATION_MS = 2400;
const LOADING_PHASE_CAP = 0.75;
const PROGRESS_SMOOTHING = 5;

const buttonClass =
  "relative z-10 w-48 border border-white/20 bg-black px-8 py-4 text-center text-sm tracking-[0.3em] text-white transition-colors hover:border-[#FF2D2D] hover:bg-[#FF2D2D]/25 hover:text-white -mr-[0.3em]";

function preloadGameScreen() {
  return import("@/components/GameScreen");
}

function easeOutCubic(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return 1 - (1 - clamped) ** 3;
}

/** Total frontend lap duration — independent of how fast the backend resolves. */
function getLapDuration(loadCompleteTime: number): number {
  return Math.max(MIN_FULL_LAP_MS, loadCompleteTime) * LAP_VISUAL_SLOWDOWN;
}

function getLoadingTarget(elapsed: number): number {
  const duration = LOADING_CREEP_DURATION_MS * LAP_VISUAL_SLOWDOWN;
  return Math.min(LOADING_PHASE_CAP, easeOutCubic(elapsed / duration));
}

function getLoadedTarget(
  elapsed: number,
  loadCompleteTime: number,
  progressAtLoad: number
): number {
  const lapDuration = getLapDuration(loadCompleteTime);
  if (elapsed >= lapDuration) return 1;

  const remaining = lapDuration - loadCompleteTime;
  if (remaining <= 0) return 1;

  const t = Math.min(1, (elapsed - loadCompleteTime) / remaining);
  return progressAtLoad + (1 - progressAtLoad) * easeOutCubic(t);
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

function waitForLaserLap(
  startTime: number,
  getLoadCompleteTime: () => number | null
) {
  return new Promise<void>((resolve) => {
    const tick = () => {
      const loadCompleteTime = getLoadCompleteTime();
      if (loadCompleteTime === null) {
        requestAnimationFrame(tick);
        return;
      }

      const duration = getLapDuration(loadCompleteTime);
      const elapsed = performance.now() - startTime;

      if (elapsed >= duration) {
        resolve();
        return;
      }

      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  });
}

export default function PlayButton() {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);
  const [traceProgress, setTraceProgress] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [boxSize, setBoxSize] = useState({ width: 192, height: 52 });
  const loadCompleteTimeRef = useRef<number | null>(null);
  const progressAtLoadRef = useRef(0);
  const displayProgressRef = useRef(0);
  const lastFrameTimeRef = useRef(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    router.prefetch("/play");
    preloadGameScreen();
  }, [router]);

  const handlePrefetch = useCallback(() => {
    router.prefetch("/play");
    preloadGameScreen();
  }, [router]);

  const handlePlay = useCallback(async () => {
    if (isNavigating) return;

    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      setBoxSize({ width: rect.width, height: rect.height });
    }

    const startTime = performance.now();
    loadCompleteTimeRef.current = null;
    progressAtLoadRef.current = 0;
    displayProgressRef.current = 0;
    lastFrameTimeRef.current = 0;
    setTraceProgress(0);
    setIsNavigating(true);

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const dt = lastFrameTimeRef.current > 0 ? now - lastFrameTimeRef.current : 16;
      lastFrameTimeRef.current = now;

      const target =
        loadCompleteTimeRef.current === null
          ? getLoadingTarget(elapsed)
          : getLoadedTarget(
              elapsed,
              loadCompleteTimeRef.current,
              progressAtLoadRef.current
            );

      const smoothed = smoothProgress(
        displayProgressRef.current,
        target,
        dt
      );
      displayProgressRef.current = smoothed;
      setTraceProgress(smoothed);

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    const loadPromise = preloadGameScreen();

    try {
      await loadPromise;
      loadCompleteTimeRef.current = performance.now() - startTime;
      progressAtLoadRef.current = displayProgressRef.current;

      // Backend may be ready early; frontend keeps tracing until the lap finishes.
      await waitForLaserLap(startTime, () => loadCompleteTimeRef.current);

      displayProgressRef.current = 1;
      setTraceProgress(1);
      router.push("/play");
    } finally {
      cancelAnimationFrame(rafRef.current);
    }
  }, [isNavigating, router]);

  return (
    <div className="relative inline-block">
      <motion.button
        ref={buttonRef}
        whileHover={
          isNavigating
            ? undefined
            : { scale: 1.02, boxShadow: "0 0 30px rgba(255,45,45,0.4)" }
        }
        whileTap={isNavigating ? undefined : { scale: 0.98 }}
        onMouseEnter={handlePrefetch}
        onFocus={handlePrefetch}
        onClick={handlePlay}
        disabled={isNavigating}
        className={`${buttonClass} ${isNavigating ? "border-transparent text-white/80" : ""}`}
      >
        {isNavigating ? "LOADING" : "PLAY"}
      </motion.button>

      {isNavigating && (
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

"use client";

import { useCallback, useEffect, useRef } from "react";
import { setCursorActive, setCursorSpeed } from "@/lib/audio/engine";

interface TrailPoint {
  x: number;
  y: number;
  time: number;
}

interface CursorLaserTrailProps {
  suppressTrail?: boolean;
}

const TRAIL_LIFETIME_MS = 1500;
const MIN_DISTANCE = 4;
/** Pointer speed (px/ms) that drives the laser tone to full. */
const FULL_SPEED_PX_PER_MS = 3;

export default function CursorLaserTrail({
  suppressTrail = false,
}: CursorLaserTrailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const pointsRef = useRef<TrailPoint[]>([]);
  const cursorRef = useRef({ x: 0, y: 0 });
  const hasPointerRef = useRef(false);
  const suppressRef = useRef(suppressTrail);
  const rafRef = useRef<number>(0);
  // Distance travelled since the last frame. Sampling speed per frame rather
  // than per event means it decays to silence on its own when the pointer
  // stops, without needing a stop event that touch never sends reliably.
  const moveAccumRef = useRef(0);
  const lastSampleRef = useRef<{ x: number; y: number } | null>(null);
  const lastFrameRef = useRef(0);

  suppressRef.current = suppressTrail;

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }, []);

  const updateDot = useCallback((x: number, y: number) => {
    const dot = dotRef.current;
    if (!dot) return;
    dot.style.left = `${x}px`;
    dot.style.top = `${y}px`;
  }, []);

  const draw = useCallback(
    (frameTime: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const now = Date.now();
      const suppress = suppressRef.current;

      const dt = Math.max(1, frameTime - (lastFrameRef.current || frameTime));
      lastFrameRef.current = frameTime;
      const pxPerMs = moveAccumRef.current / dt;
      moveAccumRef.current = 0;
      setCursorSpeed(
        suppress ? 0 : Math.min(1, pxPerMs / FULL_SPEED_PX_PER_MS)
      );

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (suppress) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      pointsRef.current = pointsRef.current.filter(
        (p) => now - p.time < TRAIL_LIFETIME_MS
      );

      const points = pointsRef.current;

      if (points.length >= 2) {
        for (let i = 1; i < points.length; i++) {
          const prev = points[i - 1];
          const curr = points[i];
          const age = now - curr.time;
          const alpha = Math.max(0, 1 - age / TRAIL_LIFETIME_MS);

          ctx.beginPath();
          ctx.moveTo(prev.x, prev.y);
          ctx.lineTo(curr.x, curr.y);
          ctx.strokeStyle = `rgba(255, 45, 45, ${alpha * 0.9})`;
          ctx.lineWidth = 2 + alpha * 2;
          ctx.shadowColor = "#FF2D2D";
          ctx.shadowBlur = 8 + alpha * 12;
          ctx.stroke();
        }
      }

      // Only once a pointer has actually been seen, otherwise the head of the
      // trail renders in the top-left corner where cursorRef starts.
      if (hasPointerRef.current) {
        const { x, y } = cursorRef.current;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 45, 45, 0.9)";
        ctx.shadowColor = "#FF2D2D";
        ctx.shadowBlur = 16;
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(draw);
    },
    []
  );

  useEffect(() => {
    if (suppressTrail) {
      pointsRef.current = [];
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, [suppressTrail]);

  useEffect(() => {
    resize();
    window.addEventListener("resize", resize);
    setCursorActive(true);

    // Shared by mouse and touch so the two input paths can never drift.
    const handlePoint = (x: number, y: number) => {
      cursorRef.current = { x, y };
      hasPointerRef.current = true;
      updateDot(x, y);

      const lastSample = lastSampleRef.current;
      if (lastSample) {
        moveAccumRef.current += Math.hypot(x - lastSample.x, y - lastSample.y);
      }
      lastSampleRef.current = { x, y };

      if (suppressRef.current) return;

      const points = pointsRef.current;
      const last = points[points.length - 1];
      if (last && Math.hypot(x - last.x, y - last.y) < MIN_DISTANCE) {
        return;
      }
      points.push({ x, y, time: Date.now() });
    };

    const handleMove = (e: MouseEvent) => {
      handlePoint(e.clientX, e.clientY);
    };

    const handleTouch = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      handlePoint(touch.clientX, touch.clientY);
    };

    // A lifted finger leaves no pointer on screen, so drop the head dot and
    // break the speed sample rather than measuring across the gap to the next
    // touch somewhere else entirely.
    const handleTouchEnd = () => {
      hasPointerRef.current = false;
      lastSampleRef.current = null;
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("touchstart", handleTouch, { passive: true });
    window.addEventListener("touchmove", handleTouch, { passive: true });
    window.addEventListener("touchend", handleTouchEnd);
    window.addEventListener("touchcancel", handleTouchEnd);
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("touchstart", handleTouch);
      window.removeEventListener("touchmove", handleTouch);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchEnd);
      cancelAnimationFrame(rafRef.current);
      // Never let the home page tone bleed into /play.
      setCursorActive(false);
    };
  }, [resize, draw, updateDot]);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="pointer-events-none fixed inset-0 z-0"
        aria-hidden
      />
      <div
        ref={dotRef}
        className="pointer-events-none fixed z-30 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          display: suppressTrail ? "block" : "none",
          width: 8,
          height: 8,
          background: "#FF2D2D",
          boxShadow: "0 0 10px #FF2D2D, 0 0 20px rgba(255,45,45,0.5)",
        }}
        aria-hidden
      />
    </>
  );
}

"use client";

import { useCallback, useEffect, useRef } from "react";

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

export default function CursorLaserTrail({
  suppressTrail = false,
}: CursorLaserTrailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const pointsRef = useRef<TrailPoint[]>([]);
  const cursorRef = useRef({ x: 0, y: 0 });
  const suppressRef = useRef(suppressTrail);
  const rafRef = useRef<number>(0);

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

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const now = Date.now();
    const suppress = suppressRef.current;

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

    const { x, y } = cursorRef.current;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 45, 45, 0.9)";
    ctx.shadowColor = "#FF2D2D";
    ctx.shadowBlur = 16;
    ctx.fill();

    rafRef.current = requestAnimationFrame(draw);
  }, []);

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

    const handleMove = (e: MouseEvent) => {
      cursorRef.current = { x: e.clientX, y: e.clientY };
      updateDot(e.clientX, e.clientY);

      if (suppressRef.current) return;

      const points = pointsRef.current;
      const last = points[points.length - 1];
      if (
        last &&
        Math.hypot(e.clientX - last.x, e.clientY - last.y) < MIN_DISTANCE
      ) {
        return;
      }
      points.push({ x: e.clientX, y: e.clientY, time: Date.now() });
    };

    window.addEventListener("mousemove", handleMove);
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMove);
      cancelAnimationFrame(rafRef.current);
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

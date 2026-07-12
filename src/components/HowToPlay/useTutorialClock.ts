"use client";

import { useEffect, useRef, useState } from "react";
import { TUTORIAL_LOOP_MS } from "@/data/tutorialScenarios";

/**
 * Shared demo clock: loop-relative elapsed ms plus the loop count. Every
 * demo mounts in the same commit when the modal opens, so their clocks start
 * on the same frame and identical loop lengths keep them in sync forever.
 */
export function useTutorialClock(): { elapsed: number; loopCount: number } {
  const [clock, setClock] = useState({ elapsed: 0, loopCount: 0 });
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);

  useEffect(() => {
    const tick = (now: number) => {
      if (startRef.current === 0) startRef.current = now;
      const sinceStart = now - startRef.current;
      setClock({
        elapsed: sinceStart % TUTORIAL_LOOP_MS,
        loopCount: Math.floor(sinceStart / TUTORIAL_LOOP_MS),
      });
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return clock;
}

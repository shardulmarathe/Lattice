"use client";

import { useEffect, useRef, useState } from "react";
import { formatTime } from "@/lib/validation";

interface UseTimerOptions {
  isPaused: boolean;
  isComplete: boolean;
  initialSeconds?: number;
  enabled?: boolean;
}

/**
 * Whether the tab is currently on screen. Backgrounding it isn't playing, and
 * browsers throttle a hidden tab's intervals to roughly once a minute anyway -
 * so the clock would drift regardless. Stopping is both fairer and accurate.
 */
function useIsDocumentVisible(): boolean {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const sync = () => setIsVisible(document.visibilityState === "visible");
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  return isVisible;
}

export function useTimer({
  isPaused,
  isComplete,
  initialSeconds = 0,
  enabled = true,
}: UseTimerOptions) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initializedRef = useRef(false);
  // Silent, unlike the PAUSE button, no overlay, and it resumes on its own when
  // the player comes back. This is clock accuracy, not a gate on play.
  const isVisible = useIsDocumentVisible();

  useEffect(() => {
    if (!enabled || initializedRef.current) return;
    setSeconds(initialSeconds);
    initializedRef.current = true;
  }, [enabled, initialSeconds]);

  useEffect(() => {
    if (!enabled || isPaused || isComplete || !isVisible) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, isPaused, isComplete, isVisible]);

  return { seconds, formatted: formatTime(seconds), setSeconds };
}

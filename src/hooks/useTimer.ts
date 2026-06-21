"use client";

import { useEffect, useRef, useState } from "react";
import { formatTime } from "@/lib/validation";

interface UseTimerOptions {
  isPaused: boolean;
  isComplete: boolean;
  initialSeconds?: number;
  enabled?: boolean;
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

  useEffect(() => {
    if (!enabled || initializedRef.current) return;
    setSeconds(initialSeconds);
    initializedRef.current = true;
  }, [enabled, initialSeconds]);

  useEffect(() => {
    if (!enabled || isPaused || isComplete) {
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
  }, [enabled, isPaused, isComplete]);

  return { seconds, formatted: formatTime(seconds), setSeconds };
}

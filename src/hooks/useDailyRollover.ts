"use client";

import { useEffect, useRef } from "react";
import { formatDateKey } from "@/data/schedule";

interface UseDailyRolloverOptions {
  /** Off for archived puzzles (`?puzzle=N`) — those are a deliberate choice. */
  enabled?: boolean;
  /**
   * Also fire the moment local midnight passes with the tab already visible.
   * Safe on passive screens; off during a solve so play is never interrupted.
   */
  atMidnight?: boolean;
  /** Where to send the player once the day has changed. */
  destination?: string;
}

/** Local midnight is when the schedule flips (see schedule.formatDateKey). */
function msUntilNextMidnight(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime() - now.getTime();
}

/**
 * Wordle-style day rollover for a tab left open overnight.
 *
 * Every day-derived value (the resolved puzzle, `isDaily`, route prefetches) is
 * captured once at mount, so without this the tab serves yesterday's puzzle
 * forever. Navigates with `location` rather than the router on purpose: the
 * schedule and puzzles are baked into the bundle at build time, so a
 * client-side route change would just re-render off the same stale JS.
 */
export function useDailyRollover({
  enabled = true,
  atMidnight = false,
  destination = "/play",
}: UseDailyRolloverOptions = {}) {
  const dayKeyRef = useRef<string | null>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    if (dayKeyRef.current === null) {
      dayKeyRef.current = formatDateKey(new Date());
    }

    let midnightTimer: ReturnType<typeof setTimeout> | null = null;

    const check = () => {
      if (firedRef.current) return;
      // A hidden tab has nothing to show — the visibility handler catches up
      // when the player comes back.
      if (document.visibilityState !== "visible") return;
      if (formatDateKey(new Date()) === dayKeyRef.current) return;

      firedRef.current = true;
      const target = new URL(destination, window.location.href);
      if (target.href === window.location.href) {
        window.location.reload();
      } else {
        window.location.assign(target.href);
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") check();
    };

    // pageshow covers bfcache restores (back button), which don't reliably
    // refire visibilitychange.
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", check);
    window.addEventListener("pageshow", check);

    // Background tabs throttle timers hard, so this is a best-effort nudge for
    // a visible tab — the listeners above are what make the feature reliable.
    const armMidnightTimer = () => {
      if (!atMidnight || firedRef.current) return;
      midnightTimer = setTimeout(() => {
        check();
        armMidnightTimer();
      }, msUntilNextMidnight() + 1000);
    };

    armMidnightTimer();
    check();

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", check);
      window.removeEventListener("pageshow", check);
      if (midnightTimer) clearTimeout(midnightTimer);
    };
  }, [enabled, atMidnight, destination]);
}

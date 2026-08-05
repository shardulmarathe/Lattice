"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  isArmed,
  setEnabled,
  subscribeArmed,
  unlock,
} from "@/lib/audio/engine";
import { isSoundEnabled, setSoundEnabled } from "@/lib/soundStorage";

/**
 * Only the toggle's own state lives in React; everything that makes noise
 * imports the engine singleton directly, which keeps sound out of component
 * dependency arrays.
 */
interface SoundContextValue {
  /** The stored preference. */
  enabled: boolean;
  /** Enabled *and* armed by a gesture, i.e. actually audible right now. */
  audible: boolean;
  toggle: () => void;
}

const SoundContext = createContext<SoundContextValue>({
  enabled: true,
  audible: false,
  toggle: () => {},
});

export function useSound(): SoundContextValue {
  return useContext(SoundContext);
}

export default function SoundProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Starts optimistic and is corrected on mount. Reading localStorage during
  // render would desync the server-rendered home page.
  const [enabled, setEnabledState] = useState(true);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    const stored = isSoundEnabled();
    setEnabledState(stored);
    setEnabled(stored);
  }, []);

  useEffect(() => {
    setArmed(isArmed());
    return subscribeArmed(setArmed);
  }, []);

  // Browsers will not start an AudioContext without a gesture, and mousemove
  // does not qualify. Any real gesture anywhere arms audio for the session;
  // unlock() is idempotent, so these stay attached rather than racing a
  // resume() that might not have landed yet.
  useEffect(() => {
    const arm = (event: Event) => {
      // The toggle owns its own gesture. If this listener armed audio first,
      // the toggle's click would arrive with armed already true and be read as
      // "mute", so tapping "enable sound" would silence the app.
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest("[data-sound-toggle]") !== null
      ) {
        return;
      }
      unlock();
    };

    window.addEventListener("pointerdown", arm);
    window.addEventListener("keydown", arm);
    window.addEventListener("touchstart", arm, { passive: true });

    return () => {
      window.removeEventListener("pointerdown", arm);
      window.removeEventListener("keydown", arm);
      window.removeEventListener("touchstart", arm);
    };
  }, []);

  const toggle = useCallback(() => {
    // First tap on an enabled-but-locked toggle arms audio and leaves the
    // preference alone. Without this the affordance reads "tap to enable" and
    // then mutes, because the gesture listener above arms it on the same click.
    if (enabled && !armed) {
      unlock();
      return;
    }

    const next = !enabled;
    setEnabledState(next);
    setEnabled(next);
    setSoundEnabled(next);
    if (next) unlock();
  }, [enabled, armed]);

  return (
    <SoundContext.Provider value={{ enabled, audible: enabled && armed, toggle }}>
      {children}
    </SoundContext.Provider>
  );
}

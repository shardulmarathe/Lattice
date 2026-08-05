"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useDailyRollover } from "@/hooks/useDailyRollover";
import { play } from "@/lib/audio/engine";
import CursorLaserTrail from "./CursorLaserTrail";
import HowToPlayModal from "./HowToPlayModal";
import PastGamesModal from "./Archive/PastGamesModal";
import PlayButton from "./PlayButton";
import SoundToggle from "./Sound/SoundToggle";

const buttonClass =
  "relative z-20 w-[min(85vw,14rem)] whitespace-nowrap border border-white/20 bg-black px-9 py-[0.9rem] text-center text-[clamp(0.8rem,3.4vw,0.95rem)] tracking-[0.28em] text-white transition-colors hover:border-[#FF2D2D] hover:bg-[#FF2D2D]/25 hover:text-white -mr-[0.28em]";

export default function HomeScreen() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isOverButtons, setIsOverButtons] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [showPastGames, setShowPastGames] = useState(false);

  // Reload in place at rollover so the bundle and the prefetches below aren't
  // still pointing at yesterday's daily. Home is the menu, so stay on it.
  useDailyRollover({ atMidnight: true, destination: "/" });

  useEffect(() => {
    setMounted(true);
    router.prefetch("/play");
    router.prefetch("/complete");
    import("@/components/GameScreen");
    import("@/components/CompleteScreen");
  }, [router]);

  return (
    <main className="relative flex min-h-[100dvh] w-full items-center justify-center bg-black px-[max(1.5rem,env(safe-area-inset-left))] py-[max(2.5rem,env(safe-area-inset-bottom))]">
      <CursorLaserTrail suppressTrail={isOverButtons} />

      {/* Doubles as the audio unlock affordance: browsers refuse to start an
          AudioContext without a gesture, and moving the cursor is not one. */}
      <SoundToggle className="absolute right-[max(1rem,env(safe-area-inset-right))] top-[max(1rem,env(safe-area-inset-top))] z-30 p-2 text-white/45 transition-colors hover:text-[#FF2D2D]" />

      <motion.div
        initial={false}
        animate={mounted ? { opacity: 1, y: 0 } : false}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 flex flex-col items-center gap-[clamp(2rem,6vh,3.5rem)]"
      >
        <motion.h1
          className="max-w-full text-[clamp(2rem,min(9vw,13vh),6.5rem)] font-light tracking-[0.16em] text-white -mr-[0.16em] sm:tracking-[0.3em] sm:-mr-[0.3em] md:tracking-[0.4em] md:-mr-[0.4em]"
          initial={false}
          animate={mounted ? { opacity: 1 } : false}
          transition={{ duration: 1.2, ease: "easeOut" }}
        >
          LATTICE
        </motion.h1>

        <div
          className="relative isolate z-20 flex cursor-none flex-col items-center gap-[clamp(0.75rem,1.6vh,1rem)]"
          onMouseEnter={() => setIsOverButtons(true)}
          onMouseLeave={() => setIsOverButtons(false)}
        >
          <PlayButton />

          <motion.button
            type="button"
            whileHover={{ scale: 1.02, boxShadow: "0 0 30px rgba(255,45,45,0.4)" }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              play("uiTick");
              setShowPastGames(true);
            }}
            className={buttonClass}
          >
            PAST GAMES
          </motion.button>

          <motion.button
            type="button"
            whileHover={{ scale: 1.02, boxShadow: "0 0 30px rgba(255,45,45,0.4)" }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              play("uiTick");
              setShowHowToPlay(true);
            }}
            className={buttonClass}
          >
            RULES
          </motion.button>

          <motion.a
            href="https://forms.gle/SwrFyj3ww3GoJc4u7"
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.02, boxShadow: "0 0 30px rgba(255,45,45,0.4)" }}
            whileTap={{ scale: 0.98 }}
            className={buttonClass}
          >
            FEEDBACK
          </motion.a>
        </div>
      </motion.div>

      <HowToPlayModal
        isOpen={showHowToPlay}
        onClose={() => setShowHowToPlay(false)}
      />

      <PastGamesModal
        isOpen={showPastGames}
        onClose={() => setShowPastGames(false)}
      />
    </main>
  );
}

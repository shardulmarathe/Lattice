"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useDailyRollover } from "@/hooks/useDailyRollover";
import { markTutorialSeen } from "@/lib/tutorialStorage";
import CursorLaserTrail from "./CursorLaserTrail";
import HowToPlayModal from "./HowToPlayModal";
import PastGamesModal from "./Archive/PastGamesModal";
import LaserTraceButton, { homeLaserButtonClass } from "./LaserTraceButton";
import PlayButton from "./PlayButton";
import SoundToggle from "./Sound/SoundToggle";

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
    router.prefetch("/tutorial");
    import("@/components/GameScreen");
    import("@/components/CompleteScreen");
    import("@/components/TutorialScreen");
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
          // No negative right margin to "cancel" the trailing letter-space.
          // Chrome already trims it from the element's intrinsic width, so the
          // margin subtracted width that was never there and pushed the
          // wordmark right by a full tracking unit: measured +11.8px, +22.1px
          // and +29.5px at the three tracking steps. Removing it centres the
          // glyphs exactly (0.0px) at all three.
          className="max-w-full text-[clamp(2rem,min(9vw,13vh),6.5rem)] font-light tracking-[0.16em] text-white sm:tracking-[0.3em] md:tracking-[0.4em]"
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

          <LaserTraceButton
            label="TUTORIAL"
            className={homeLaserButtonClass}
            onActivate={() => {
              router.push("/tutorial");
            }}
          />

          <LaserTraceButton
            label="PAST GAMES"
            className={homeLaserButtonClass}
            onActivate={() => {
              setShowPastGames(true);
            }}
          />

          <LaserTraceButton
            label="RULES"
            className={homeLaserButtonClass}
            onActivate={() => {
              setShowHowToPlay(true);
            }}
          />
        </div>
      </motion.div>

      <HowToPlayModal
        isOpen={showHowToPlay}
        onClose={() => setShowHowToPlay(false)}
        // "LET'S PLAY!" now actually plays. Marking the tutorial seen matters
        // as much as the push: GameScreen's shouldShowTutorialOnLoad fires
        // whenever hasSeenTutorial() is false, so without it a first-time
        // player would read the rules here and be handed the same modal again
        // the moment they landed on the board. Dismissing instead of
        // confirming leaves the flag alone, so the forced first-run read still
        // happens for anyone who skipped it.
        onConfirm={() => {
          markTutorialSeen();
          router.push("/play");
        }}
      />

      <PastGamesModal
        isOpen={showPastGames}
        onClose={() => setShowPastGames(false)}
      />
    </main>
  );
}

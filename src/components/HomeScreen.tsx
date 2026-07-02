"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import CursorLaserTrail from "./CursorLaserTrail";
import HowToPlayModal from "./HowToPlayModal";
import PastGamesModal from "./Archive/PastGamesModal";
import PlayButton from "./PlayButton";

const buttonClass =
  "relative z-20 w-[min(85vw,14rem)] whitespace-nowrap border border-white/20 bg-black px-9 py-[0.9rem] text-center text-[clamp(0.8rem,3.4vw,0.95rem)] tracking-[0.28em] text-white transition-colors hover:border-[#FF2D2D] hover:bg-[#FF2D2D]/25 hover:text-white -mr-[0.28em]";

export default function HomeScreen() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isOverButtons, setIsOverButtons] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [showPastGames, setShowPastGames] = useState(false);

  useEffect(() => {
    setMounted(true);
    router.prefetch("/play");
    router.prefetch("/complete");
    import("@/components/GameScreen");
    import("@/components/CompleteScreen");
  }, [router]);

  return (
    <main className="relative flex min-h-[100dvh] w-full items-center justify-center bg-black px-6 py-10">
      <CursorLaserTrail suppressTrail={isOverButtons} />

      <motion.div
        initial={false}
        animate={mounted ? { opacity: 1, y: 0 } : false}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 flex flex-col items-center gap-[clamp(2rem,6vh,3.5rem)]"
      >
        <motion.h1
          className="text-[clamp(2.5rem,min(11vw,13vh),6.5rem)] font-light tracking-[0.3em] text-white -mr-[0.3em] md:tracking-[0.4em] md:-mr-[0.4em]"
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
            onClick={() => setShowPastGames(true)}
            className={buttonClass}
          >
            PAST GAMES
          </motion.button>

          <motion.button
            type="button"
            whileHover={{ scale: 1.02, boxShadow: "0 0 30px rgba(255,45,45,0.4)" }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowHowToPlay(true)}
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

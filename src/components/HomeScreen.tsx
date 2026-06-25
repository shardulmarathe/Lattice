"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import CursorLaserTrail from "./CursorLaserTrail";
import PlayButton from "./PlayButton";

const buttonClass =
  "relative z-20 w-48 border border-white/20 bg-black px-8 py-4 text-center text-sm tracking-[0.3em] text-white transition-colors hover:border-[#FF2D2D] hover:bg-[#FF2D2D]/25 hover:text-white -mr-[0.3em]";

export default function HomeScreen() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isOverButtons, setIsOverButtons] = useState(false);

  useEffect(() => {
    setMounted(true);
    router.prefetch("/play");
    router.prefetch("/complete");
    import("@/components/GameScreen");
    import("@/components/CompleteScreen");
  }, [router]);

  return (
    <main className="relative grid min-h-screen w-full place-items-center bg-black px-6">
      <CursorLaserTrail suppressTrail={isOverButtons} />

      <motion.div
        initial={false}
        animate={mounted ? { opacity: 1, y: 0 } : false}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 flex flex-col items-center gap-12"
      >
        <motion.h1
          className="text-6xl font-light tracking-[0.4em] text-white -mr-[0.4em] md:text-8xl"
          initial={false}
          animate={mounted ? { opacity: 1 } : false}
          transition={{ duration: 1.2, ease: "easeOut" }}
        >
          LATTICE
        </motion.h1>

        <div
          className="relative isolate z-20 flex cursor-none flex-col items-center gap-4"
          onMouseEnter={() => setIsOverButtons(true)}
          onMouseLeave={() => setIsOverButtons(false)}
        >
          <PlayButton />

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
    </main>
  );
}

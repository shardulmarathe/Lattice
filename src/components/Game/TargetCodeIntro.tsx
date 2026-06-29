"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const POST_RULES_DELAY_MS = 700;
const HERO_HOLD_MS = 1200;
const HERO_ENTRANCE_DURATION_S = 0.3;
const FLY_DURATION_S = 1.3;
const HERO_SCALE = 2.75;

type IntroPhase = "waiting" | "hero" | "settling" | "done";

interface FlyTarget {
  x: number;
  y: number;
}

interface TargetCodeIntroProps {
  code: string;
  isComplete: boolean;
  playIntro: boolean;
  introPaused: boolean;
  onIntroComplete: () => void;
}

function TargetCodeLabel({
  code,
  isComplete,
}: {
  code: string;
  isComplete: boolean;
}) {
  return (
    <div className="text-center text-lg tracking-wider text-white md:text-2xl">
      Target Code:{" "}
      <span
        className={`font-mono transition-colors duration-500 ${
          isComplete
            ? "animate-code-solved-glow text-white"
            : "text-[#FF3B1F]"
        }`}
      >
        {code}
      </span>
    </div>
  );
}

function computeFlyTarget(restEl: HTMLElement): FlyTarget {
  const rect = restEl.getBoundingClientRect();
  const centerX = window.innerWidth / 2;
  const centerY = window.innerHeight / 2;
  const restCenterX = rect.left + rect.width / 2;
  const restCenterY = rect.top + rect.height / 2;

  return {
    x: restCenterX - centerX,
    y: restCenterY - centerY,
  };
}

export default function TargetCodeIntro({
  code,
  isComplete,
  playIntro,
  introPaused,
  onIntroComplete,
}: TargetCodeIntroProps) {
  const prefersReducedMotion = useReducedMotion();
  const finishedRef = useRef(false);
  const restRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<IntroPhase>(() =>
    playIntro ? "waiting" : "done"
  );
  const [flyTarget, setFlyTarget] = useState<FlyTarget | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const finishIntro = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onIntroComplete();
  }, [onIntroComplete]);

  useEffect(() => {
    if (!playIntro) {
      setPhase("done");
      finishIntro();
    }
  }, [playIntro, finishIntro]);

  useEffect(() => {
    if (!playIntro || prefersReducedMotion) return;
    if (introPaused || phase === "done") return;

    if (phase === "waiting") {
      const delayTimer = window.setTimeout(
        () => setPhase("hero"),
        POST_RULES_DELAY_MS
      );
      return () => window.clearTimeout(delayTimer);
    }

    if (phase === "hero") {
      const holdTimer = window.setTimeout(() => setPhase("settling"), HERO_HOLD_MS);
      return () => window.clearTimeout(holdTimer);
    }
  }, [playIntro, introPaused, phase, prefersReducedMotion]);

  useEffect(() => {
    if (playIntro && prefersReducedMotion) {
      setPhase("done");
      finishIntro();
    }
  }, [playIntro, prefersReducedMotion, finishIntro]);

  useLayoutEffect(() => {
    if (phase !== "settling" || !restRef.current) return;
    setFlyTarget(computeFlyTarget(restRef.current));
  }, [phase]);

  const showFlyLayer = phase === "hero" || phase === "settling";
  const restingVisible = phase === "done" || !playIntro;

  const flyOverlay =
    mounted && showFlyLayer
      ? createPortal(
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: phase === "hero" ? 1 : 0 }}
              transition={{
                opacity: {
                  duration: phase === "settling" ? FLY_DURATION_S * 0.85 : 0.5,
                  ease: "easeOut",
                },
              }}
              className="pointer-events-none fixed inset-0 z-[89] bg-black/70 backdrop-blur-md"
              aria-hidden
            />

            <div className="pointer-events-none fixed inset-0 z-[90] flex items-center justify-center">
              {phase === "hero" && (
                <motion.div
                  initial={{ opacity: 0, scale: HERO_SCALE * 0.88, filter: "blur(10px)" }}
                  animate={{ opacity: 1, scale: HERO_SCALE, filter: "blur(0px)" }}
                  transition={{ duration: HERO_ENTRANCE_DURATION_S, ease: "easeOut" }}
                >
                  <TargetCodeLabel code={code} isComplete={isComplete} />
                </motion.div>
              )}

              {phase === "settling" && flyTarget && (
                <motion.div
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 will-change-transform"
                  initial={{ x: 0, y: 0, scale: HERO_SCALE }}
                  animate={{
                    x: flyTarget.x,
                    y: flyTarget.y,
                    scale: 1,
                  }}
                  transition={{
                    duration: FLY_DURATION_S,
                    ease: [0.22, 0.03, 0.12, 1],
                  }}
                  onAnimationComplete={() => {
                    setPhase("done");
                    finishIntro();
                  }}
                >
                  <TargetCodeLabel code={code} isComplete={isComplete} />
                </motion.div>
              )}
            </div>
          </>,
          document.body
        )
      : null;

  return (
    <>
      <div
        ref={restRef}
        className={`shrink-0 transition-opacity duration-200 ${
          restingVisible ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden={!restingVisible}
      >
        <TargetCodeLabel code={code} isComplete={isComplete} />
      </div>

      {flyOverlay}
    </>
  );
}

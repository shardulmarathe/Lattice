"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { play } from "@/lib/audio/engine";

const POST_RULES_DELAY_MS = 700;
const HERO_HOLD_MS = 1200;
const HERO_ENTRANCE_DURATION_S = 0.3;
const FLY_DURATION_S = 1.3;
const MAX_EMPHASIS_DESKTOP = 2.75;
const MAX_EMPHASIS_MOBILE = 1.5;
const MIN_EMPHASIS_RATIO = 1.15;
const FIT_SAFETY_MARGIN = 0.9;
const HERO_HEIGHT_RATIO = 0.32;
const MOBILE_WIDTH_BREAKPOINT = 480;
// Max time any single intro phase may stall before we force-complete the intro.
// Comfortably longer than the normal hero-hold + fly durations.
const INTRO_WATCHDOG_MS = 4500;

type IntroPhase = "waiting" | "hero" | "settling" | "done";

interface FlyTarget {
  x: number;
  y: number;
}

interface IntroMetrics {
  restFontSize: number;
  restLineHeightPx: number;
  heroFontSize: number;
  heroLineHeightPx: number;
}

interface TargetCodeIntroProps {
  code: string;
  isComplete: boolean;
  collectedDigitCount?: number;
  playIntro: boolean;
  introPaused: boolean;
  onIntroComplete: () => void;
}

function getViewportSize(): { width: number; height: number } {
  const vv = window.visualViewport;
  return {
    width: vv?.width ?? window.innerWidth,
    height: vv?.height ?? window.innerHeight,
  };
}

function parseLineHeightPx(lineHeight: string, fontSize: number): number {
  const parsed = parseFloat(lineHeight);
  if (!Number.isFinite(parsed)) return fontSize * 1.25;
  if (lineHeight.endsWith("px")) return parsed;
  return parsed * fontSize;
}

function computeHeroFontSize(
  restFontSize: number,
  naturalWidth: number,
  naturalHeight: number,
  viewportWidth: number,
  viewportHeight: number
): number {
  if (naturalWidth <= 0 || naturalHeight <= 0 || restFontSize <= 0) {
    return restFontSize * MIN_EMPHASIS_RATIO;
  }

  const maxRatio =
    viewportWidth < MOBILE_WIDTH_BREAKPOINT
      ? MAX_EMPHASIS_MOBILE
      : MAX_EMPHASIS_DESKTOP;

  const horizontalInset = Math.max(32, viewportWidth * 0.08);
  const availableWidth = (viewportWidth - horizontalInset * 2) * FIT_SAFETY_MARGIN;
  const availableHeight = viewportHeight * HERO_HEIGHT_RATIO * FIT_SAFETY_MARGIN;

  const widthRatio = availableWidth / naturalWidth;
  const heightRatio = availableHeight / naturalHeight;
  const emphasisRatio = Math.min(maxRatio, widthRatio, heightRatio);

  return restFontSize * Math.max(MIN_EMPHASIS_RATIO, emphasisRatio);
}

function TargetCodeDigits({
  code,
  isComplete,
  collectedDigitCount = 0,
}: {
  code: string;
  isComplete: boolean;
  collectedDigitCount?: number;
}) {
  return (
    <span className="target-code-digits font-mono tabular-nums">
      {code.split("").map((digit, index) => {
        const isCollected = isComplete || index < collectedDigitCount;
        return (
          <span
            key={`${index}-${digit}`}
            className={
              isCollected
                ? "target-code-digit-collected"
                : "target-code-digit-pending"
            }
          >
            {digit}
          </span>
        );
      })}
    </span>
  );
}

function TargetCodeLabel({
  code,
  isComplete,
  collectedDigitCount = 0,
  fontSize,
  lineHeight,
}: {
  code: string;
  isComplete: boolean;
  collectedDigitCount?: number;
  fontSize?: number;
  lineHeight?: number;
}) {
  const sizeStyle =
    fontSize !== undefined
      ? { fontSize, lineHeight: lineHeight ?? fontSize * 1.25 }
      : undefined;

  return (
    <div
      className="whitespace-nowrap text-center text-lg tracking-wider text-white md:text-2xl"
      style={sizeStyle}
    >
      Target Code:{" "}
      <TargetCodeDigits
        code={code}
        isComplete={isComplete}
        collectedDigitCount={collectedDigitCount}
      />
    </div>
  );
}

function computeFlyTarget(restEl: HTMLElement): FlyTarget {
  const rect = restEl.getBoundingClientRect();
  const vv = window.visualViewport;
  const centerX =
    (vv?.offsetLeft ?? 0) + (vv?.width ?? window.innerWidth) / 2;
  const centerY =
    (vv?.offsetTop ?? 0) + (vv?.height ?? window.innerHeight) / 2;
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
  collectedDigitCount = 0,
  playIntro,
  introPaused,
  onIntroComplete,
}: TargetCodeIntroProps) {
  const prefersReducedMotion = useReducedMotion();
  const finishedRef = useRef(false);
  const restRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<IntroPhase>(() =>
    playIntro ? "waiting" : "done"
  );
  const [flyTarget, setFlyTarget] = useState<FlyTarget | null>(null);
  const [introMetrics, setIntroMetrics] = useState<IntroMetrics | null>(null);
  const [mounted, setMounted] = useState(false);

  const updateIntroMetrics = useCallback((): boolean => {
    const measureEl = measureRef.current;
    const restLabelEl = restRef.current?.firstElementChild as HTMLElement | null;
    if (!measureEl || !restLabelEl) return false;

    const naturalWidth = measureEl.scrollWidth;
    const naturalHeight = measureEl.scrollHeight;
    const restStyle = getComputedStyle(restLabelEl);
    const restFontSize = parseFloat(restStyle.fontSize);
    const restLineHeightPx = parseLineHeightPx(
      restStyle.lineHeight,
      restFontSize
    );

    if (naturalWidth <= 0 || restFontSize <= 0) return false;

    const { width, height } = getViewportSize();
    const heroFontSize = computeHeroFontSize(
      restFontSize,
      naturalWidth,
      naturalHeight,
      width,
      height
    );
    const lineHeightRatio = restLineHeightPx / restFontSize;

    setIntroMetrics({
      restFontSize,
      restLineHeightPx,
      heroFontSize,
      heroLineHeightPx: heroFontSize * lineHeightRatio,
    });
    return true;
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  const finishIntro = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onIntroComplete();
  }, [onIntroComplete]);

  // One beat only, on the reveal. The flyaway used to fire a second sound and
  // it read as an unexplained noise: nothing the player did caused it, and the
  // animation is already carrying the moment.
  useEffect(() => {
    if (phase === "hero") play("hintChime");
  }, [phase]);

  // Safety net: if a measurement/layout/font race stalls a phase (e.g. the fly
  // metrics never compute, so the settling animation's onAnimationComplete never
  // fires), force the intro to finish so the board can never stay locked/blank.
  useEffect(() => {
    if (!playIntro || prefersReducedMotion || introPaused) return;
    if (phase === "done") return;
    const watchdog = window.setTimeout(finishIntro, INTRO_WATCHDOG_MS);
    return () => window.clearTimeout(watchdog);
  }, [playIntro, prefersReducedMotion, introPaused, phase, finishIntro]);

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

  useLayoutEffect(() => {
    if (phase !== "hero" && phase !== "settling") {
      setIntroMetrics(null);
      return;
    }
    // Measurement can be 0 for a frame or two (fonts/layout not settled); retry
    // on the next frame until it succeeds so the fly animation always plays.
    let raf = 0;
    const tryMeasure = () => {
      if (!updateIntroMetrics()) raf = requestAnimationFrame(tryMeasure);
    };
    tryMeasure();
    return () => cancelAnimationFrame(raf);
  }, [phase, code, updateIntroMetrics]);

  useEffect(() => {
    if (phase !== "hero" && phase !== "settling") return;

    const handleViewportChange = () => updateIntroMetrics();
    window.addEventListener("resize", handleViewportChange);
    window.visualViewport?.addEventListener("resize", handleViewportChange);
    window.visualViewport?.addEventListener("scroll", handleViewportChange);

    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.visualViewport?.removeEventListener("resize", handleViewportChange);
      window.visualViewport?.removeEventListener("scroll", handleViewportChange);
    };
  }, [phase, updateIntroMetrics]);

  const showFlyLayer = phase === "hero" || phase === "settling";
  const restingVisible = phase === "done" || !playIntro;
  const overlayPadding =
    "pt-[max(1rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))]";

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

            <div
              className={`pointer-events-none fixed inset-0 isolate z-[90] overflow-hidden ${overlayPadding}`}
            >
              <div className="flex h-full w-full items-center justify-center">
                {phase === "hero" && introMetrics && (
                  <motion.div
                    initial={{ opacity: 0, filter: "blur(10px)" }}
                    animate={{ opacity: 1, filter: "blur(0px)" }}
                    transition={{
                      duration: HERO_ENTRANCE_DURATION_S,
                      ease: "easeOut",
                    }}
                  >
                    <TargetCodeLabel
                      code={code}
                      isComplete={isComplete}
                      collectedDigitCount={collectedDigitCount}
                      fontSize={introMetrics.heroFontSize}
                      lineHeight={introMetrics.heroLineHeightPx}
                    />
                  </motion.div>
                )}

                {phase === "settling" && flyTarget && introMetrics && (
                  <motion.div
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-center tracking-wider text-white will-change-[transform,font-size,line-height]"
                    initial={{
                      x: 0,
                      y: 0,
                      fontSize: introMetrics.heroFontSize,
                      lineHeight: `${introMetrics.heroLineHeightPx}px`,
                    }}
                    animate={{
                      x: flyTarget.x,
                      y: flyTarget.y,
                      fontSize: introMetrics.restFontSize,
                      lineHeight: `${introMetrics.restLineHeightPx}px`,
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
                    Target Code:{" "}
                    <TargetCodeDigits
                      code={code}
                      isComplete={isComplete}
                      collectedDigitCount={collectedDigitCount}
                    />
                  </motion.div>
                )}
              </div>
            </div>
          </>,
          document.body
        )
      : null;

  return (
    <div className="relative shrink-0">
      <div
        ref={measureRef}
        className="pointer-events-none fixed -left-[9999px] top-0 w-max invisible"
        aria-hidden
      >
        <TargetCodeLabel
          code={code}
          isComplete={isComplete}
          collectedDigitCount={collectedDigitCount}
        />
      </div>

      <div
        ref={restRef}
        className={`transition-opacity duration-200 ${
          restingVisible ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden={!restingVisible}
      >
        <TargetCodeLabel
          code={code}
          isComplete={isComplete}
          collectedDigitCount={collectedDigitCount}
        />
      </div>

      {flyOverlay}
    </div>
  );
}

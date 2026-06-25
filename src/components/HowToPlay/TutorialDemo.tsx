"use client";

import { useEffect, useRef, useState } from "react";
import type { TutorialScenario } from "@/data/tutorialScenarios";
import {
  TUTORIAL_DRAW_MS,
  TUTORIAL_HOLD_MS,
  TUTORIAL_RESET_MS,
} from "@/data/tutorialScenarios";
import TutorialDemoBoard from "./TutorialDemoBoard";

interface TutorialDemoProps {
  scenario: TutorialScenario;
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

export default function TutorialDemo({ scenario }: TutorialDemoProps) {
  const [drawProgress, setDrawProgress] = useState(0);
  const [showEffect, setShowEffect] = useState(false);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);

  useEffect(() => {
    const loopDuration = TUTORIAL_DRAW_MS + TUTORIAL_HOLD_MS + TUTORIAL_RESET_MS;

    const tick = (now: number) => {
      if (startRef.current === 0) startRef.current = now;
      const elapsed = (now - startRef.current) % loopDuration;

      if (elapsed < TUTORIAL_DRAW_MS) {
        const t = easeOutCubic(elapsed / TUTORIAL_DRAW_MS);
        setDrawProgress(t);
        setShowEffect(t >= scenario.effectThreshold);
      } else if (elapsed < TUTORIAL_DRAW_MS + TUTORIAL_HOLD_MS) {
        setDrawProgress(1);
        setShowEffect(scenario.effectThreshold <= 1);
      } else {
        setDrawProgress(0);
        setShowEffect(false);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [scenario.effectThreshold]);

  const collectedNumbers = new Set<number>();

  if (scenario.id === "correct-number" && showEffect) {
    collectedNumbers.add(3);
  }

  const showVictoryLaser =
    scenario.showVictoryLaser && showEffect && drawProgress >= scenario.effectThreshold;

  return (
    <TutorialDemoBoard
      puzzle={scenario.puzzle}
      mirrors={scenario.mirrors}
      collectedNumbers={collectedNumbers}
      showVictoryLaser={showVictoryLaser}
      drawProgress={drawProgress}
    />
  );
}

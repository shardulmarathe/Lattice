"use client";

import { useEffect, useRef, useState } from "react";
import type { TutorialScenario } from "@/data/tutorialScenarios";
import {
  TUTORIAL_DRAW_MS,
  TUTORIAL_HOLD_MS,
  TUTORIAL_RESET_MS,
  TUTORIAL_STRAIGHT_DRAW_MS,
  TUTORIAL_STRAIGHT_HOLD_MS,
} from "@/data/tutorialScenarios";
import TutorialDemoBoard from "./TutorialDemoBoard";

interface TutorialDemoProps {
  scenario: TutorialScenario;
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

// Shared timeline — the same total loop for every demo so they reset in sync.
// placeMirrorMidLoop demos place their mirrors at PLACE_AT (1s) and draw the
// redirected beam until REDIRECT_END; regular demos draw for TUTORIAL_DRAW_MS
// and hold until HOLD_END.
const PLACE_AT = TUTORIAL_STRAIGHT_DRAW_MS + TUTORIAL_STRAIGHT_HOLD_MS;
const REDIRECT_END = PLACE_AT + TUTORIAL_DRAW_MS;
const HOLD_END = REDIRECT_END + TUTORIAL_HOLD_MS;
const LOOP_DURATION = HOLD_END + TUTORIAL_RESET_MS;

export default function TutorialDemo({ scenario }: TutorialDemoProps) {
  const [drawProgress, setDrawProgress] = useState(0);
  const [showEffect, setShowEffect] = useState(false);
  const [mirrorsPlaced, setMirrorsPlaced] = useState(
    !scenario.placeMirrorMidLoop
  );
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);

  useEffect(() => {
    const placing = scenario.placeMirrorMidLoop === true;

    const tick = (now: number) => {
      if (startRef.current === 0) startRef.current = now;
      const elapsed = (now - startRef.current) % LOOP_DURATION;

      if (placing && elapsed < TUTORIAL_STRAIGHT_DRAW_MS) {
        // Straight, mirror-less beam zips out.
        setMirrorsPlaced(false);
        setDrawProgress(easeOutCubic(elapsed / TUTORIAL_STRAIGHT_DRAW_MS));
        setShowEffect(false);
      } else if (placing && elapsed < PLACE_AT) {
        // Straight beam holds fully extended, then the mirror lands at 1s.
        setMirrorsPlaced(false);
        setDrawProgress(1);
        setShowEffect(false);
      } else if (placing && elapsed < REDIRECT_END) {
        // Mirror placed — the redirected beam draws.
        setMirrorsPlaced(true);
        const t = easeOutCubic((elapsed - PLACE_AT) / TUTORIAL_DRAW_MS);
        setDrawProgress(t);
        setShowEffect(t >= scenario.effectThreshold);
      } else if (!placing && elapsed < TUTORIAL_DRAW_MS) {
        const t = easeOutCubic(elapsed / TUTORIAL_DRAW_MS);
        setDrawProgress(t);
        setShowEffect(t >= scenario.effectThreshold);
      } else if (elapsed < HOLD_END) {
        setMirrorsPlaced(true);
        setDrawProgress(1);
        setShowEffect(scenario.effectThreshold <= 1);
      } else {
        setMirrorsPlaced(!placing);
        setDrawProgress(0);
        setShowEffect(false);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [scenario.effectThreshold, scenario.placeMirrorMidLoop]);

  const collectedNumbers = new Set<number>();
  const incorrectNumbers = new Set<number>();

  if (scenario.id === "correct-number" && showEffect) {
    collectedNumbers.add(3);
  }

  // Wrong-order number glows red, just like the live game.
  if (scenario.id === "wrong-number" && showEffect) {
    incorrectNumbers.add(5);
  }

  const showVictoryLaser = scenario.showVictoryLaser && showEffect;

  return (
    <TutorialDemoBoard
      puzzle={scenario.puzzle}
      mirrors={mirrorsPlaced ? scenario.mirrors : []}
      collectedNumbers={collectedNumbers}
      incorrectNumbers={incorrectNumbers}
      showVictoryLaser={showVictoryLaser}
      drawProgress={drawProgress}
    />
  );
}

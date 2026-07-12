"use client";

import { useMemo } from "react";
import type { TutorialScenario } from "@/data/tutorialScenarios";
import {
  TAP_RIPPLE_MS,
  TUTORIAL_DESKTOP_CELL_SCALE,
  TUTORIAL_RESET_AT_MS,
} from "@/data/tutorialScenarios";
import { buildBoard, calculateLaserPath } from "@/lib/laserEngine";
import { computeVisitArrivalFractions } from "@/lib/laserPathUtils";
import { getNumberTileStates } from "@/lib/validation";
import TutorialDemoBoard from "./TutorialDemoBoard";
import { useIsDesktop } from "./useIsDesktop";
import { useTutorialClock } from "./useTutorialClock";

interface TutorialDemoProps {
  scenario: TutorialScenario;
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

export default function TutorialDemo({ scenario }: TutorialDemoProps) {
  const { elapsed, loopCount } = useTutorialClock();
  const isDesktop = useIsDesktop();
  const cellSize = isDesktop
    ? Math.round(scenario.cellSize * TUTORIAL_DESKTOP_CELL_SCALE)
    : scenario.cellSize;

  // Active phase = the last one that has started; during the reset window the
  // demo falls back to phase 0's mirror set with no beam, so mid-loop-placed
  // mirrors vanish before the loop restarts.
  const inReset = elapsed >= TUTORIAL_RESET_AT_MS;
  let phaseIndex = 0;
  if (!inReset) {
    for (let i = 0; i < scenario.phases.length; i++) {
      if (elapsed >= scenario.phases[i].startMs) phaseIndex = i;
    }
  }
  const phase = scenario.phases[phaseIndex];

  // Phases are module constants, so their identity is stable across frames.
  const { board, laserResult, arrivals } = useMemo(() => {
    const board = buildBoard(scenario.puzzle, phase.mirrors);
    const laserResult = calculateLaserPath(scenario.puzzle, phase.mirrors);
    const arrivals = computeVisitArrivalFractions(
      laserResult.segments,
      laserResult.visitedCells
    );
    return { board, laserResult, arrivals };
  }, [scenario.puzzle, phase]);

  const raw = Math.min(
    1,
    Math.max(0, (elapsed - phase.startMs) / phase.drawMs)
  );
  const drawProgress = inReset
    ? 0
    : phase.easing === "linear"
      ? raw
      : easeOutCubic(raw);

  // Tiles light exactly as the beam tip passes them, with the live game's
  // in-order/out-of-order semantics, keyed by cell (duplicate values can be
  // in different states at once).
  const visiblePrefix = inReset
    ? []
    : laserResult.visitedCells.filter((_, i) => arrivals[i] <= drawProgress);
  const { collectedKeys, incorrectKeys } = getNumberTileStates(
    scenario.puzzle.code,
    board,
    visiblePrefix
  );

  const flagIncorrect =
    phase.flagIncorrectOnHold === true && raw >= 1 && !inReset;
  const victoryMode = phase.victory === true && !inReset;
  const showVictoryRing =
    victoryMode && raw >= 1 && laserResult.reachedFlag;

  const activeTap = scenario.taps?.find(
    (tap) => elapsed >= tap.atMs && elapsed < tap.atMs + TAP_RIPPLE_MS
  );
  const ripple =
    activeTap && !inReset
      ? { key: `${loopCount}-${activeTap.atMs}`, cell: activeTap.cell }
      : null;

  return (
    <TutorialDemoBoard
      puzzle={scenario.puzzle}
      board={board}
      segments={laserResult.segments}
      cellSize={cellSize}
      collectedKeys={collectedKeys}
      incorrectKeys={incorrectKeys}
      flagIncorrect={flagIncorrect}
      victoryMode={victoryMode}
      showVictoryRing={showVictoryRing}
      drawProgress={drawProgress}
      ripple={ripple}
    />
  );
}

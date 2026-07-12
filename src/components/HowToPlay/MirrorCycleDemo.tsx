"use client";

import { useRef } from "react";
import type { MirrorOrientation } from "@/lib/puzzleTypes";
import {
  MIRROR_CYCLE_SECTION,
  TAP_RIPPLE_MS,
  TUTORIAL_DESKTOP_CELL_SCALE,
} from "@/data/tutorialScenarios";
import MirrorTile from "@/components/Mirror/MirrorTile";
import TapRipple from "./TapRipple";
import { useIsDesktop } from "./useIsDesktop";
import { useTutorialClock } from "./useTutorialClock";

const CYCLE_STATES: (MirrorOrientation | null)[] = [null, "/", "\\", null];

/**
 * Tap-to-place demo: an empty board cell is tapped three times, cycling the
 * mirror through "/" → "\" → removed. No puzzle or laser involved.
 */
export default function MirrorCycleDemo() {
  const { elapsed, loopCount } = useTutorialClock();
  const isDesktop = useIsDesktop();
  const { gridSize, cell, tapsAtMs, stateDelayMs } = MIRROR_CYCLE_SECTION;
  const cellSize = isDesktop
    ? Math.round(MIRROR_CYCLE_SECTION.cellSize * TUTORIAL_DESKTOP_CELL_SCALE)
    : MIRROR_CYCLE_SECTION.cellSize;
  const boardSize = gridSize * cellSize;

  let stateIndex = 0;
  for (let i = 0; i < tapsAtMs.length; i++) {
    if (elapsed >= tapsAtMs[i] + stateDelayMs) stateIndex = i + 1;
  }
  const orientation = CYCLE_STATES[stateIndex];

  // Keep the last real orientation so the removal fades "\" out instead of
  // unmounting it instantly.
  const lastOrientationRef = useRef<MirrorOrientation>("/");
  if (orientation) lastOrientationRef.current = orientation;

  const activeTapAt = tapsAtMs.find(
    (atMs) => elapsed >= atMs && elapsed < atMs + TAP_RIPPLE_MS
  );

  return (
    <div
      className="relative shrink-0 border border-[#222222] bg-black"
      style={{ width: boardSize, height: boardSize }}
    >
      <div
        className="absolute inset-0 grid"
        style={{
          gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
          gridTemplateRows: `repeat(${gridSize}, 1fr)`,
        }}
      >
        {Array.from({ length: gridSize * gridSize }, (_, i) => (
          <div
            key={i}
            className="relative border border-[#222222]"
            style={{ width: cellSize, height: cellSize }}
          />
        ))}
      </div>

      <div
        className={`absolute transition-[opacity,transform] duration-150 ${
          orientation ? "scale-100 opacity-100" : "scale-75 opacity-0"
        }`}
        style={{ left: cell.x * cellSize, top: cell.y * cellSize }}
      >
        <MirrorTile
          orientation={orientation ?? lastOrientationRef.current}
          size={cellSize}
        />
      </div>

      {activeTapAt !== undefined && (
        <TapRipple
          key={`${loopCount}-${activeTapAt}`}
          cellSize={cellSize}
          cellX={cell.x}
          cellY={cell.y}
        />
      )}
    </div>
  );
}

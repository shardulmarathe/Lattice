"use client";

import type { MirrorOrientation, Position } from "@/lib/puzzleTypes";
import {
  MIRROR_CYCLE_SECTION,
  TAP_RIPPLE_MS,
  TUTORIAL_DESKTOP_CELL_SCALE,
  TUTORIAL_RESET_AT_MS,
} from "@/data/tutorialScenarios";
import MirrorTile from "@/components/Mirror/MirrorTile";
import TapRipple from "./TapRipple";
import { useIsDesktop } from "./useIsDesktop";
import { useTutorialClock } from "./useTutorialClock";

type PlacedMirror = { cell: Position; orientation: MirrorOrientation };

/**
 * Tap-to-place demo: taps land on a few empty cells and leave mirrors behind,
 * matching the other 3×3 how-to-play boards. No puzzle or laser involved.
 */
export default function MirrorCycleDemo() {
  const { elapsed, loopCount } = useTutorialClock();
  const isDesktop = useIsDesktop();
  const { gridSize, taps, stateDelayMs } = MIRROR_CYCLE_SECTION;
  const cellSize = isDesktop
    ? Math.round(MIRROR_CYCLE_SECTION.cellSize * TUTORIAL_DESKTOP_CELL_SCALE)
    : MIRROR_CYCLE_SECTION.cellSize;
  const boardSize = gridSize * cellSize;

  const inReset = elapsed >= TUTORIAL_RESET_AT_MS;

  const mirrors: PlacedMirror[] = [];
  if (!inReset) {
    for (const tap of taps) {
      if (elapsed >= tap.atMs + stateDelayMs) {
        mirrors.push({ cell: tap.cell, orientation: tap.orientation });
      }
    }
  }

  const activeTap =
    !inReset &&
    taps.find((tap) => elapsed >= tap.atMs && elapsed < tap.atMs + TAP_RIPPLE_MS);

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

      {mirrors.map((mirror) => (
        <div
          key={`${mirror.cell.x}-${mirror.cell.y}`}
          className="absolute scale-100 opacity-100 transition-[opacity,transform] duration-150"
          style={{
            left: mirror.cell.x * cellSize,
            top: mirror.cell.y * cellSize,
          }}
        >
          <MirrorTile orientation={mirror.orientation} size={cellSize} />
        </div>
      ))}

      {activeTap && (
        <TapRipple
          key={`${loopCount}-${activeTap.atMs}`}
          cellSize={cellSize}
          cellX={activeTap.cell.x}
          cellY={activeTap.cell.y}
        />
      )}
    </div>
  );
}

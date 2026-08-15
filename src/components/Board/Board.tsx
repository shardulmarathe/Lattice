"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  BoardCell,
  LaserResult,
  MirrorOrientation,
  Puzzle,
} from "@/lib/puzzleTypes";
import {
  buildMirrorContactMap,
  getMirrorVisualOffset,
  hasOpposingMirrorHits,
  mirrorCellKey,
  OPPOSING_MIRROR_VISUAL_OFFSET,
} from "@/lib/laserPathUtils";
import FlagTile from "./FlagTile";
import NumberTile from "./NumberTile";
import SourceTile from "./SourceTile";
import LaserPath from "../Laser/LaserPath";
import FlagVictoryLaser from "../Laser/FlagVictoryLaser";
import MirrorTile from "../Mirror/MirrorTile";
import TapRipple from "../HowToPlay/TapRipple";

interface BoardProps {
  puzzle: Puzzle;
  board: BoardCell[][];
  laserResult: LaserResult;
  collectedNumberKeys: Set<string>;
  incorrectNumberKeys: Set<string>;
  isFlagIncorrect?: boolean;
  onCellClick: (x: number, y: number) => void;
  disabled?: boolean;
  showVictoryLaser?: boolean;
  maxBoardWidth?: number;
  maxBoardHeight?: number;
  /** One-shot ripple on the cell a hint just acted on; replays per key. */
  hintFlash?: { key: number; x: number; y: number } | null;
}

// The largest a cell should ever grow on a spacious desktop viewport. Below
// this we let cells shrink to whatever it takes to keep the whole board on
// screen, fitting the viewport always wins over a fixed minimum cell size,
// otherwise large grids overflow narrow phones.
const MAX_CELL_SIZE = 72;

function computeCellSize(
  gridSize: number,
  maxBoardWidth?: number,
  maxBoardHeight?: number
): number {
  if (typeof window === "undefined") return 56;

  // Fall back to a viewport-derived budget until the container has been
  // measured, so the first paint is already close to the final size.
  const widthBudget =
    maxBoardWidth && maxBoardWidth > 0
      ? maxBoardWidth
      : Math.max(0, window.innerWidth - 32);
  const heightBudget =
    maxBoardHeight && maxBoardHeight > 0
      ? maxBoardHeight
      : window.innerHeight;

  const widthBased = Math.floor(widthBudget / gridSize);
  const heightBased = Math.floor(heightBudget / gridSize);

  // Never exceed the measured budget on either axis, that guarantees the
  // board fits with no overflow/clipping. Clamp to a sane minimum only to
  // avoid a zero-size board before measurement lands.
  return Math.max(12, Math.min(MAX_CELL_SIZE, widthBased, heightBased));
}

export default function Board({
  puzzle,
  board,
  laserResult,
  collectedNumberKeys,
  incorrectNumberKeys,
  isFlagIncorrect = false,
  onCellClick,
  disabled = false,
  showVictoryLaser = false,
  maxBoardWidth,
  maxBoardHeight,
  hintFlash = null,
}: BoardProps) {
  const [cellSize, setCellSize] = useState(() =>
    computeCellSize(puzzle.gridSize, maxBoardWidth, maxBoardHeight)
  );

  useEffect(() => {
    const updateSize = () => {
      setCellSize(
        computeCellSize(puzzle.gridSize, maxBoardWidth, maxBoardHeight)
      );
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, [puzzle.gridSize, maxBoardWidth, maxBoardHeight]);

  const boardSize = puzzle.gridSize * cellSize;
  const mirrorContacts = useMemo(
    () => buildMirrorContactMap(laserResult.segments),
    [laserResult.segments]
  );

  const isNumberCollected = (x: number, y: number) =>
    collectedNumberKeys.has(mirrorCellKey(x, y));

  const isNumberIncorrect = (x: number, y: number) =>
    incorrectNumberKeys.has(mirrorCellKey(x, y));

  const handleCellClick = (cell: BoardCell, x: number, y: number) => {
    if (disabled) return;
    // Empty/mirrors: place/cycle. Number/flag/source: forward so GameScreen can
    // warn (illegal placement, display only, not a mistake).
    if (
      cell.type === "empty" ||
      cell.type === "mirror" ||
      cell.type === "number" ||
      cell.type === "flag" ||
      cell.type === "source"
    ) {
      onCellClick(x, y);
    }
  };

  const getMirrorOffset = (x: number, y: number, orientation: MirrorOrientation) => {
    const contacts = mirrorContacts.get(mirrorCellKey(x, y));
    if (!contacts?.length) return { x: 0, y: 0 };
    const mirrorCell = { x, y };
    if (hasOpposingMirrorHits(contacts, mirrorCell)) {
      return OPPOSING_MIRROR_VISUAL_OFFSET;
    }
    const contact = contacts[contacts.length - 1];
    return getMirrorVisualOffset(contact, mirrorCell, cellSize, orientation);
  };

  return (
    <div
      className="relative border border-[#222222]"
      style={{ width: boardSize, height: boardSize }}
    >
      <div
        className="absolute inset-0 grid"
        style={{
          gridTemplateColumns: `repeat(${puzzle.gridSize}, 1fr)`,
          gridTemplateRows: `repeat(${puzzle.gridSize}, 1fr)`,
        }}
      >
        {board.map((row, y) =>
          row.map((cell, x) => {
            const isInteractive =
              !disabled &&
              (cell.type === "empty" ||
                cell.type === "mirror" ||
                cell.type === "number" ||
                cell.type === "flag" ||
                cell.type === "source");
            const mirrorOffset =
              cell.type === "mirror" && cell.mirror
                ? getMirrorOffset(x, y, cell.mirror)
                : null;

            return (
              <div
                key={`${x}-${y}`}
                className={`relative border border-[#222222] ${
                  isInteractive ? "cursor-pointer hover:bg-white/[0.03]" : ""
                }`}
                style={{ width: cellSize, height: cellSize }}
                onClick={() => handleCellClick(cell, x, y)}
              >
                {cell.type === "obstacle" && (
                  <div className="h-full w-full bg-white" />
                )}

                {cell.type === "source" && cell.sourceDirection && (
                  <SourceTile
                    direction={cell.sourceDirection}
                    size={cellSize}
                  />
                )}

                {cell.type === "flag" && (
                  <FlagTile size={cellSize} isIncorrect={isFlagIncorrect} />
                )}

                {cell.type === "number" && cell.number !== undefined && (
                  <NumberTile
                    value={cell.number}
                    size={cellSize}
                    isCollected={isNumberCollected(x, y)}
                    isIncorrect={isNumberIncorrect(x, y)}
                  />
                )}

                {mirrorOffset && cell.mirror && (
                  <MirrorTile
                    orientation={cell.mirror}
                    size={cellSize}
                    offsetX={mirrorOffset.x}
                    offsetY={mirrorOffset.y}
                  />
                )}
              </div>
            );
          })
        )}
      </div>

      <LaserPath
        segments={laserResult.segments}
        gridSize={puzzle.gridSize}
        cellSize={cellSize}
        victoryMode={showVictoryLaser}
        flagPosition={puzzle.flag}
      />

      {showVictoryLaser && laserResult.reachedFlag && (
        <FlagVictoryLaser
          flagX={puzzle.flag.x}
          flagY={puzzle.flag.y}
          cellSize={cellSize}
          boardSize={boardSize}
        />
      )}

      {hintFlash && (
        <TapRipple
          key={hintFlash.key}
          cellSize={cellSize}
          cellX={hintFlash.x}
          cellY={hintFlash.y}
        />
      )}
    </div>
  );
}

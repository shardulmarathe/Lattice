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
  mirrorCellKey,
} from "@/lib/laserPathUtils";
import FlagTile from "./FlagTile";
import NumberTile from "./NumberTile";
import SourceTile from "./SourceTile";
import LaserPath from "../Laser/LaserPath";
import FlagVictoryLaser from "../Laser/FlagVictoryLaser";
import MirrorTile from "../Mirror/MirrorTile";

interface BoardProps {
  puzzle: Puzzle;
  board: BoardCell[][];
  laserResult: LaserResult;
  collectedNumbers: Set<number>;
  onCellClick: (x: number, y: number) => void;
  disabled?: boolean;
  showVictoryLaser?: boolean;
}

function computeCellSize(gridSize: number): number {
  if (typeof window === "undefined") return 56;

  const maxBoardWidth = Math.min(window.innerWidth - 48, 640);
  const size = Math.floor(maxBoardWidth / gridSize);
  return Math.max(40, Math.min(72, size));
}

export default function Board({
  puzzle,
  board,
  laserResult,
  collectedNumbers,
  onCellClick,
  disabled = false,
  showVictoryLaser = false,
}: BoardProps) {
  const [cellSize, setCellSize] = useState(() => computeCellSize(puzzle.gridSize));

  useEffect(() => {
    const updateSize = () => {
      setCellSize(computeCellSize(puzzle.gridSize));
    };

    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, [puzzle.gridSize]);

  const boardSize = puzzle.gridSize * cellSize;
  const mirrorContacts = useMemo(
    () => buildMirrorContactMap(laserResult.segments),
    [laserResult.segments]
  );

  const isNumberCollected = (value: number) => collectedNumbers.has(value);

  const handleCellClick = (cell: BoardCell, x: number, y: number) => {
    if (disabled) return;
    if (cell.type === "empty" || cell.type === "mirror") {
      onCellClick(x, y);
    }
  };

  const getMirrorOffset = (x: number, y: number, orientation: MirrorOrientation) => {
    const contact = mirrorContacts.get(mirrorCellKey(x, y));
    if (!contact) return { x: 0, y: 0 };
    return getMirrorVisualOffset(contact, { x, y }, cellSize, orientation);
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
              !disabled && (cell.type === "empty" || cell.type === "mirror");
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

                {cell.type === "flag" && <FlagTile size={cellSize} />}

                {cell.type === "number" && cell.number !== undefined && (
                  <NumberTile
                    value={cell.number}
                    size={cellSize}
                    isCollected={isNumberCollected(cell.number)}
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
    </div>
  );
}

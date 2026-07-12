"use client";

import type {
  BoardCell,
  LaserSegment,
  Position,
  Puzzle,
} from "@/lib/puzzleTypes";
import { cellKey } from "@/lib/validation";
import FlagTile from "@/components/Board/FlagTile";
import NumberTile from "@/components/Board/NumberTile";
import SourceTile from "@/components/Board/SourceTile";
import FlagVictoryLaser from "@/components/Laser/FlagVictoryLaser";
import LaserPath from "@/components/Laser/LaserPath";
import MirrorTile from "@/components/Mirror/MirrorTile";
import TapRipple from "./TapRipple";

interface TutorialDemoBoardProps {
  puzzle: Puzzle;
  board: BoardCell[][];
  segments: LaserSegment[];
  cellSize: number;
  collectedKeys: Set<string>;
  incorrectKeys: Set<string>;
  flagIncorrect?: boolean;
  victoryMode: boolean;
  showVictoryRing: boolean;
  drawProgress: number;
  ripple?: { key: string; cell: Position } | null;
}

export default function TutorialDemoBoard({
  puzzle,
  board,
  segments,
  cellSize,
  collectedKeys,
  incorrectKeys,
  flagIncorrect = false,
  victoryMode,
  showVictoryRing,
  drawProgress,
  ripple,
}: TutorialDemoBoardProps) {
  const boardSize = puzzle.gridSize * cellSize;

  return (
    <div
      className="relative shrink-0 border border-[#222222] bg-black"
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
          row.map((cell, x) => (
            <div
              key={`${x}-${y}`}
              className="relative border border-[#222222]"
              style={{ width: cellSize, height: cellSize }}
            >
              {cell.type === "source" && cell.sourceDirection && (
                <SourceTile direction={cell.sourceDirection} size={cellSize} />
              )}

              {cell.type === "flag" && (
                <FlagTile size={cellSize} isIncorrect={flagIncorrect} />
              )}

              {cell.type === "number" && cell.number !== undefined && (
                <NumberTile
                  value={cell.number}
                  size={cellSize}
                  isCollected={collectedKeys.has(cellKey(x, y))}
                  isIncorrect={incorrectKeys.has(cellKey(x, y))}
                />
              )}

              {cell.type === "mirror" && cell.mirror && (
                <MirrorTile orientation={cell.mirror} size={cellSize} />
              )}
            </div>
          ))
        )}
      </div>

      <LaserPath
        segments={segments}
        gridSize={puzzle.gridSize}
        cellSize={cellSize}
        victoryMode={victoryMode}
        flagPosition={puzzle.flag}
        drawProgress={drawProgress}
        showParticles={false}
      />

      {showVictoryRing && (
        <FlagVictoryLaser
          flagX={puzzle.flag.x}
          flagY={puzzle.flag.y}
          cellSize={cellSize}
          boardSize={boardSize}
        />
      )}

      {ripple && (
        <TapRipple
          key={ripple.key}
          cellSize={cellSize}
          cellX={ripple.cell.x}
          cellY={ripple.cell.y}
        />
      )}
    </div>
  );
}

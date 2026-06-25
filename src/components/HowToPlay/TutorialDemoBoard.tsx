"use client";

import { useMemo } from "react";
import type { MirrorPlacement, Puzzle } from "@/lib/puzzleTypes";
import { buildBoard, calculateLaserPath } from "@/lib/laserEngine";
import { TUTORIAL_CELL_SIZE } from "@/data/tutorialScenarios";
import FlagTile from "@/components/Board/FlagTile";
import NumberTile from "@/components/Board/NumberTile";
import SourceTile from "@/components/Board/SourceTile";
import FlagVictoryLaser from "@/components/Laser/FlagVictoryLaser";
import LaserPath from "@/components/Laser/LaserPath";
import MirrorTile from "@/components/Mirror/MirrorTile";

interface TutorialDemoBoardProps {
  puzzle: Puzzle;
  mirrors: MirrorPlacement[];
  collectedNumbers: Set<number>;
  showVictoryLaser: boolean;
  drawProgress: number;
}

export default function TutorialDemoBoard({
  puzzle,
  mirrors,
  collectedNumbers,
  showVictoryLaser,
  drawProgress,
}: TutorialDemoBoardProps) {
  const cellSize = TUTORIAL_CELL_SIZE;
  const boardSize = puzzle.gridSize * cellSize;

  const board = useMemo(
    () => buildBoard(puzzle, mirrors),
    [puzzle, mirrors]
  );

  const laserResult = useMemo(
    () => calculateLaserPath(puzzle, mirrors),
    [puzzle, mirrors]
  );

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

              {cell.type === "flag" && <FlagTile size={cellSize} />}

              {cell.type === "number" && cell.number !== undefined && (
                <NumberTile
                  value={cell.number}
                  size={cellSize}
                  isCollected={collectedNumbers.has(cell.number)}
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
        segments={laserResult.segments}
        gridSize={puzzle.gridSize}
        cellSize={cellSize}
        victoryMode={showVictoryLaser}
        flagPosition={puzzle.flag}
        drawProgress={drawProgress}
        showParticles={false}
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

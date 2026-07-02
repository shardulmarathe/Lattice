/**
 * Calibration: grade the existing hand-made puzzles and print their objective
 * stats so the generation profile in config.ts can be sanity-checked against
 * human intuition. Run: `npm run puzzles:calibrate`.
 */

import { PUZZLES } from "@/data/puzzles";
import { grade } from "./grader";
import {
  GRID_MIN,
  GRID_MAX,
  CODE_MIN,
  CODE_MAX,
  MIRROR_DENSITY,
  MIRROR_DENSITY_FLOOR,
  SOLVER_BUDGET,
} from "./config";

function pad(value: string | number, width: number): string {
  return String(value).padEnd(width);
}

console.log("=== GENERATION PROFILE (all extra hard) ===");
console.log(`  grid size:      random ${GRID_MIN}..${GRID_MAX}`);
console.log(`  code length:    random ${CODE_MIN}..${CODE_MAX}`);
console.log(
  `  mirror density: target ${(MIRROR_DENSITY * 100).toFixed(0)}% of area ` +
    `(floor ${(MIRROR_DENSITY_FLOOR * 100).toFixed(0)}%)`
);
console.log(`  solver budget:  ${SOLVER_BUDGET.toLocaleString()} combinations`);

console.log("\n=== EXISTING PUZZLE GRADES ===");
console.log(
  `  ${pad("#", 4)}${pad("grid", 6)}${pad("code", 9)}${pad("obst", 6)}` +
    `${pad("minMir", 9)}${pad("cap", 5)}${pad("path", 6)}${pad("interf", 8)}${pad("score", 8)}`
);

for (const puzzle of PUZZLES) {
  const g = grade(puzzle);
  const minLabel = g.solvableWithinCap ? String(g.minMirrors) : `>${g.cap}`;
  console.log(
    `  ${pad(puzzle.id, 4)}${pad(`${puzzle.gridSize}x${puzzle.gridSize}`, 6)}` +
      `${pad(puzzle.code, 9)}${pad(puzzle.obstacles.length, 6)}${pad(minLabel, 9)}` +
      `${pad(g.cap, 5)}${pad(g.pathLength ?? "-", 6)}` +
      `${pad(g.obstacleInterference, 8)}${pad(g.score, 8)}`
  );
}

console.log(
  "\nminMir '>N' means no solution with N or fewer mirrors was found (solver cap N)."
);

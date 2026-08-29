/**
 * Backfill canonical solution witnesses into src/data/puzzleSolutions.json.
 *
 * Every registered puzzle already has a machine-proven exact minimum in
 * src/data/puzzleStats.json, but the witness (the actual mirror list) was
 * historically discarded. This script re-derives it by solving each puzzle AT
 * exactly its known minimum budget (startBudget = maxBudget = minMirrors), so
 * only the witness-finding level runs, no re-proving of the empty levels.
 *
 * Never-clobber: ids that already hold a witness of length ≤ minMirrors are
 * skipped. Writes incrementally after each puzzle so an interrupted run keeps
 * its progress. Ends with a full validation pass over the file: every entry
 * must have length === minMirrors and solve the puzzle through the real
 * engine; any failure exits 1.
 *
 * Usage:
 *   npm run puzzles:solutions              # backfill all proven puzzles
 *   npm run puzzles:solutions -- --ids=8,20
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PUZZLES } from "@/data/puzzles";
import { calculateLaserPath } from "@/lib/laserEngine";
import { validateSequence } from "@/lib/validation";
import { solveExactMin } from "./exactMin";
import { REPO_ROOT } from "./codegen";
import {
  SOLUTIONS_FILE,
  mergeSolution,
  readSolutions,
  writeSolutionsOrdered,
} from "./solutionsStore";

const STATS_FILE = join(REPO_ROOT, "src", "data", "puzzleStats.json");
const PER_PUZZLE_MINUTES = 10;

interface Stat {
  minMirrors?: number;
  minMirrorsAtLeast?: number;
}

function parseIds(): Set<number> | null {
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--ids="))
      return new Set(arg.slice("--ids=".length).split(",").map(Number));
  }
  return null;
}

const ids = parseIds();
const stats: Record<string, Stat> = existsSync(STATS_FILE)
  ? JSON.parse(readFileSync(STATS_FILE, "utf8"))
  : {};
const solutions = readSolutions();

let solved = 0;
let skipped = 0;

for (const puzzle of PUZZLES) {
  if (ids !== null && !ids.has(puzzle.id)) continue;

  const min = stats[puzzle.id]?.minMirrors;
  if (min === undefined) {
    console.log(`#${puzzle.id}: no proven exact minimum yet, skipping.`);
    continue;
  }

  const existing = solutions[puzzle.id];
  if (existing && existing.length <= min) {
    skipped++;
    continue;
  }

  const t0 = Date.now();
  const res = solveExactMin(puzzle, {
    startBudget: min,
    maxBudget: min,
    deadlineMs: Date.now() + PER_PUZZLE_MINUTES * 60_000,
  });
  const secs = ((Date.now() - t0) / 1000).toFixed(1);

  if (res.minMirrors === min && res.solution) {
    solutions[puzzle.id] = mergeSolution(existing, res.solution)!;
    writeSolutionsOrdered(SOLUTIONS_FILE, solutions);
    solved++;
    console.log(
      `#${puzzle.id}: witness with ${res.solution.length} mirrors  (${secs}s, ${res.nodes.toLocaleString()} nodes)`
    );
  } else {
    console.error(
      `#${puzzle.id}: FAILED to find a witness at budget ${min}${res.aborted ? " (timed out)" : ""}, stats may be stale.`
    );
    process.exitCode = 1;
  }
}

// Full validation pass: every stored witness must match the proven minimum
// and actually solve its puzzle through the real engine.
let invalid = 0;
for (const [key, mirrors] of Object.entries(solutions)) {
  const id = Number(key);
  const puzzle = PUZZLES.find((p) => p.id === id);
  if (!puzzle) {
    console.error(`solutions: #${id} is not a registered puzzle.`);
    invalid++;
    continue;
  }
  const min = stats[id]?.minMirrors;
  if (mirrors.length !== min) {
    console.error(
      `solutions: #${id} witness has ${mirrors.length} mirrors but minMirrors is ${min}.`
    );
    invalid++;
    continue;
  }
  const result = calculateLaserPath(puzzle, mirrors);
  if (!validateSequence(puzzle.code, result).isComplete) {
    console.error(`solutions: #${id} witness does not solve the puzzle.`);
    invalid++;
  }
}

if (invalid > 0) process.exitCode = 1;
console.log(
  `\nDone. ${solved} witness(es) solved this run, ${skipped} already present, ` +
    `${Object.keys(solutions).length} total in ${SOLUTIONS_FILE}${invalid ? `, ${invalid} INVALID` : ""}.`
);

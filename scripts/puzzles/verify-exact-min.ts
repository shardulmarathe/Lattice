/**
 * Regression check for the exact min-mirror solver.
 *
 * Re-solves every puzzle with a solver-proven `minMirrors` in puzzleStats.json
 * FROM SCRATCH (startBudget 1) and asserts the solver reproduces the exact
 * stored value. Any divergence, smaller, larger, or unsolved, fails loudly.
 * Witnesses are additionally validated against the real game engine inside
 * solveExactMin itself.
 *
 * Run after any change to exactMin.ts:
 *   npm run puzzles:verify-min
 *   npm run puzzles:verify-min -- --ids=19,22
 */

import { PUZZLES } from "@/data/puzzles";
import puzzleStats from "@/data/puzzleStats.json";
import { solveExactMin } from "./exactMin";

/** Curated (hand-solved) values the solver never proved.
 * Currently empty: #17's curated 18 was machine-checked and corrected to a
 * proven 16. See ARCHITECTURE.md. */
const CURATED_IDS = new Set<number>([]);

const idsArg = process.argv.find((a) => a.startsWith("--ids="));
const onlyIds = idsArg
  ? new Set(idsArg.slice("--ids=".length).split(",").map(Number))
  : null;

const stats = puzzleStats as Record<string, { minMirrors?: number }>;

const targets = PUZZLES.filter((p) => {
  if (onlyIds && !onlyIds.has(p.id)) return false;
  if (CURATED_IDS.has(p.id)) return false;
  return stats[String(p.id)]?.minMirrors !== undefined;
});

console.log(`Verifying exact min-mirrors for ${targets.length} puzzle(s)...\n`);

let failures = 0;
let totalNodes = 0;
const t0 = Date.now();

for (const puzzle of targets) {
  const expected = stats[String(puzzle.id)].minMirrors!;
  const start = Date.now();
  // maxBudget = expected: the solver must prove every level below empty and
  // then find a witness exactly at the stored minimum.
  const res = solveExactMin(puzzle, { maxBudget: expected });
  const secs = ((Date.now() - start) / 1000).toFixed(2);
  totalNodes += res.nodes;

  if (res.minMirrors === expected) {
    console.log(
      `  #${puzzle.id}: OK  min=${expected}  (${secs}s, ${res.nodes.toLocaleString()} nodes)`
    );
  } else {
    failures++;
    console.error(
      `  #${puzzle.id}: MISMATCH: expected min=${expected}, got ` +
        `${res.minMirrors ?? `unsolved (≥${res.provenNoSolutionUpTo + 1})`} (${secs}s)`
    );
  }
}

const totalSecs = ((Date.now() - t0) / 1000).toFixed(1);
console.log(
  `\n${targets.length - failures}/${targets.length} verified in ${totalSecs}s ` +
    `(${totalNodes.toLocaleString()} nodes total).`
);
if (failures > 0) {
  console.error("VERIFICATION FAILED");
  process.exit(1);
}

/**
 * Daily puzzle generator entrypoint.
 *
 * Tops up a rolling buffer of scheduled daily puzzles: for every date from today
 * through the horizon that has no scheduled puzzle, generate one (difficulty by
 * weekly cadence), verify it with the real engine, grade it, and codegen the
 * draft + index + schedule files. Idempotent — if the buffer is already covered,
 * it writes nothing.
 *
 * Usage:
 *   npm run puzzles:generate                 # buffer 7 days ahead of UTC today
 *   npm run puzzles:generate -- --days=14    # wider buffer
 *   npm run puzzles:generate -- --today=2026-07-20 --dry-run
 */

import { readdirSync } from "node:fs";
import { join } from "node:path";
import { PUZZLES } from "@/data/puzzles";
import { PUZZLE_SCHEDULE } from "@/data/schedule";
import { generatePuzzle, puzzleHash } from "./generator";
import { solveExactMin } from "./exactMin";
import {
  REPO_ROOT,
  readScheduleJson,
  writeDraftFile,
  writePuzzlesIndex,
  writeScheduleJson,
  writeScheduleModule,
  writeSolutionSidecar,
} from "./codegen";

// Exact-min budget at generation time. Kept modest so the daily cron stays
// quick — dense "extra hard" dailies cap out to a lower bound here anyway; the
// offline `puzzles:stats --exact` backfill can spend more to nail moderate ones.
// Calibrated to the rewritten solver (~30M nodes/sec): worst case ~20s per
// puzzle, enough to prove an exact min for almost every generated puzzle at
// creation time. Real minimums of 17-18 exist (#8, #17), hence maxBudget 24.
const EXACT_MIN_GEN_OPTIONS = { maxBudget: 24, nodeCap: 500_000_000 } as const;

interface Args {
  today: string;
  days: number;
  maxNew: number;
  dryRun: boolean;
}

function parseArgs(): Args {
  const args: Args = {
    today: new Date().toISOString().slice(0, 10),
    days: 7,
    maxNew: 30,
    dryRun: false,
  };
  for (const arg of process.argv.slice(2)) {
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg.startsWith("--today=")) args.today = arg.slice("--today=".length);
    else if (arg.startsWith("--days=")) args.days = Number(arg.slice("--days=".length));
    else if (arg.startsWith("--max-new=")) args.maxNew = Number(arg.slice("--max-new=".length));
  }
  return args;
}

function addDays(dateKey: string, n: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + n * 86_400_000).toISOString().slice(0, 10);
}

/** Highest existing puzzle id across drafts and registry (avoids id/file collisions). */
function maxExistingId(): number {
  let max = 1;
  for (const puzzle of PUZZLES) max = Math.max(max, puzzle.id);
  const draftsDir = join(REPO_ROOT, "src", "data", "drafts");
  for (const file of readdirSync(draftsDir)) {
    const match = file.match(/^puzzle-(\d+)\.ts$/);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return max;
}

function main(): void {
  const args = parseArgs();

  // Source of truth for the schedule; bootstrap from the committed module on first run.
  const schedule: Record<string, number> =
    readScheduleJson() ?? { ...PUZZLE_SCHEDULE };

  // Duplicate protection against every already-published puzzle.
  const hashes = new Set(PUZZLES.map((p) => puzzleHash(p)));

  let nextId = maxExistingId() + 1;
  const generatedDraftIds: number[] = [];
  let created = 0;

  for (let offset = 0; offset <= args.days; offset++) {
    if (created >= args.maxNew) break;
    const dateKey = addDays(args.today, offset);
    if (schedule[dateKey] !== undefined) continue; // already covered

    const generated = generatePuzzle(dateKey, hashes);
    if (!generated) {
      console.error(`✗ ${dateKey}: generation failed after max attempts`);
      process.exitCode = 1;
      return;
    }

    const id = nextId++;
    const puzzle = { id, ...generated.puzzle };
    hashes.add(puzzleHash(generated.puzzle));
    schedule[dateKey] = id;
    generatedDraftIds.push(id);
    created++;

    const area = puzzle.gridSize * puzzle.gridSize;
    const density = ((generated.solution.length / area) * 100).toFixed(0);
    console.log(
      `✓ ${dateKey} → #${id}  code=${puzzle.code}  ${puzzle.gridSize}×${puzzle.gridSize}  ` +
        `mirrors=${generated.solution.length}/${area} (${density}%)  ` +
        `min>${generated.grade.cap}  path=${generated.grade.pathLength}  attempts=${generated.attempts}`
    );

    if (!args.dryRun) {
      // Exact min-mirror search (beam-guided), separate from the anti-triviality
      // check which only searched up to solution.length - 1. Records an exact
      // minimum when the bounded search proves one, else a lower bound. Dense
      // "extra hard" dailies typically cap out (bound only); moderate ones solve.
      const exact = solveExactMin(puzzle, EXACT_MIN_GEN_OPTIONS);
      console.log(
        `    exact min: ${
          exact.minMirrors !== undefined
            ? exact.minMirrors
            : `≥${exact.minMirrorsAtLeast}`
        } (${exact.nodes.toLocaleString()} nodes${exact.proven ? "" : ", node-capped"})`
      );

      writeDraftFile(puzzle, dateKey, generated);
      writeSolutionSidecar({
        id,
        scheduledDate: dateKey,
        code: puzzle.code,
        gridSize: puzzle.gridSize,
        seed: generated.seed,
        solutionMirrors: generated.solution,
        mirrorCount: generated.solution.length,
        mirrorDensity: generated.grade.mirrorDensity,
        solverCap: generated.grade.cap,
        ...(exact.minMirrors !== undefined
          ? { minMirrors: exact.minMirrors }
          : { minMirrorsAtLeast: exact.minMirrorsAtLeast! }),
        pathLength: generated.grade.pathLength,
        obstacleInterference: generated.grade.obstacleInterference,
        score: generated.grade.score,
      });
    }
  }

  if (created === 0) {
    console.log(
      `Buffer already covers ${args.today} … ${addDays(args.today, args.days)} — nothing to do.`
    );
    return;
  }

  // All registered draft ids come from the schedule (id 1 is inline in puzzles.ts).
  const registeredDraftIds = [...new Set(Object.values(schedule))].filter((id) => id !== 1);

  if (args.dryRun) {
    console.log(`\n[dry-run] would create ${created} puzzle(s); no files written.`);
    return;
  }

  writeScheduleJson(schedule);
  writeScheduleModule(schedule);
  writePuzzlesIndex(registeredDraftIds);
  console.log(
    `\nWrote ${created} puzzle(s), regenerated puzzles.ts + schedule.ts + schedule.json.`
  );
}

main();

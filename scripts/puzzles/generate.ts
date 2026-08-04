/**
 * Daily puzzle generator entrypoint.
 *
 * Tops up a rolling buffer of scheduled daily puzzles: for every date from today
 * through the horizon that has no scheduled puzzle, generate one (difficulty by
 * weekly cadence), verify it with the real engine, grade it, and codegen the
 * draft + index + schedule files. Idempotent, if the buffer is already covered,
 * it writes nothing.
 *
 * Usage:
 *   npm run puzzles:generate                 # buffer 7 days ahead of UTC today
 *   npm run puzzles:generate -- --days=14    # wider buffer
 *   npm run puzzles:generate -- --today=2026-07-20 --dry-run
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PUZZLES } from "@/data/puzzles";
import { PUZZLE_SCHEDULE } from "@/data/schedule";
import { generatePuzzle, puzzleHash } from "./generator";
import {
  SOLUTIONS_FILE,
  mergeSolution,
  readSolutions,
  writeSolutionsOrdered,
} from "./solutionsStore";
import {
  REPO_ROOT,
  readScheduleJson,
  writeDraftFile,
  writePuzzlesIndex,
  writeScheduleJson,
  writeScheduleModule,
  writeSolutionSidecar,
} from "./codegen";

/**
 * Runtime min-mirror stats the app reads (efficiency %, speed pacing). Generation
 * PROVES each puzzle's exact minimum as its difficulty gate, so we record it here
 * immediately, the daily is fully paced the moment it's created, and the nightly
 * solver skips it (its progress bootstraps from this) instead of re-proving it.
 */
const STATS_FILE = join(REPO_ROOT, "src", "data", "puzzleStats.json");
interface Stat {
  minMirrors?: number;
  minMirrorsAtLeast?: number;
}
function readStats(): Record<number, Stat> {
  if (!existsSync(STATS_FILE)) return {};
  try {
    return JSON.parse(readFileSync(STATS_FILE, "utf8")) as Record<number, Stat>;
  } catch {
    return {};
  }
}
function writeStats(stats: Record<number, Stat>): void {
  const ordered: Record<number, Stat> = {};
  for (const id of Object.keys(stats).map(Number).sort((a, b) => a - b)) ordered[id] = stats[id];
  writeFileSync(STATS_FILE, JSON.stringify(ordered, null, 2) + "\n");
}

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

  const stats = readStats();

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
        `craft=${generated.craft.score} (reuse=${generated.craft.reuse} cross=${generated.craft.crossings})  ` +
        `solutions=${generated.solutions}  ` +
        `min>${generated.grade.cap}  path=${generated.grade.pathLength}  attempts=${generated.attempts}`
    );

    if (!args.dryRun) {
      // The difficulty gate already proved this puzzle's exact minimum (or a
      // ≥-floor lower bound) during generation, reuse it rather than solving
      // again. Records an exact minimum when proven, else a lower bound.
      const exact = generated.exact;
      console.log(
        `    exact min: ${
          exact.minMirrors !== undefined
            ? exact.minMirrors
            : `≥${exact.minMirrorsAtLeast}`
        } (${exact.nodes.toLocaleString()} nodes${exact.proven ? "" : ", node-capped"})`
      );

      // Record the min-mirror stat the app reads, so the daily is fully paced
      // (efficiency %, speed targets) the instant it's generated.
      stats[id] =
        exact.minMirrors !== undefined
          ? { minMirrors: exact.minMirrors }
          : { minMirrorsAtLeast: exact.minMirrorsAtLeast! };

      // Ship the proven-minimal witness so the new daily has HINT support
      // from day one; unproven puzzles are picked up by the nightly solver.
      if (exact.minMirrors !== undefined && exact.solution) {
        const solutions = readSolutions();
        const merged = mergeSolution(solutions[id], exact.solution);
        if (merged) {
          solutions[id] = merged;
          writeSolutionsOrdered(SOLUTIONS_FILE, solutions);
        }
      }

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
  writeStats(stats);
  console.log(
    `\nWrote ${created} puzzle(s), regenerated puzzles.ts + schedule.ts + schedule.json + puzzleStats.json.`
  );
}

main();

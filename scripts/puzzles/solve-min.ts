/**
 * Resumable exact min-mirror worker.
 *
 * Chews through every registered puzzle that doesn't yet have a proven exact
 * minimum, ordered by soonest play date (so upcoming dailies are solved before
 * they go live), and writes the answer into src/data/puzzleStats.json.
 *
 * It is RESUMABLE and TIME-BOXED, built for a nightly CI job:
 *   - A wall-clock budget (`--minutes`, default 300) bounds the whole run so the
 *     job exits cleanly under GitHub's 6h ceiling.
 *   - Per-puzzle progress (highest mirror budget proven empty) is persisted to
 *     content/min-progress.json, so the next run RESUMES a hard puzzle at the
 *     next budget level instead of restarting. Over successive nights a stubborn
 *     puzzle is ground down until solved.
 *   - Files are written after every puzzle, so a killed job never loses work.
 *
 * PARALLEL SHARDS: `--shard=k/n` takes every n-th puzzle of the priority queue
 * (offset k), and `--out-suffix=.shardK` redirects writes to suffixed copies of
 * the stats/progress files so concurrent shard processes never race on the
 * canonical files. merge-min-shards.ts folds the copies back in afterwards.
 *
 * Usage:
 *   npm run puzzles:solve-min                 # 5h box, all unsolved by play date
 *   npm run puzzles:solve-min -- --minutes=30 # shorter box
 *   npm run puzzles:solve-min -- --ids=17,19  # only these puzzles
 *   npm run puzzles:solve-min -- --shard=0/2 --out-suffix=.shard0   # CI shard
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PUZZLES } from "@/data/puzzles";
import { emptyCells } from "./grader";
import { solveExactMin } from "./exactMin";
import { REPO_ROOT } from "./codegen";

const STATS_FILE = join(REPO_ROOT, "src", "data", "puzzleStats.json");
const PROGRESS_FILE = join(REPO_ROOT, "content", "min-progress.json");
const SCHEDULE_FILE = join(REPO_ROOT, "src", "data", "schedule.json");

interface Stat {
  minMirrors?: number;
  minMirrorsAtLeast?: number;
}
interface Progress {
  solved: boolean;
  minMirrors?: number;
  /** Highest mirror budget proven to have no solution. Resume at this + 1. */
  provenNoSolutionUpTo?: number;
}

interface Args {
  minutes: number;
  ids: Set<number> | null;
  shard: { index: number; count: number } | null;
  outSuffix: string;
}

function parseArgs(): Args {
  const args: Args = { minutes: 300, ids: null, shard: null, outSuffix: "" };
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--minutes=")) args.minutes = Number(arg.slice("--minutes=".length));
    else if (arg.startsWith("--ids="))
      args.ids = new Set(arg.slice("--ids=".length).split(",").map(Number));
    else if (arg.startsWith("--shard=")) {
      const [index, count] = arg.slice("--shard=".length).split("/").map(Number);
      if (!Number.isInteger(index) || !Number.isInteger(count) || count < 1 || index < 0 || index >= count) {
        throw new Error(`Invalid --shard=${arg.slice("--shard=".length)} (expected k/n with 0 ≤ k < n)`);
      }
      args.shard = { index, count };
    } else if (arg.startsWith("--out-suffix=")) args.outSuffix = arg.slice("--out-suffix=".length);
  }
  return args;
}

function readJson<T>(file: string, fallback: T): T {
  if (!existsSync(file)) return fallback;
  try {
    return JSON.parse(readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeOrdered(file: string, map: Record<number, unknown>): void {
  const ordered: Record<number, unknown> = {};
  for (const id of Object.keys(map).map(Number).sort((a, b) => a - b)) {
    ordered[id] = map[id];
  }
  writeFileSync(file, JSON.stringify(ordered, null, 2) + "\n");
}

const args = parseArgs();
const stats = readJson<Record<number, Stat>>(STATS_FILE, {});
const progress = readJson<Record<number, Progress>>(PROGRESS_FILE, {});
const schedule = readJson<Record<string, number>>(SCHEDULE_FILE, {});

// id → earliest scheduled play date.
const playDate = new Map<number, string>();
for (const [date, id] of Object.entries(schedule)) {
  const existing = playDate.get(id);
  if (existing === undefined || date < existing) playDate.set(id, date);
}

const today = new Date().toISOString().slice(0, 10);

/** Bootstrap a puzzle's progress from whatever puzzleStats already knows. */
function initialProgress(id: number): Progress {
  const existing = progress[id];
  if (existing) return existing;
  const stat = stats[id];
  if (stat?.minMirrors !== undefined) return { solved: true, minMirrors: stat.minMirrors };
  if (stat?.minMirrorsAtLeast !== undefined)
    return { solved: false, provenNoSolutionUpTo: stat.minMirrorsAtLeast - 1 };
  return { solved: false, provenNoSolutionUpTo: 0 };
}

// Order unsolved puzzles: upcoming play dates first (ascending), then past dates,
// then unscheduled by id.
function sortKey(id: number): string {
  const date = playDate.get(id);
  if (date === undefined) return `2:${String(id).padStart(6, "0")}`;
  return date >= today ? `0:${date}:${id}` : `1:${date}:${id}`;
}

const queue = PUZZLES.map((p) => p.id)
  .filter((id) => (args.ids === null || args.ids.has(id)))
  .filter((id) => !initialProgress(id).solved)
  .sort((a, b) => sortKey(a).localeCompare(sortKey(b)))
  // Shards deal the sorted queue round-robin, so each shard still works in
  // priority order and shard 0 always holds the most imminent puzzle.
  .filter((_, i) => args.shard === null || i % args.shard.count === args.shard.index);

// Suffixed outputs let parallel shard processes write without racing; the merge
// script folds them back into the canonical files.
const statsOut = STATS_FILE + args.outSuffix;
const progressOut = PROGRESS_FILE + args.outSuffix;

const deadline = Date.now() + args.minutes * 60_000;
const shardLabel = args.shard ? ` [shard ${args.shard.index}/${args.shard.count}]` : "";
console.log(
  `Solve-min${shardLabel}: ${queue.length} unsolved puzzle(s) in queue, ${args.minutes}m budget.\n` +
    `queue order: ${queue.join(", ") || "(none)"}\n`
);

let solvedThisRun = 0;
let improvedThisRun = 0;

for (const id of queue) {
  if (Date.now() >= deadline) {
    console.log("Time budget exhausted — stopping.");
    break;
  }

  const puzzle = PUZZLES.find((p) => p.id === id)!;
  const prog = initialProgress(id);
  const ceiling = emptyCells(puzzle).length; // valid upper bound: min ≤ empty cells
  const startBudget = (prog.provenNoSolutionUpTo ?? 0) + 1;
  const date = playDate.get(id) ?? "unscheduled";

  const t0 = Date.now();
  const res = solveExactMin(puzzle, {
    maxBudget: ceiling,
    startBudget,
    deadlineMs: deadline,
  });
  const secs = ((Date.now() - t0) / 1000).toFixed(1);

  if (res.minMirrors !== undefined) {
    progress[id] = { solved: true, minMirrors: res.minMirrors };
    stats[id] = { minMirrors: res.minMirrors };
    solvedThisRun++;
    console.log(
      `#${id} (${date}) SOLVED: min ${res.minMirrors}  (resumed@${startBudget}, ${secs}s, ${res.nodes.toLocaleString()} nodes)`
    );
  } else {
    progress[id] = { solved: false, provenNoSolutionUpTo: res.provenNoSolutionUpTo };
    const bound = res.provenNoSolutionUpTo + 1;
    if (stats[id]?.minMirrors === undefined) {
      const prevBound = stats[id]?.minMirrorsAtLeast ?? 0;
      if (bound > prevBound) {
        stats[id] = { minMirrorsAtLeast: bound };
        improvedThisRun++;
      }
    }
    console.log(
      `#${id} (${date}) unsolved: ≥${bound}  (resumed@${startBudget}, ${secs}s, ${res.nodes.toLocaleString()} nodes${res.aborted ? ", timed out" : ""})`
    );
  }

  // Persist after every puzzle so a killed job keeps its progress.
  writeOrdered(statsOut, stats as Record<number, unknown>);
  writeOrdered(progressOut, progress as Record<number, unknown>);

  if (res.aborted) {
    console.log("Deadline reached mid-search — stopping.");
    break;
  }
}

console.log(
  `\nDone. Solved ${solvedThisRun} exactly, improved ${improvedThisRun} lower bound(s) this run.`
);

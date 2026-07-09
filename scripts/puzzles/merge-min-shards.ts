/**
 * Fold parallel solve-min shard outputs back into the canonical files.
 *
 * Scans for `puzzleStats.json.shard*` / `min-progress.json.shard*` written by
 * `solve-min.ts --out-suffix=...`, merges them into src/data/puzzleStats.json
 * and content/min-progress.json with NEVER-DOWNGRADE semantics, then deletes
 * the shard files:
 *   - a proven exact `minMirrors` always beats a lower bound;
 *   - conflicting exact values (should never happen) keep the smaller one — a
 *     smaller witness-verified solution is the stronger fact — with a loud
 *     warning;
 *   - lower bounds keep the maximum seen.
 *
 * Shard files contain each process's full view (its updates + a possibly stale
 * snapshot of the other ids), which is safe: a stale entry can never win a
 * never-downgrade merge.
 *
 * Usage: npm run puzzles:merge-min
 */

import { existsSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { REPO_ROOT } from "./codegen";

const STATS_FILE = join(REPO_ROOT, "src", "data", "puzzleStats.json");
const PROGRESS_FILE = join(REPO_ROOT, "content", "min-progress.json");

interface Stat {
  minMirrors?: number;
  minMirrorsAtLeast?: number;
}
interface Progress {
  solved: boolean;
  minMirrors?: number;
  provenNoSolutionUpTo?: number;
}

function shardFilesFor(canonical: string): string[] {
  const dir = dirname(canonical);
  const base = basename(canonical);
  return readdirSync(dir)
    .filter((f) => f.startsWith(base + ".shard"))
    .map((f) => join(dir, f))
    .sort();
}

function readJson<T>(file: string, fallback: T): T {
  if (!existsSync(file)) return fallback;
  try {
    return JSON.parse(readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeOrdered(file: string, map: Record<string, unknown>): void {
  const ordered: Record<string, unknown> = {};
  for (const id of Object.keys(map).map(Number).sort((a, b) => a - b)) {
    ordered[id] = map[id];
  }
  writeFileSync(file, JSON.stringify(ordered, null, 2) + "\n");
}

function mergeStat(base: Stat | undefined, next: Stat | undefined, id: string): Stat | undefined {
  if (!base) return next;
  if (!next) return base;
  if (base.minMirrors !== undefined && next.minMirrors !== undefined) {
    if (base.minMirrors !== next.minMirrors) {
      console.warn(
        `WARNING: #${id} has conflicting exact minimums (${base.minMirrors} vs ${next.minMirrors}); keeping the smaller.`
      );
    }
    return { minMirrors: Math.min(base.minMirrors, next.minMirrors) };
  }
  if (base.minMirrors !== undefined) return base;
  if (next.minMirrors !== undefined) return next;
  return {
    minMirrorsAtLeast: Math.max(base.minMirrorsAtLeast ?? 0, next.minMirrorsAtLeast ?? 0),
  };
}

function mergeProgress(
  base: Progress | undefined,
  next: Progress | undefined,
  id: string
): Progress | undefined {
  if (!base) return next;
  if (!next) return base;
  if (base.solved && next.solved) {
    if (base.minMirrors !== next.minMirrors) {
      console.warn(
        `WARNING: #${id} has conflicting solved minimums (${base.minMirrors} vs ${next.minMirrors}); keeping the smaller.`
      );
      return { solved: true, minMirrors: Math.min(base.minMirrors ?? Infinity, next.minMirrors ?? Infinity) };
    }
    return base;
  }
  if (base.solved) return base;
  if (next.solved) return next;
  return {
    solved: false,
    provenNoSolutionUpTo: Math.max(base.provenNoSolutionUpTo ?? 0, next.provenNoSolutionUpTo ?? 0),
  };
}

function mergeFile<T>(
  canonical: string,
  merge: (base: T | undefined, next: T | undefined, id: string) => T | undefined
): number {
  const shards = shardFilesFor(canonical);
  if (shards.length === 0) return 0;
  const merged = readJson<Record<string, T>>(canonical, {});
  for (const shard of shards) {
    const data = readJson<Record<string, T>>(shard, {});
    for (const [id, value] of Object.entries(data)) {
      const result = merge(merged[id], value, id);
      if (result !== undefined) merged[id] = result;
    }
    console.log(`merged ${shard}`);
  }
  writeOrdered(canonical, merged);
  for (const shard of shards) unlinkSync(shard);
  return shards.length;
}

const statShards = mergeFile<Stat>(STATS_FILE, mergeStat);
const progressShards = mergeFile<Progress>(PROGRESS_FILE, mergeProgress);

if (statShards === 0 && progressShards === 0) {
  console.log("No shard files found — nothing to merge.");
} else {
  console.log(`Done: merged ${statShards} stats shard(s), ${progressShards} progress shard(s).`);
}

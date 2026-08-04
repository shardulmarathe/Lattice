/**
 * Shared store for canonical puzzle solutions (exact-min solver witnesses).
 *
 * src/data/puzzleSolutions.json maps puzzle id → MirrorPlacement[], a
 * proven-minimal, engine-verified mirror set. It is bundled into the client
 * (same pattern as src/data/puzzleStats.json) and powers the in-game HINT
 * button. All writers go through mergeSolution so the semantics live in one
 * place: FEWER MIRRORS WINS; on equal length the existing witness is kept, so
 * re-solves that find a different equal-length witness never churn the file.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { MirrorPlacement } from "../../src/lib/puzzleTypes";
import { REPO_ROOT } from "./codegen";

export const SOLUTIONS_FILE = join(
  REPO_ROOT,
  "src",
  "data",
  "puzzleSolutions.json"
);

export type SolutionsMap = Record<string, MirrorPlacement[]>;

export function readSolutions(file: string = SOLUTIONS_FILE): SolutionsMap {
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(readFileSync(file, "utf8")) as SolutionsMap;
  } catch {
    return {};
  }
}

export function mergeSolution(
  existing: MirrorPlacement[] | undefined,
  next: MirrorPlacement[] | undefined
): MirrorPlacement[] | undefined {
  if (!existing) return next;
  if (!next) return existing;
  return next.length < existing.length ? next : existing;
}

export function writeSolutionsOrdered(
  file: string,
  map: SolutionsMap
): void {
  const ordered: SolutionsMap = {};
  for (const id of Object.keys(map)
    .map(Number)
    .sort((a, b) => a - b)) {
    ordered[id] = map[id];
  }
  writeFileSync(file, JSON.stringify(ordered, null, 2) + "\n");
}

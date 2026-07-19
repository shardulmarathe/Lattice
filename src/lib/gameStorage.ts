import type { MirrorPlacement, Puzzle } from "./puzzleTypes";
import { calculateLaserPath } from "./laserEngine";
import { validateSequence } from "./validation";

export interface SavedGameState {
  puzzleId: number;
  /**
   * Signature of the puzzle content this save belongs to. Guards against a save
   * from an OLD puzzle loading for a NEW puzzle that reused the same id (dailies
   * are regenerated in place) — a stale completion would otherwise lock the
   * player out of the new puzzle. Optional so pre-signature saves still load
   * (validated by content coherence instead — see loadGameState).
   */
  signature?: string;
  mirrors: MirrorPlacement[];
  elapsedSeconds: number;
  completionSeconds: number | null;
  isComplete: boolean;
  isViewingSolve: boolean;
  isPaused: boolean;
  /**
   * Mistakes this session: wrong-number collections + premature flag hits.
   * Counting only — no effect on win/time.
   */
  wrongNumberHits: number;
  /** HINT button presses this session. Counting only — no penalty. */
  hintsUsed: number;
}

/**
 * "record" is the canonical, shareable solve of a puzzle (never overwritten by a
 * replay). "practice" is a throwaway slot used by replay sessions so re-solving a
 * past puzzle can never destroy the recorded time.
 */
export type GameMode = "record" | "practice";

const RECORD_PREFIX = "lattice-game-";
const PRACTICE_PREFIX = "lattice-practice-";

function storageKey(puzzleId: number, mode: GameMode): string {
  const prefix = mode === "practice" ? PRACTICE_PREFIX : RECORD_PREFIX;
  return `${prefix}${puzzleId}`;
}

/**
 * Deterministic signature of a puzzle's content (independent of its id). Two
 * puzzles with the same board/code/numbers/obstacles hash equal; any change makes
 * a save from the old content mismatch. Mirrors the fields of the generator's
 * `puzzleHash` (scripts/puzzles/generator.ts) so "same content" means the same
 * thing on both sides.
 */
export function puzzleSignature(puzzle: Puzzle): string {
  const nums = [...puzzle.numbers]
    .map((n) => `${n.value}@${n.x},${n.y}`)
    .sort()
    .join("|");
  const obs = [...puzzle.obstacles]
    .map((o) => `${o.x},${o.y}`)
    .sort()
    .join("|");
  return [
    `g${puzzle.gridSize}`,
    `c${puzzle.code}`,
    `s${puzzle.source.x},${puzzle.source.y},${puzzle.source.direction}`,
    `f${puzzle.flag.x},${puzzle.flag.y}`,
    `n${nums}`,
    `o${obs}`,
  ].join(";");
}

/**
 * Whether a legacy (pre-signature) save is still coherent with `puzzle`. Used to
 * decide if a save with no signature belongs to the current puzzle: its mirrors
 * must sit on legal cells, and a completed save's mirrors must actually solve the
 * puzzle. A save from a different puzzle that reused this id fails these checks.
 */
function isLegacySaveCoherent(
  parsed: SavedGameState,
  puzzle: Puzzle
): boolean {
  const { gridSize } = puzzle;
  const blocked = new Set<string>([
    `${puzzle.source.x},${puzzle.source.y}`,
    `${puzzle.flag.x},${puzzle.flag.y}`,
    ...puzzle.obstacles.map((o) => `${o.x},${o.y}`),
  ]);
  for (const m of parsed.mirrors) {
    if (m.x < 0 || m.x >= gridSize || m.y < 0 || m.y >= gridSize) return false;
    if (blocked.has(`${m.x},${m.y}`)) return false;
  }
  if (parsed.isComplete) {
    const result = calculateLaserPath(puzzle, parsed.mirrors);
    if (!validateSequence(puzzle.code, result).isComplete) return false;
  }
  return true;
}

export function loadGameState(
  puzzle: Puzzle,
  mode: GameMode = "record"
): SavedGameState | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(storageKey(puzzle.id, mode));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as SavedGameState;
    if (parsed.puzzleId !== puzzle.id) return null;

    const signature = puzzleSignature(puzzle);
    // Reject a save that belongs to different puzzle content under the same id.
    if (typeof parsed.signature === "string") {
      if (parsed.signature !== signature) return null;
    } else if (!isLegacySaveCoherent(parsed, puzzle)) {
      return null;
    }

    return {
      puzzleId: puzzle.id,
      // Adopt the current signature so the next save uses the fast path.
      signature,
      mirrors: Array.isArray(parsed.mirrors) ? parsed.mirrors : [],
      elapsedSeconds:
        typeof parsed.elapsedSeconds === "number" ? parsed.elapsedSeconds : 0,
      completionSeconds:
        typeof parsed.completionSeconds === "number"
          ? parsed.completionSeconds
          : null,
      isComplete: Boolean(parsed.isComplete),
      isViewingSolve: Boolean(parsed.isViewingSolve),
      isPaused: Boolean(parsed.isPaused),
      // Backward-compatible: old saves predate these fields.
      wrongNumberHits:
        typeof parsed.wrongNumberHits === "number" ? parsed.wrongNumberHits : 0,
      hintsUsed: typeof parsed.hintsUsed === "number" ? parsed.hintsUsed : 0,
    };
  } catch {
    return null;
  }
}

export function saveGameState(
  state: SavedGameState,
  mode: GameMode = "record"
): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(
      storageKey(state.puzzleId, mode),
      JSON.stringify(state)
    );
  } catch {
    // Ignore quota / private browsing errors
  }
}

export function clearPracticeState(puzzleId: number): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(storageKey(puzzleId, "practice"));
  } catch {
    // Ignore private browsing errors
  }
}

export function createDefaultGameState(puzzle: Puzzle): SavedGameState {
  return {
    puzzleId: puzzle.id,
    signature: puzzleSignature(puzzle),
    mirrors: [],
    elapsedSeconds: 0,
    completionSeconds: null,
    isComplete: false,
    isViewingSolve: false,
    isPaused: false,
    wrongNumberHits: 0,
    hintsUsed: 0,
  };
}

export function isPuzzleComplete(puzzle: Puzzle): boolean {
  const saved = loadGameState(puzzle);
  return Boolean(saved?.isComplete && saved.completionSeconds !== null);
}

export type PuzzleProgressStatus = "unsolved" | "in-progress" | "solved";

export interface PuzzleProgress {
  status: PuzzleProgressStatus;
  completionSeconds: number | null;
  mirrorsUsed: number;
}

/** Summary of a puzzle's canonical (record) state, for the archive list. */
export function getPuzzleProgress(puzzle: Puzzle): PuzzleProgress {
  const saved = loadGameState(puzzle);

  if (!saved) {
    return { status: "unsolved", completionSeconds: null, mirrorsUsed: 0 };
  }

  if (saved.isComplete && saved.completionSeconds !== null) {
    return {
      status: "solved",
      completionSeconds: saved.completionSeconds,
      mirrorsUsed: saved.mirrors.length,
    };
  }

  const started = saved.mirrors.length > 0 || saved.elapsedSeconds > 0;
  return {
    status: started ? "in-progress" : "unsolved",
    completionSeconds: null,
    mirrorsUsed: saved.mirrors.length,
  };
}

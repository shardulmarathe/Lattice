import type { MirrorPlacement } from "./puzzleTypes";

export interface SavedGameState {
  puzzleId: number;
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

export function loadGameState(
  puzzleId: number,
  mode: GameMode = "record"
): SavedGameState | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(storageKey(puzzleId, mode));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as SavedGameState;
    if (parsed.puzzleId !== puzzleId) return null;

    return {
      puzzleId,
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

export function createDefaultGameState(puzzleId: number): SavedGameState {
  return {
    puzzleId,
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

export function isPuzzleComplete(puzzleId: number): boolean {
  const saved = loadGameState(puzzleId);
  return Boolean(saved?.isComplete && saved.completionSeconds !== null);
}

export type PuzzleProgressStatus = "unsolved" | "in-progress" | "solved";

export interface PuzzleProgress {
  status: PuzzleProgressStatus;
  completionSeconds: number | null;
  mirrorsUsed: number;
}

/** Summary of a puzzle's canonical (record) state, for the archive list. */
export function getPuzzleProgress(puzzleId: number): PuzzleProgress {
  const saved = loadGameState(puzzleId);

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

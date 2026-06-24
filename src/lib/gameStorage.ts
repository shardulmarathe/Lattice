import type { MirrorPlacement } from "./puzzleTypes";

export interface SavedGameState {
  puzzleId: number;
  mirrors: MirrorPlacement[];
  elapsedSeconds: number;
  completionSeconds: number | null;
  isComplete: boolean;
  isViewingSolve: boolean;
  isPaused: boolean;
}

const STORAGE_PREFIX = "lattice-game-";

function storageKey(puzzleId: number): string {
  return `${STORAGE_PREFIX}${puzzleId}`;
}

export function loadGameState(puzzleId: number): SavedGameState | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(storageKey(puzzleId));
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
    };
  } catch {
    return null;
  }
}

export function saveGameState(state: SavedGameState): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(storageKey(state.puzzleId), JSON.stringify(state));
  } catch {
    // Ignore quota / private browsing errors
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
  };
}

export function isPuzzleComplete(puzzleId: number): boolean {
  const saved = loadGameState(puzzleId);
  return Boolean(saved?.isComplete && saved.completionSeconds !== null);
}

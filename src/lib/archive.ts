import { formatDateKey, PUZZLE_SCHEDULE } from "@/data/schedule";

export interface PastPuzzleEntry {
  id: number;
  dateKey: string;
}

/**
 * All puzzle ids scheduled on a date on or before `today`. Used to gate
 * `?puzzle=N` in production so players cannot jump ahead to future puzzles.
 */
export function getUnlockedPuzzleIds(today: Date): Set<number> {
  const todayKey = formatDateKey(today);
  const ids = new Set<number>();

  for (const [dateKey, id] of Object.entries(PUZZLE_SCHEDULE)) {
    if (dateKey <= todayKey) {
      ids.add(id);
    }
  }

  return ids;
}

export function isPuzzleUnlocked(id: number, today: Date): boolean {
  return getUnlockedPuzzleIds(today).has(id);
}

/**
 * The most recent scheduled dailies strictly before `today`, most-recent-first,
 * capped at `limit`. Today itself is excluded (it's the PLAY button).
 * Walks dates (not ids) because ids can skip in the schedule.
 */
export function getPastPuzzleEntries(
  today: Date,
  limit = 5
): PastPuzzleEntry[] {
  const todayKey = formatDateKey(today);

  return Object.entries(PUZZLE_SCHEDULE)
    .filter(([dateKey]) => dateKey < todayKey)
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .slice(0, limit)
    .map(([dateKey, id]) => ({ id, dateKey }));
}

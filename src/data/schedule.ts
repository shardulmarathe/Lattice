/** Maps calendar dates (YYYY-MM-DD) to puzzle ids. */
export const PUZZLE_SCHEDULE: Record<string, number> = {
  "2026-06-24": 2,
  "2026-06-25": 3,
  "2026-06-26": 4,
  "2026-06-27": 5,
  "2026-06-28": 6,
  "2026-06-29": 7,
  "2026-06-30": 8,
  "2026-07-01": 9,
  "2026-07-02": 10,
  "2026-07-03": 11,
  "2026-07-04": 12,
  "2026-07-05": 13,
  "2026-07-06": 14,
  "2026-07-07": 15,
  "2026-07-08": 16,
  "2026-07-09": 17,
  "2026-07-10": 18,
  "2026-07-11": 19,
  "2026-07-12": 20,
};

export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getScheduledPuzzleId(date: Date): number | undefined {
  return PUZZLE_SCHEDULE[formatDateKey(date)];
}

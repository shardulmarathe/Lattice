# Lattice

A browser-based daily puzzle game. Route mirrors to guide a laser through numbered tiles in order,
then reach the flag. One puzzle per calendar date.

## Verify
```bash
npm run lint      # next lint — the only check this repo has
npm run build     # next build
```
**There is no typecheck script and no test suite.** Don't claim either ran. If you need type
safety on a change, run `npx tsc --noEmit` explicitly and say that you did.

## Layout
- `src/data/schedule.ts` — `YYYY-MM-DD` → puzzle id. The scheduling source of truth.
- `src/data/drafts/puzzle-NNN.ts` — generated, unapproved puzzles.
- `src/lib/gameStorage.ts` — the `localStorage` layer.
- `scripts/puzzles/*` — 7 `tsx` tools: `generate`, `calibrate`, `stats`, `solve-min`, `solutions`,
  `verify-min`, `merge-min`.

## Invariants
- Progress (mirrors, timer, completion) is persisted in `localStorage` **per `puzzleId`**.
  **Reloading must not reset progress or let a completed daily puzzle be replayed.** Never add a
  reload-to-restart path to a production build.
- `/play?puzzle=N&replay=1` is the playtest escape hatch and is **ignored unless
  `NODE_ENV === "development"`**. Never enable blanket replay for a puzzle id in production.
- `/play` serves `getPuzzleForDate(today)`, falling back to `PUZZLE_001`.
- Generation does **not** schedule. Approval schedules.

## Puzzle generation: the batch-of-5 protocol
This lives here rather than in a glob-scoped rule because it tracks conversational state — it has
to be loaded at the moment the user types "approved", which is exactly when no puzzle file is open.

- Generate in **batches of 5**. Track the *current* puzzle in the batch (e.g. #17).
- When the user says **approved**, schedule that puzzle for the next calendar date and advance to
  the next in the batch. **The user should not have to name the puzzle number.**
- Tile and obstacle edits apply to the **current** puzzle until it is approved.
- After all 5 are approved and scheduled, generate N+1…N+5 and reset tracking to the first.

Parameters, varied per puzzle: grid `3–10` square · code length `3–7` digits, number tiles matching
code order · obstacles `gridSize - 3`, floored at 0 for 3×3 and 1 for 4×4, minimum 2 for 5×5 and up,
**no two obstacles orthogonally adjacent**.

<!-- Owner: me. Reviewed 2026-09-14. The batch protocol was promoted out of
     .cursor/rules/puzzle-persistence.mdc, which was glob-scoped and could never attach in time. -->

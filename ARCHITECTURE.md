# Architecture

How Lattice is built: the puzzle pipeline, the exact-minimum solver that grades
every puzzle, and the persistence rules that the game depends on.

## The shape of the app

Lattice serves one puzzle per day. A puzzle is a grid holding a laser source, a
set of numbered tiles, obstacles, and a flag. The player places mirrors to route
the beam through the numbers in code order and then into the flag.

`/play` serves `getPuzzleForDate(today)`, falling back to `PUZZLE_001`. Approved
puzzles are mapped to dates in `src/data/schedule.ts` (`YYYY-MM-DD` → puzzle id).

## Minimum-mirror metadata

Every puzzle carries a *proven* minimum mirror count. This is what makes the
completion screen's Mirror Efficiency meaningful, it compares the player's
solution against a machine-proven optimum, not a heuristic.

- **`src/data/puzzleStats.json`**, `id → { minMirrors? | minMirrorsAtLeast? }`.
  `minMirrors` is a proven exact minimum; `minMirrorsAtLeast` is a proven lower
  bound for puzzles that hit a search cap before being fully resolved.
- **`src/lib/puzzleStats.ts`**, `getPuzzleStats`, `getMirrorEfficiency`, and the
  speed-label derivation, with safe fallbacks when data is missing.
- **`src/data/puzzleSolutions.json`**, a solution witness per puzzle. This is
  what backs the HINT feature; a puzzle whose witness has not landed simply hides
  the HINT button.

The SPEED tile renders a word label derived purely from the puzzle's minimum
mirror count, not a grid-area par heuristic.

## The exact-minimum solver

`scripts/puzzles/exactMin.ts` is a beam-guided iterative-deepening branch and
bound. It only branches at cells the laser actually reaches, a minimal solution
never contains off-path mirrors, and deepens by mirror budget, so the first
solve it finds is provably minimal. It is bounded by a budget ceiling, a
wall-clock deadline, and an optional node cap, and is resumable at budget
granularity via `startBudget`, reporting `provenNoSolutionUpTo`.

Performance-critical details, all of which preserve search semantics:

- **Flat typed arrays.** Board, decisions and code digits are `Int8Array`s
  indexed `y*size+x`, rather than rebuilding an object board and re-deriving the
  mirror list at every node.
- **Incremental beam resume.** Each node saves the beam's arrival state at its
  branch cell (position, direction, code index, step count) on the recursion
  stack, so children re-simulate only the changed suffix instead of re-tracing
  from the source.
- **Budget-exhausted tail prune.** With no mirrors left to place, committing
  "straight" can never alter the beam, so a node still needing a decision is
  provably dead. This collapses what were long unary tails in the search tree.
- **Witness re-verification.** Every solution found is re-run through the real
  `calculateLaserPath` + `validateSequence` before being returned. A mismatch
  throws rather than recording a wrong minimum.

Throughput is roughly 25–30M nodes/sec on an M-series Mac. The hardest registered
puzzle needed 8.49B nodes and about 4.6 minutes to prove.

`npm run puzzles:verify-min` is the permanent regression check: it re-solves
every solver-proven puzzle from scratch and asserts exact equality with the
stored value. **Run it after any change to `exactMin.ts`.** Note that a full run
takes several minutes because the two hardest puzzles re-prove from scratch.

## Generation and the difficulty gate

Mirror *density* is decorative, a densely built solution is not a hard puzzle,
because the player only has to route the beam through the numbers and flag in
order, and a cheaper path usually exists. Grading for density produced
auto-generated dailies clustering at exact-min 7–9 while hand-made puzzles sat at
15–17.

The gate is therefore the proven exact minimum itself:

- **`scripts/puzzles/config.ts`**, `MIN_EXACT_MIRRORS` is the single difficulty
  knob, alongside shared `EXACT_MIN_GEN_OPTIONS` (`maxBudget 24`, `nodeCap 500M`)
  so the gate and the sidecar record use one config.
- **`scripts/puzzles/generator.ts`**, `attempt()` proves an exact minimum at or
  above the floor before accepting a candidate. It accepts a proven `minMirrors ≥
  floor` or a proven `minMirrorsAtLeast ≥ floor` (node-capped but already hard
  enough) and rejects the ambiguous middle. A cheap-to-solve board is proven and
  rejected in milliseconds; only genuinely hard boards pay for a full solve. A
  pre-filter rejects any construction shorter than the floor before solving at
  all, which is what makes small grids self-reject.

Because generation runs `solveExactMin` at creation time, nearly every generated
puzzle ships with a proven exact minimum already recorded.

## Save invalidation

Regeneration reuses puzzle ids in place, which made the per-puzzle `localStorage`
save stale-but-live. `SavedGameState` was keyed only by id (`lattice-game-{id}`)
and a load was validated solely on `parsed.puzzleId !== id`, never on content.
A player who finished the old #28 kept an `isComplete: true` save that loaded for
the new #28, rendering the completed view and locking them out of the new puzzle.

`src/lib/gameStorage.ts` now derives a `puzzleSignature(puzzle)`, deterministic
over grid size, code, source, flag, sorted numbers and sorted obstacles, mirroring
the generator's `puzzleHash`, and stores it on `SavedGameState`.

- A stored signature must match, or the save is discarded.
- A legacy save with no signature is kept only if it is coherent: every mirror on
  a legal cell, and when `isComplete`, the mirrors must actually solve the puzzle
  (`calculateLaserPath` + `validateSequence`, the same pair the generator uses).
  A kept load is re-stamped with the current signature.

`loadGameState`, `isPuzzleComplete`, `getPuzzleProgress` and
`createDefaultGameState` therefore all take the `Puzzle`, not just an id. Any
future in-place regeneration self-heals; orphaned saves are discarded on next
load.

## Persistence and replay rules

These are load-bearing, breaking them is a player-visible regression:

- Game progress (mirrors, timer, completion) persists in `localStorage` per
  `puzzleId`.
- **Reloading must not reset progress**, and must not allow replaying a completed
  daily puzzle.
- Do not add reload-to-restart shortcuts to production builds.
- To replay while playtesting locally, use `/play?puzzle=N&replay=1`. The
  `replay=1` flag is ignored unless `NODE_ENV === "development"`; never enable
  blanket replay for a puzzle id in production.

When generating new puzzles, work in batches of five and schedule none of them at
generation time.

## Automation

Three scheduled workflows keep the game running without intervention. Each
commits back to `master`, and each commit triggers a Vercel redeploy.

| Workflow | Schedule | Does |
|---|---|---|
| `daily-puzzle.yml` | 06:00 UTC | Tops up a rolling buffer of scheduled dailies |
| `og-refresh.yml` | on push + 06:30 UTC | Recaptures the link-preview image |
| `solve-min-mirrors.yml` | 07:00 UTC | Proves exact minimums for unsolved puzzles |

`og-refresh` runs here rather than in the Vercel build because headless Chrome
cannot launch in Vercel's build container. It also runs on its own schedule
because `daily-puzzle` pushes with `GITHUB_TOKEN`, which cannot trigger another
workflow.

The nightly solver (`scripts/puzzles/solve-min.ts`) works a queue ordered by
soonest play date, upcoming dailies first, then past-dated, then unscheduled -
inside a 350-minute box under GitHub's 6-hour cap. It re-sorts every night, so a
new upcoming daily always takes priority, and hard puzzles resume across nights
via `content/min-progress.json` rather than restarting.

It runs **two parallel shards**, each taking every second puzzle of the sorted
queue (`--shard=k/2`, round-robin so shard 0 always holds the most imminent
puzzle). Each writes `*.shard*` copies of the stats and progress files, which are
gitignored; `merge-min-shards.ts` folds them back with never-downgrade semantics
, exact beats bound, conflicting exacts keep the smaller with a warning, bounds
keep the max, then deletes the shard files. The merge and commit steps run
`if: always()` so a crashed shard cannot lose the other's work. Without sharding,
one hard puzzle could starve the whole backlog on a shared deadline.

## Commands

```
npm run dev                 # local dev
npm run build               # prod build (also captures the OG image)
npm run verify:share        # assert the share-text format
npm run puzzles:generate    # daily buffer top-up (exact-min at generation time)
npm run puzzles:stats       # rebuild puzzleStats.json (baseline)
npm run puzzles:solutions   # backfill/verify witnesses → puzzleSolutions.json
npm run puzzles:solve-min   # resumable time-boxed exact-min worker (nightly)
npm run puzzles:merge-min   # fold shard outputs into the canonical files
npm run puzzles:verify-min  # regression: re-solve all proven minimums, assert equal
```

Useful flag combinations:

```
# upgrade a single bound to an exact minimum
npm run puzzles:stats -- --exact --ids=17 --node-cap=25000000

# time-boxed per id, for the genuinely hard ones
npm run puzzles:stats -- --exact --ids=8,17,20 --node-cap=100000000000 --minutes=115

# one parallel CI shard
npm run puzzles:solve-min -- --shard=0/2 --out-suffix=.shard0
```

`puzzles:stats --exact` never downgrades an existing exact value, writes
incrementally after each solved puzzle so an interrupted long run keeps its
progress, and a time-limited recompute can never lower a known bound.

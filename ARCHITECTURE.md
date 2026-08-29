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

## Sound

Every sound is synthesized in Web Audio at runtime, there are no audio assets.
The palette lives in `src/lib/audio/voices.ts`. All levels sit in `MIX` and all
durations in `SHAPE`; tuning the mix means editing those two objects, never the
voice bodies.

There are two voice families and they are built on opposite principles. Discrete
events are an **electrical arc**; anything held is a **hum**. Do not reach for
the arc primitive when adding a sustained voice, or the hum primitive when
adding a one-shot.

### One-shots: the arc

A laser event is four layers, not one: a transient crack, a resonant descending
body, **sizzle**, and a tail. The sizzle is the layer that decides whether the
palette reads as a laser or as an arcade bleep, and the thing to understand
about it is that **sizzle is noise modulating something, not noise by itself**.
Static bandpassed noise sounds like "shhh"; noise driven into a filter's cutoff
sounds like frying. Two earlier passes failed precisely here, one landing on an
arcade "pew".

`sizzle()` therefore modulates four destinations at once, following how arc and
electricity effects are actually built: a white-noise source and a
sample-and-hold source both drive the bandpass `frequency`, a slower
sample-and-hold drives its `Q` so the bandwidth breathes, and another source
multiplies the output gain. Sparse impulses from `crackleBuffer` add the
discrete pops. The mechanism that makes all of this possible without any assets
is that Web Audio lets an `AudioBufferSourceNode` connect **directly to an
`AudioParam`**, so a noise buffer is a literal audio-rate modulator.

Two hazards live in that primitive, both of which have bitten:

- **Modulation depth must stay strictly below the band floor.** If the summed
  excursion drives `bandpass.frequency` to or through 0 Hz the filter goes
  unstable, and the voice measured a peak of 112378 instead of 0.1.
- **The generated buffers are `Math.random()`.** That is fine in the app but
  means any measurement of a click or sizzle voice must seed the generator
  first, or the numbers are noise (see below).

### Continuous voices: the hum

The cursor tone and the in-game beam were originally built on the arc rig too,
and that was wrong. A texture that is exciting for 300ms is punishing for 300
seconds, and the arc rig has two properties that make a held version of it
actively unpleasant: its energy sits at 2-9 kHz, and a sample-and-hold chops its
amplitude at engine speeds. Players reported the first as "scratchy" and the
second, sitting under a 52 Hz resonant sweep, as a lawnmower. Measured, the old
beam had **50 to 88 percent of its energy above 4 kHz**.

So `buildHum` contains no noise at all. It is a small harmonic stack
(fundamental, octave, fifth), each partial doubled and detuned with the copies
panned apart so the beating between them supplies the aura, plus two sine
vibratos and two sine amplitude LFOs at deliberately incommensurate rates, under
a gentle lowpass. `HUM` is its tuning surface, in the same spirit as `MIX` and
`SHAPE`, and it is read at build time, so a running voice must be torn down and
rebuilt to pick up a change.

Two rules here:

- **Rates must not be commensurate.** One vibrato reads as a synth patch with an
  effect on it within about two seconds; two that never line up read as alive.
- **`breatheBase` minus the summed `breathe` depths must stay above zero.** The
  LFOs sum onto that gain stage's intrinsic value. Drive it through zero and
  `|gain|` folds the waveform back on itself, so the voice distorts rather than
  breathing. Current values leave 0.4 of headroom, which is not much.

`src/lib/audio/engine.ts` is a module-level singleton, deliberately outside
React. It has to be: the victory sting starts on the board in `/play` and
finishes on the checkmark in `/complete`, which is impossible if the
`AudioContext` is owned by a component that unmounts at the route boundary.
`SoundProvider` therefore wraps `{children}` in `src/app/layout.tsx`, above the
route boundary, and `src/lib/audio/victoryHandoff.ts` carries the one-shot
"a solve just happened" flag across the navigation. That flag is module state
rather than storage on purpose, so a reload or a deep link to `/complete` is
silent.

Load-bearing rules:

- **Nothing is audible until a real gesture.** Browsers refuse to start an
  `AudioContext` otherwise, and `mousemove` does not qualify. `unlock()` is the
  only thing that constructs the context; applying a stored preference must
  never call it, or every visitor gets a context they never asked for.
- **The sound toggle owns its own gesture.** The global arming listener skips
  events inside `[data-sound-toggle]`. Without that skip it arms audio on
  `pointerdown`, so the toggle's `click` arrives already armed and reads as
  "mute", and tapping "enable sound" silences the app.
- **The toggle icon reflects `audible` (enabled *and* armed), not the stored
  preference.** An enabled-but-locked toggle showing a live speaker is a lie.
- **Continuous voices are torn down when muted**, not just gained to zero, so a
  muted tab is not running oscillators nobody can hear.
- Bus levels are ramped with `setTargetAtTime`, never assigned. Direct
  assignment clicks.

## The beam voice

The in-game background is not ambience, it is the beam. `createBeamVoice` is
driven by the real laser state the game already computes, so it changes every
time a mirror moves because the beam on screen actually changed. All four inputs
map onto the hum:

| Input | Effect |
| --- | --- |
| `segments.length` | pitch and presence. A longer path resonates lower, like a longer string. |
| `terminatedBy` | brightness. `"flag"` is a beam under control and rings clear; `"obstacle"` and `"boundary"` are duller. |
| bounce count | thickness, through the fifth's level and the stereo spread. Every fold adds a resonance to the chord. This axis used to be carried by spark density. |
| mistake | the detuned copies pushed apart until they audibly beat, plus a faster vibrato, a pitch sag and a darker filter. |

`GameScreen` computes the bounce count from `laserResult.visitedCells` and
`getMirrorAt`. The mistake state is meant to be uncomfortable without being
louder, so it must never be expressed as gain.

Note that `LaserResult["terminatedBy"]` still declares `"revisit"`, which
`calculateLaserPath` never actually emits; the beam maps it to `null`.

Both continuous voices, the cursor tone and the beam, sit far below the
one-shots because sustained tone reads much louder than a transient at the same
peak.

## Judging the mix without hearing it

`npm run sound:measure` renders every voice through an `OfflineAudioContext` in
headless Chrome against the real bus graph, and sweeps the beam's whole state
space. An earlier version of this harness was written into a scratch directory
and lost, which is why it is now committed at `scripts/audio/measure.mjs`.

Flags: `--verify` re-runs everything in a fresh page to prove the numbers are
reproducible, `--compare` diffs against `HEAD`, `--baseline` measures `HEAD`
itself, `--json` dumps raw.

What it reports, and why each is not readable from the source:

- **Peak amplitude**, since `MIX` entries are *drive* levels and the resonant
  filters add 10-20 dB, so the numbers cannot be compared to each other by eye.
- **Spectral flatness**, which separates a harmonic stack (near 0) from noise
  (near 1). This is the "scratchy" test.
- **Energy above 4 kHz**, which is where scratch actually lives.
- **`arcChop`**, the fraction of the high band's amplitude envelope modulated
  between 25 and 200 Hz. This is the "lawnmower" test. It is reported as `-`
  when there is no high band to chop, which is the strongest possible result.
- **Slow modulation rate and depth**, which should be vibrato and breathing.

Three traps, all of which produced confidently wrong numbers before being found:

- **Seed `Math.random`, and rewind it before every render, not once per run.**
  Without seeding, click and sizzle voices measure differently every run; that
  produced a round of non-monotonic tuning where raising a voice's drive lowered
  its measured peak. Without rewinding *per render*, sweep order leaks into the
  results: removing randomness from the continuous voices shifted the stream and
  moved an untouched `uiTick`'s peak by 65 percent.
- **An envelope window shorter than the carrier's period measures the carrier.**
  A 1.45ms RMS window reported a 92 Hz fundamental's own octave partial as "184
  Hz of modulation" across every voice.
- **Gate band-limited metrics on the FFT, never on a filter's output.** Filters
  leak. Gating `arcChop` on highpass RMS let a fundamental 60 dB down dominate,
  and every voice in the palette scored 0.96.

Absolute pass bands are only meaningful for voices under active design. For
everything else the useful question is "did I change it", which is `--compare`.

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

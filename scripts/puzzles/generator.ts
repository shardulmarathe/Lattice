/**
 * Reverse puzzle generation, tuned for "extra hard": build a mirror-dense
 * solution first, then delete the mirrors.
 *
 * Because the engine is deterministic, any puzzle produced this way is provably
 * solvable with the generator's own mirror set, we then verify with the REAL
 * engine + win check, enforce the hardness constraints, and grade with the
 * min-mirror solver.
 *
 * The solution is built as a self-avoiding laser walk (see buildWalk), placing a
 * mirror at each turn. Final solvability is always asserted against the real
 * engine (src/lib/laserEngine.ts), never the construction scaffold.
 */

import type {
  Direction,
  MirrorOrientation,
  MirrorPlacement,
  Position,
  Puzzle,
  SourceConfig,
} from "../../src/lib/puzzleTypes";
import { calculateLaserPath } from "../../src/lib/laserEngine";
import { validateSequence } from "../../src/lib/validation";
import { grade, type GradeResult } from "./grader";
import { solveExactMin, countMinSolutions, type ExactMinResult } from "./exactMin";
import {
  GRID_MIN,
  GRID_MAX,
  MIN_EXACT_MIRRORS,
  BEST_OF_N,
  CRAFT_REUSE_WEIGHT,
  minCraft,
  SOLUTION_COUNT_CAP,
  RIGIDITY_WEIGHT,
  INVERSION_WEIGHT,
  COUNT_MIN_OPTIONS,
  EXACT_MIN_GEN_OPTIONS,
  rollParams,
  type GenParams,
} from "./config";
import { makeRng, type Rng } from "./rng";

/** Structural difficulty of a solution: how non-obvious the routing is. */
export interface Craft {
  /** Mirrors the beam strikes from ≥2 distinct directions (one placement, two roles). */
  reuse: number;
  /** Empty cells the beam passes through ≥2 times (self-crossings). */
  crossings: number;
  /** Weighted craft score (reuse·CRAFT_REUSE_WEIGHT + crossings). */
  score: number;
}

export interface GeneratedPuzzle {
  /** Puzzle without an id, the codegen step assigns ids. */
  puzzle: Omit<Puzzle, "id">;
  solution: MirrorPlacement[];
  params: GenParams;
  grade: GradeResult;
  /** Craft of the shipped MINIMAL solution (the player-facing difficulty signal). */
  craft: Craft;
  /** Distinct minimal solutions (capped), 1 is maximally rigid/forced. */
  solutions: number;
  /** Number pairs whose spatial order fights the source→flag flow (routing must weave). */
  inversions: number;
  /** Proven exact min (or lower bound) from the difficulty gate, reused by the
   * codegen step so the shipped daily records its minimum + HINT witness without
   * solving twice. */
  exact: ExactMinResult;
  seed: string;
  attempts: number;
}

const ATTEMPTS_PER_SIZE = 150;
/**
 * When a date's primary seed space yields nothing (unlucky size order + params),
 * retry with salted namespaces so the nightly job doesn't brick on one calendar
 * day. Each round reshuffles size order and attempt seeds. Round 0 is the
 * historical unsuffixed `dateKey` so already-shipped dailies stay reproducible.
 */
const MAX_SEED_ROUNDS = 8;

const DIRECTION_VECTORS: Record<Direction, { dx: number; dy: number }> = {
  right: { dx: 1, dy: 0 },
  left: { dx: -1, dy: 0 },
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
};

// Reflection map must match src/lib/laserEngine.ts exactly.
function reflect(direction: Direction, mirror: MirrorOrientation): Direction {
  const slash: Record<Direction, Direction> = {
    right: "up",
    up: "right",
    left: "down",
    down: "left",
  };
  const backslash: Record<Direction, Direction> = {
    right: "down",
    down: "right",
    left: "up",
    up: "left",
  };
  return (mirror === "/" ? slash : backslash)[direction];
}

const key = (x: number, y: number) => `${x},${y}`;

const PERPENDICULAR: Record<Direction, Direction[]> = {
  right: ["up", "down"],
  left: ["up", "down"],
  up: ["left", "right"],
  down: ["left", "right"],
};

/** The mirror orientation that turns `inDir` into `outDir`, or null if not a 90° turn. */
function orientationFor(inDir: Direction, outDir: Direction): MirrorOrientation | null {
  if (reflect(inDir, "/") === outDir) return "/";
  if (reflect(inDir, "\\") === outDir) return "\\";
  return null;
}

/**
 * Chance the source sits in the interior (like puzzle #8) rather than on an edge.
 * Raised above ½: an interior source must be routed on all four sides rather than
 * fired cleanly inward, a real difficulty jump.
 */
const SOURCE_INTERIOR_PROB = 0.65;

const ALL_DIRECTIONS: Direction[] = ["up", "down", "left", "right"];

function randomSource(rng: Rng, gridSize: number): SourceConfig {
  // Interior source: the beam must be routed in every direction around it, which
  // is a large difficulty jump over an edge source that only fires inward.
  if (rng.next() < SOURCE_INTERIOR_PROB) {
    return {
      x: rng.int(1, gridSize - 2),
      y: rng.int(1, gridSize - 2),
      direction: rng.pick(ALL_DIRECTIONS),
    };
  }

  const side = rng.pick(["top", "bottom", "left", "right"] as const);
  // Avoid corners so the beam has a clean run into the interior.
  const pos = rng.int(1, gridSize - 2);
  switch (side) {
    case "top":
      return { x: pos, y: 0, direction: "down" };
    case "bottom":
      return { x: pos, y: gridSize - 1, direction: "up" };
    case "left":
      return { x: 0, y: pos, direction: "right" };
    case "right":
      return { x: gridSize - 1, y: pos, direction: "left" };
  }
}

/** Step direction between two orthogonally-adjacent path cells. */
function stepDir(a: Position, b: Position): string {
  return `${Math.sign(b.x - a.x)},${Math.sign(b.y - a.y)}`;
}

/**
 * Choose a flag cell and ordered number-candidate cells from a (possibly
 * self-crossing) laser path.
 *
 * The flag terminates the beam, so only the PREFIX up to the flag matters. Within
 * that prefix we take cells visited exactly once, that are pass-through cells (not
 * mirrors/source) and not on the free bare-laser ray. Crucially we bucket them by
 * STRAIGHT RUN (a new run starts at every turn) and keep at most one per run, so
 * no single straight beam segment ever collects two code digits in a row. We keep
 * the flag whose prefix yields the most distinct runs (i.e. number slots).
 */
function selectFlagAndNumbers(
  visited: Position[],
  source: SourceConfig,
  mirrorKeys: Set<string>,
  excludeForNumbers: Set<string>
): { flag: Position; numbers: Position[] } | null {
  const sourceKey = key(source.x, source.y);

  const firstVisit = new Map<string, number>();
  visited.forEach((c, i) => {
    const k = key(c.x, c.y);
    if (!firstVisit.has(k)) firstVisit.set(k, i);
  });

  let best: { flag: Position; numbers: Position[] } | null = null;

  for (const [flagKey, fIdx] of firstVisit) {
    if (flagKey === sourceKey || mirrorKeys.has(flagKey) || fIdx < 2) continue;

    // Visit counts within the prefix [0..fIdx].
    const counts = new Map<string, number>();
    for (let i = 0; i <= fIdx; i++) {
      const k = key(visited[i].x, visited[i].y);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }

    // Straight-run id per prefix index: a run boundary is a change of direction.
    // One number per run guarantees a turn between consecutive collected digits.
    const runFirstEligible = new Map<number, Position>();
    let runId = 0;
    const seen = new Set<string>();
    for (let i = 1; i < fIdx; i++) {
      const turned = stepDir(visited[i - 1], visited[i]) !== stepDir(visited[i], visited[i + 1]);
      if (turned) runId++;
      const c = visited[i];
      const k = key(c.x, c.y);
      if (seen.has(k)) continue;
      seen.add(k);
      if (turned) continue; // this cell is a mirror (the beam turned here)
      if (k === sourceKey || mirrorKeys.has(k) || excludeForNumbers.has(k)) continue;
      if (counts.get(k) !== 1) continue;
      if (!runFirstEligible.has(runId)) runFirstEligible.set(runId, c);
    }

    const numbers = [...runFirstEligible.values()].sort(
      (a, b) => firstVisit.get(key(a.x, a.y))! - firstVisit.get(key(b.x, b.y))!
    );
    if (!best || numbers.length > best.numbers.length) {
      best = { flag: visited[fIdx], numbers };
    }
  }

  return best;
}

function pickDigits(rng: Rng, n: number): number[] {
  // Avoid a trivial all-same code (e.g. "1111") and a confusing leading zero.
  for (let attempt = 0; attempt < 50; attempt++) {
    const digits = Array.from({ length: n }, () => rng.int(0, 9));
    if (digits[0] !== 0 && new Set(digits).size >= 2) return digits;
  }
  return Array.from({ length: n }, (_, i) => (i % 9) + 1);
}

/** Canonical hash of the published puzzle content for duplicate detection. */
export function puzzleHash(puzzle: Omit<Puzzle, "id">): string {
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
    `s${puzzle.source.x},${puzzle.source.y},${puzzle.source.direction}`,
    `f${puzzle.flag.x},${puzzle.flag.y}`,
    `n${nums}`,
    `o${obs}`,
  ].join(";");
}

/** Probability of turning (placing a mirror) when both straight and turn are viable. */
const TURN_BIAS = 0.7;

// Reuse-seeking steer: when the walk turns, bias it toward directions that send the
// beam into an existing mirror (→ reuse) or a previously-visited cell (→ crossing),
// pulling the construction into compact, self-reusing shapes instead of a readable
// sweep. This puts genuine reuse in the constructed solution, which is what lets the
// craft ranking surface boards whose MINIMAL solution also needs it. Nearer targets
// weigh more (score divided by distance).
const STEER_LOOKAHEAD = 5;
const STEER_REUSE_WEIGHT = 6; // turn steers into an existing mirror → reuse
const STEER_CROSS_WEIGHT = 3; // turn steers into a visited empty cell → crossing
const STEER_BASE_WEIGHT = 1; // turn heads into fresh territory

interface Walk {
  visited: Position[];
  mirrors: Map<string, MirrorOrientation>;
}

/**
 * How strongly turning into `dir` from (x, y) steers the beam toward the raw material
 * of craft: scan ahead until the first already-decided cell or a wall. A mirror hit
 * (reuse) scores highest, a visited straight-through cell (crossing) next, fresh
 * territory lowest, all attenuated by distance.
 */
function steerWeight(
  x: number,
  y: number,
  dir: Direction,
  decisions: Map<string, MirrorOrientation | "S">,
  inBounds: (nx: number, ny: number) => boolean
): number {
  const v = DIRECTION_VECTORS[dir];
  let nx = x + v.dx;
  let ny = y + v.dy;
  for (let d = 1; d <= STEER_LOOKAHEAD; d++) {
    if (!inBounds(nx, ny)) break;
    const cell = decisions.get(key(nx, ny));
    if (cell !== undefined) {
      return (cell === "S" ? STEER_CROSS_WEIGHT : STEER_REUSE_WEIGHT) / d;
    }
    nx += v.dx;
    ny += v.dy;
  }
  return STEER_BASE_WEIGHT;
}

/**
 * Build the solution as a SELF-CROSSING laser walk from the source, on a fixed
 * (consistent) board so the real engine reproduces it exactly.
 *
 * At each fresh cell we decide once, go straight or turn 90° (a mirror), and
 * that decision is permanent. On revisits the cell's decision is FORCED: an empty
 * cell passes the beam straight (streams cross), a mirror cell turns it again
 * (the same mirror does double duty, mirror reuse). Near a wall, going straight
 * would exit, so the beam is forced to turn, wrapping it back across its own path.
 * This yields the crisscrossing, mirror-reusing solutions of the hard hand-made
 * puzzles rather than a single readable sweep.
 */
function buildWalk(
  rng: Rng,
  params: GenParams,
  source: SourceConfig,
  obstacleSet: Set<string>
): Walk {
  const { gridSize, targetMirrors } = params;
  const decisions = new Map<string, MirrorOrientation | "S">();
  const visited: Position[] = [];
  const sourceKey = key(source.x, source.y);
  const maxSteps = gridSize * gridSize * 3;

  let dir = source.direction;
  let x = source.x;
  let y = source.y;
  let mirrorCount = 0;

  const inBounds = (nx: number, ny: number) =>
    nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize && !obstacleSet.has(key(nx, ny));

  for (let step = 0; step < maxSteps; step++) {
    visited.push({ x, y });
    const k = key(x, y);
    let curDir = dir;

    if (k !== sourceKey) {
      const decision = decisions.get(k);
      if (decision === undefined) {
        // Fresh cell: choose straight or a turn, keeping the beam in bounds.
        const options: { dir: Direction; decision: MirrorOrientation | "S"; turn: boolean }[] = [
          { dir, decision: "S", turn: false },
          ...PERPENDICULAR[dir].map((nd) => ({
            dir: nd,
            decision: orientationFor(dir, nd)!,
            turn: true,
          })),
        ];
        const valid = options.filter((o) => {
          const v = DIRECTION_VECTORS[o.dir];
          return inBounds(x + v.dx, y + v.dy);
        });
        if (valid.length === 0) break;

        const turns = valid.filter((o) => o.turn);
        const straights = valid.filter((o) => !o.turn);
        const wantTurn = mirrorCount < targetMirrors && turns.length > 0;
        let chosen;
        if (wantTurn && (rng.next() < TURN_BIAS || straights.length === 0)) {
          // Choose the turn direction, weighted toward reuse/crossing rather than
          // uniformly, so the walk folds back onto itself and its mirrors.
          chosen = weightedSample(
            rng,
            turns.map((o) => ({
              item: o,
              weight: steerWeight(x, y, o.dir, decisions, inBounds),
            })),
            1
          )[0];
        } else if (straights.length > 0) chosen = rng.pick(straights);
        else chosen = rng.pick(valid);

        decisions.set(k, chosen.decision);
        if (chosen.turn) mirrorCount++;
        curDir = chosen.dir;
      } else if (decision !== "S") {
        curDir = reflect(dir, decision); // forced turn, mirror reuse
      }
    }

    const v = DIRECTION_VECTORS[curDir];
    const nx = x + v.dx;
    const ny = y + v.dy;
    if (!inBounds(nx, ny)) break; // beam exits at boundary/obstacle
    dir = curDir;
    x = nx;
    y = ny;
  }

  const mirrors = new Map<string, MirrorOrientation>();
  for (const [k, decision] of decisions) if (decision !== "S") mirrors.set(k, decision);
  return { visited, mirrors };
}

/**
 * Sample `count` items WITHOUT replacement, biased by weight (Efraimidis–Spirakis):
 * each item draws a key `rng^(1/weight)` and we keep the largest keys. Higher weight
 * → drawn earlier on average, but every positive-weight item stays reachable, so it
 * degrades gracefully to a plain shuffle when all weights are equal.
 */
function weightedSample<T>(
  rng: Rng,
  weighted: { item: T; weight: number }[],
  count: number
): T[] {
  return weighted
    .map(({ item, weight }) => ({
      item,
      sortKey: Math.pow(rng.next(), 1 / Math.max(weight, 1e-9)),
    }))
    .sort((a, b) => b.sortKey - a.sortKey)
    .slice(0, count)
    .map((k) => k.item);
}

/**
 * Craft of a solution as the player experiences it: replay the beam with `solution`
 * and count (a) mirrors struck from ≥2 distinct directions, a single placement doing
 * double duty, the hardest thing to see, and (b) empty cells the beam self-crosses.
 * A high score means the routing is interdependent and non-obvious; a flat sweep
 * scores ~0. Measured on the MINIMAL solution, not the dense construction scaffold.
 */
function measureCraft(puzzle: Puzzle, solution: MirrorPlacement[]): Craft {
  const res = calculateLaserPath(puzzle, solution);
  const mirrorKeys = new Set(solution.map((m) => key(m.x, m.y)));
  const cells = res.visitedCells;
  const hits = new Map<string, number>();
  const inDirs = new Map<string, Set<string>>();
  for (let i = 0; i < cells.length; i++) {
    const k = key(cells[i].x, cells[i].y);
    hits.set(k, (hits.get(k) ?? 0) + 1);
    if (i > 0) {
      const dir = stepDir(cells[i - 1], cells[i]);
      let set = inDirs.get(k);
      if (!set) inDirs.set(k, (set = new Set()));
      set.add(dir);
    }
  }
  let reuse = 0;
  let crossings = 0;
  for (const [k, count] of hits) {
    if (mirrorKeys.has(k)) {
      if ((inDirs.get(k)?.size ?? 0) >= 2) reuse++;
    } else if (count >= 2) {
      crossings++;
    }
  }
  return { reuse, crossings, score: reuse * CRAFT_REUSE_WEIGHT + crossings };
}

/**
 * Count number pairs whose spatial order (projected onto the source→flag axis) runs
 * opposite to their required collection order. High = the beam must weave back against
 * the natural flow to hit them in sequence, rather than sweep straight through.
 */
function orderingInversions(
  numbers: { x: number; y: number }[],
  source: SourceConfig,
  flag: Position
): number {
  let ax = flag.x - source.x;
  let ay = flag.y - source.y;
  if (ax === 0 && ay === 0) {
    // Degenerate axis: fall back to the source's firing direction.
    ax = DIRECTION_VECTORS[source.direction].dx;
    ay = DIRECTION_VECTORS[source.direction].dy;
  }
  const proj = numbers.map((n) => n.x * ax + n.y * ay);
  let inversions = 0;
  for (let i = 0; i < proj.length; i++) {
    for (let j = i + 1; j < proj.length; j++) {
      if (proj[j] < proj[i]) inversions++; // collected later but spatially earlier
    }
  }
  return inversions;
}

/** One construction attempt. Returns a graded candidate or null on any failure. */
function attempt(
  rng: Rng,
  gridSize: number
): {
  puzzle: Omit<Puzzle, "id">;
  solution: MirrorPlacement[];
  params: GenParams;
  grade: GradeResult;
  craft: Craft;
  solutions: number;
  inversions: number;
  exact: ExactMinResult;
} | null {
  const params = rollParams(rng, gridSize);
  const { codeLength, minMirrorCount } = params;

  const source = randomSource(rng, gridSize);

  // Build the crossing walk obstacle-free; obstacles are added afterwards on cells
  // the solution never touches, so they block shortcut solutions without altering
  // the intended path.
  const walk = buildWalk(rng, params, source, new Set());
  // The true minimum can only be ≤ the constructed length, so a construction below
  // the difficulty floor can never pass the exact-min gate, reject it here before
  // paying for flag/number selection or the solver. (This is also what makes small
  // grids self-reject: they can't build MIN_EXACT_MIRRORS mirrors.)
  if (walk.mirrors.size < Math.max(minMirrorCount, MIN_EXACT_MIRRORS)) return null;

  const solution: MirrorPlacement[] = [...walk.mirrors.entries()].map(([k, orientation]) => {
    const [x, y] = k.split(",").map(Number);
    return { x, y, orientation };
  });

  // Cells hit by the bare laser (no mirrors): the straight ray from the source to
  // the boundary. Numbers must avoid these so nothing is collected for free.
  const bareRay = new Set<string>();
  {
    const v = DIRECTION_VECTORS[source.direction];
    let rx = source.x;
    let ry = source.y;
    while (rx >= 0 && rx < gridSize && ry >= 0 && ry < gridSize) {
      bareRay.add(key(rx, ry));
      rx += v.dx;
      ry += v.dy;
    }
  }

  const mirrorKeys = new Set(walk.mirrors.keys());
  const selection = selectFlagAndNumbers(walk.visited, source, mirrorKeys, bareRay);
  if (!selection || selection.numbers.length < codeLength) {
    return null; // not enough clean slots for the code
  }
  const { flag } = selection;

  // Spread the code numbers evenly across the available runs, in collection order.
  const slots = selection.numbers;
  const chosen: Position[] = [];
  for (let i = 0; i < codeLength; i++) {
    chosen.push(slots[Math.floor((i * slots.length) / codeLength)]);
  }

  const digits = pickDigits(rng, codeLength);
  const numbers = chosen.map((c, i) => ({ value: digits[i], x: c.x, y: c.y }));
  const code = digits.join("");

  // Obstacles on cells the solution path never visits. Rather than scatter them
  // uniformly (where most land inertly in dead corners), we weight each candidate
  // by how tightly it hugs the solution beam: a free cell wedged against the path
  // is exactly where a cheaper, lower-mirror alternative routing would try to cut
  // through, so blocking it raises the proven exact minimum measured by the gate
  // below. Cells with no path neighbor do nothing for difficulty and are kept only
  // as a low-weight fallback. Obstacles never sit on the path itself, so the
  // intended solution is unaffected (and is re-verified against the real engine).
  const visitedKeys = new Set(walk.visited.map((c) => key(c.x, c.y)));
  const freeCells: { item: Position; weight: number }[] = [];
  for (let gx = 0; gx < gridSize; gx++) {
    for (let gy = 0; gy < gridSize; gy++) {
      if (visitedKeys.has(key(gx, gy))) continue;
      let pathNeighbors = 0;
      for (const { dx, dy } of Object.values(DIRECTION_VECTORS)) {
        if (visitedKeys.has(key(gx + dx, gy + dy))) pathNeighbors++;
      }
      // Strong preference for path-adjacent cells; the +0.2 floor keeps isolated
      // cells eligible when there aren't enough good candidates.
      freeCells.push({ item: { x: gx, y: gy }, weight: pathNeighbors * 3 + 0.2 });
    }
  }
  const obstacles = weightedSample(rng, freeCells, params.obstacleCount);

  const puzzle: Omit<Puzzle, "id"> = {
    code,
    gridSize,
    source,
    flag: { x: flag.x, y: flag.y },
    numbers,
    obstacles,
  };
  const full: Puzzle = { id: 0, ...puzzle };

  // (1) Assert solvability with the REAL engine (source of truth).
  const solved = calculateLaserPath(full, solution);
  if (!validateSequence(code, solved).isComplete) return null; // constructed solution didn't validate

  // (2) The bare laser (no mirrors) must not collect any code number, every
  // digit has to be earned by routing, never handed to the player for free.
  if (calculateLaserPath(full, []).collectedNumbers.length > 0) return null; // a digit is collected for free

  // (2b) Require "creative" complexity: cells the solution beam passes through
  // more than once (mirror reuse or a self-crossing). Bigger grids must have more.
  {
    const visitCount = new Map<string, number>();
    for (const c of solved.visitedCells) {
      const k = key(c.x, c.y);
      visitCount.set(k, (visitCount.get(k) ?? 0) + 1);
    }
    let complexity = 0;
    for (const count of visitCount.values()) if (count > 1) complexity++;
    const required = gridSize >= 8 ? 2 : gridSize >= 5 ? 1 : 0;
    if (complexity < required) return null;
  }

  // (3) Anti-triviality (cheap pre-filter): reject if a solution CHEAPER than the
  // intended dense one exists within the naive solver's affordable cap. On large
  // grids this cap is tiny (~3), so it only catches the most trivial shortcuts -
  // the real difficulty gate is (4) below.
  const g = grade(full, {
    fallbackSolution: solution,
    maxMirrors: solution.length - 1,
  });
  if (g.solvableWithinCap) return null; // a cheaper shortcut exists → too easy

  // (4) Difficulty gate: the exact minimum must be PROVEN (a witness exists) and meet
  // the floor. We require a proven witness, not just a node-capped lower bound -
  // because craft (gate 5) can only be measured on the minimal solution the player
  // actually finds. A node-capped board is genuinely hard but craft-unmeasurable, so
  // we drop it and let generation fall back to a size whose minimum we can prove
  // (which also tend to be the fast, high-craft 7×7/8×8 boards). A cheap board is
  // proven-and-rejected quickly; only genuinely hard boards pay the full solve.
  const exact = solveExactMin(full, EXACT_MIN_GEN_OPTIONS);
  if (exact.minMirrors === undefined) return null; // no proven witness → craft unmeasurable
  if (exact.minMirrors < MIN_EXACT_MIRRORS) return null; // too easy

  // (5) Craft gate: score the MINIMAL solution's non-obviousness (mirror reuse +
  // beam crossings). A dense-but-readable sweep is rejected here even though it has
  // enough mirrors. Only proven candidates carry a witness we can measure; a rare
  // node-capped board has no witness, so it skips this gate (craft 0) and best-of-N
  // ranking parks it below any crafty proven board.
  const craft = exact.solution
    ? measureCraft(full, exact.solution)
    : { reuse: 0, crossings: 0, score: 0 };
  if (exact.solution && craft.score < minCraft(gridSize)) return null; // solution too obvious

  // (6) Rigidity: count minimal solutions (capped). Fewer = every mirror more forced.
  // Folded into the difficulty ranking (not gated) so it never causes a generation
  // failure, it just makes best-of-N prefer the more rigid of otherwise-similar boards.
  // An aborted enumeration (unknown) is treated as the cap (least rigid), so we never
  // over-credit a board we couldn't verify.
  const counted = countMinSolutions(full, exact.minMirrors!, SOLUTION_COUNT_CAP, COUNT_MIN_OPTIONS.nodeCap);
  const solutions = counted.aborted ? SOLUTION_COUNT_CAP : counted.count;

  // (7) Ordering inversions: how much the number layout fights the source→flag flow.
  const inversions = orderingInversions(numbers, source, flag);

  return {
    puzzle,
    solution,
    params,
    grade: g,
    craft,
    solutions,
    inversions,
    exact,
  };
}

/** All grid sizes, deterministically ordered per date so the preferred size is
 * uniform across dates but any infeasible size falls back to another. */
function sizeOrderForDate(dateKey: string): number[] {
  const sizes: number[] = [];
  for (let g = GRID_MIN; g <= GRID_MAX; g++) sizes.push(g);
  return makeRng(`${dateKey}:size`).shuffle(sizes);
}

/** Proven exact minimum (or its lower bound). */
function provenMinOf(g: { exact: ExactMinResult }): number {
  return g.exact.minMirrors ?? g.exact.minMirrorsAtLeast ?? 0;
}

/**
 * Composite difficulty: craft (non-obvious path) plus rigidity (few solutions forces
 * every placement). `SOLUTION_COUNT_CAP − solutions` rewards near-unique boards, so a
 * uniquely-solvable board outranks an equally-crafty one with many solutions.
 */
function difficultyScore(g: GeneratedPuzzle): number {
  return (
    g.craft.score +
    RIGIDITY_WEIGHT * (SOLUTION_COUNT_CAP - g.solutions) +
    INVERSION_WEIGHT * g.inversions
  );
}

/**
 * Rank two passing candidates hardest-first by the composite difficulty score (craft +
 * rigidity). Ties fall back to raw craft, proven exact min, then a proven witness
 * (HINT support day one), the grader score, and finally seed order for determinism.
 */
function harderFirst(a: GeneratedPuzzle, b: GeneratedPuzzle): number {
  const byDifficulty = difficultyScore(b) - difficultyScore(a);
  if (byDifficulty !== 0) return byDifficulty;
  const byCraft = b.craft.score - a.craft.score;
  if (byCraft !== 0) return byCraft;
  const byMin = provenMinOf(b) - provenMinOf(a);
  if (byMin !== 0) return byMin;
  const aProven = a.exact.minMirrors !== undefined ? 1 : 0;
  const bProven = b.exact.minMirrors !== undefined ? 1 : 0;
  if (aProven !== bProven) return bProven - aProven;
  const byScore = b.grade.score - a.grade.score;
  if (byScore !== 0) return byScore;
  return a.seed < b.seed ? -1 : a.seed > b.seed ? 1 : 0;
}

/**
 * Generate one extra-hard puzzle for a date. Deterministic given `dateKey`.
 * Grid size is chosen per date (uniform), falling back through other sizes only
 * if the preferred size can't produce a valid puzzle. `existingHashes` prevents
 * duplicates against already-published puzzles.
 *
 * Best-of-N: within the first size that yields any valid board, keep going until
 * BEST_OF_N candidates clear the floor (or the attempt budget runs out), then ship
 * the hardest by proven exact min, not merely the first one over the floor.
 *
 * If every size fails in the primary seed space, salted rounds (`dateKey#rN`)
 * reshuffle params so a single unlucky date can't stall the buffer forever.
 */
export function generatePuzzle(
  dateKey: string,
  existingHashes: Set<string>
): GeneratedPuzzle | null {
  let totalAttempts = 0;
  for (let round = 0; round < MAX_SEED_ROUNDS; round++) {
    const seedKey = round === 0 ? dateKey : `${dateKey}#r${round}`;
    for (const gridSize of sizeOrderForDate(seedKey)) {
      const passing: GeneratedPuzzle[] = [];
      for (let a = 1; a <= ATTEMPTS_PER_SIZE; a++) {
        totalAttempts++;
        const seed = `${seedKey}:${gridSize}:${a}`;
        const candidate = attempt(makeRng(seed), gridSize);
        if (!candidate) continue;
        if (existingHashes.has(puzzleHash(candidate.puzzle))) continue;
        passing.push({ ...candidate, seed, attempts: totalAttempts });
        if (passing.length >= BEST_OF_N) break;
      }
      if (passing.length > 0) {
        passing.sort(harderFirst);
        return passing[0];
      }
    }
  }
  return null;
}

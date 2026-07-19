/**
 * Reverse puzzle generation, tuned for "extra hard": build a mirror-dense
 * solution first, then delete the mirrors.
 *
 * Because the engine is deterministic, any puzzle produced this way is provably
 * solvable with the generator's own mirror set — we then verify with the REAL
 * engine + win check, enforce the hardness constraints, and grade with the
 * min-mirror solver.
 *
 * The solution is built as a self-avoiding laser walk (see buildWalk), placing a
 * mirror at each turn. Final solvability is always asserted against the real
 * engine (src/lib/laserEngine.ts) — never the construction scaffold.
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
import { solveExactMin, type ExactMinResult } from "./exactMin";
import {
  GRID_MIN,
  GRID_MAX,
  MIN_EXACT_MIRRORS,
  EXACT_MIN_GEN_OPTIONS,
  rollParams,
  type GenParams,
} from "./config";
import { makeRng, type Rng } from "./rng";

export interface GeneratedPuzzle {
  /** Puzzle without an id — the codegen step assigns ids. */
  puzzle: Omit<Puzzle, "id">;
  solution: MirrorPlacement[];
  params: GenParams;
  grade: GradeResult;
  /** Proven exact min (or lower bound) from the difficulty gate — reused by the
   * codegen step so the shipped daily records its minimum + HINT witness without
   * solving twice. */
  exact: ExactMinResult;
  seed: string;
  attempts: number;
}

const ATTEMPTS_PER_SIZE = 150;

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

/** Chance the source sits in the interior (like puzzle #8) rather than on an edge. */
const SOURCE_INTERIOR_PROB = 0.5;

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
 * STRAIGHT RUN (a new run starts at every turn) and keep at most one per run — so
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

interface Walk {
  visited: Position[];
  mirrors: Map<string, MirrorOrientation>;
}

/**
 * Build the solution as a SELF-CROSSING laser walk from the source, on a fixed
 * (consistent) board so the real engine reproduces it exactly.
 *
 * At each fresh cell we decide once — go straight or turn 90° (a mirror) — and
 * that decision is permanent. On revisits the cell's decision is FORCED: an empty
 * cell passes the beam straight (streams cross), a mirror cell turns it again
 * (the same mirror does double duty — mirror reuse). Near a wall, going straight
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
        if (wantTurn && (rng.next() < TURN_BIAS || straights.length === 0)) chosen = rng.pick(turns);
        else if (straights.length > 0) chosen = rng.pick(straights);
        else chosen = rng.pick(valid);

        decisions.set(k, chosen.decision);
        if (chosen.turn) mirrorCount++;
        curDir = chosen.dir;
      } else if (decision !== "S") {
        curDir = reflect(dir, decision); // forced turn — mirror reuse
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

/** One construction attempt. Returns a graded candidate or null on any failure. */
function attempt(
  rng: Rng,
  gridSize: number
): {
  puzzle: Omit<Puzzle, "id">;
  solution: MirrorPlacement[];
  params: GenParams;
  grade: GradeResult;
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
  // the difficulty floor can never pass the exact-min gate — reject it here before
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

  // Obstacles on cells the solution path never visits.
  const visitedKeys = new Set(walk.visited.map((c) => key(c.x, c.y)));
  const freeCells: Position[] = [];
  for (let gx = 0; gx < gridSize; gx++) {
    for (let gy = 0; gy < gridSize; gy++) {
      if (!visitedKeys.has(key(gx, gy))) freeCells.push({ x: gx, y: gy });
    }
  }
  const obstacles = rng.shuffle(freeCells).slice(0, params.obstacleCount);

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

  // (2) The bare laser (no mirrors) must not collect any code number — every
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
  // grids this cap is tiny (~3), so it only catches the most trivial shortcuts —
  // the real difficulty gate is (4) below.
  const g = grade(full, {
    fallbackSolution: solution,
    maxMirrors: solution.length - 1,
  });
  if (g.solvableWithinCap) return null; // a cheaper shortcut exists → too easy

  // (4) Difficulty gate: the PROVEN exact minimum must meet the floor. This is the
  // only reliable difficulty signal (constructed density is decorative — see
  // MIN_EXACT_MIRRORS). A board with a cheap true solution is proven and rejected
  // quickly; only genuinely hard boards pay the full solve. When the solver
  // node-caps without a witness we accept only if it already PROVED a ≥-floor lower
  // bound, and reject the ambiguous middle (conservative — the nightly solver would
  // refine it, but we won't ship a daily we can't vouch for as hard).
  const exact = solveExactMin(full, EXACT_MIN_GEN_OPTIONS);
  const provenMin = exact.minMirrors ?? exact.minMirrorsAtLeast ?? 0;
  if (provenMin < MIN_EXACT_MIRRORS) return null; // too easy, or not provably hard enough

  return { puzzle, solution, params, grade: g, exact };
}

/** All grid sizes, deterministically ordered per date so the preferred size is
 * uniform across dates but any infeasible size falls back to another. */
function sizeOrderForDate(dateKey: string): number[] {
  const sizes: number[] = [];
  for (let g = GRID_MIN; g <= GRID_MAX; g++) sizes.push(g);
  return makeRng(`${dateKey}:size`).shuffle(sizes);
}

/**
 * Generate one extra-hard puzzle for a date. Deterministic given `dateKey`.
 * Grid size is chosen per date (uniform), falling back through other sizes only
 * if the preferred size can't produce a valid puzzle. `existingHashes` prevents
 * duplicates against already-published puzzles.
 */
export function generatePuzzle(
  dateKey: string,
  existingHashes: Set<string>
): GeneratedPuzzle | null {
  let totalAttempts = 0;
  for (const gridSize of sizeOrderForDate(dateKey)) {
    for (let a = 1; a <= ATTEMPTS_PER_SIZE; a++) {
      totalAttempts++;
      const seed = `${dateKey}:${gridSize}:${a}`;
      const candidate = attempt(makeRng(seed), gridSize);
      if (!candidate) continue;
      if (existingHashes.has(puzzleHash(candidate.puzzle))) continue;
      return { ...candidate, seed, attempts: totalAttempts };
    }
  }
  return null;
}

import { PUZZLES } from "../src/data/puzzles";
import { PUZZLE_SCHEDULE } from "../src/data/schedule";
import { buildPuzzleEmojiGrid, getShareText } from "../src/lib/shareText";
import { getPuzzleStats } from "../src/lib/puzzleStats";
import { productionSiteUrl } from "../src/lib/site";
import type { Puzzle } from "../src/lib/puzzleTypes";

const CELL_EMPTY = "🔳";
const CELL_OBSTACLE = "⬜";
const CELL_SOURCE = "⭕";
const CELL_FLAG = "🏳️";

function splitGridRow(row: string): string[] {
  return [...new Intl.Segmenter().segment(row)].map((part) => part.segment);
}

function countEmoji(text: string, emoji: string): number {
  let count = 0;
  let index = 0;
  while ((index = text.indexOf(emoji, index)) !== -1) {
    count += 1;
    index += emoji.length;
  }
  return count;
}

function posKey(x: number, y: number): string {
  return `${x},${y}`;
}

function verifyPuzzle(puzzle: Puzzle): string[] {
  const issues: string[] = [];
  const gridStr = buildPuzzleEmojiGrid(puzzle);
  const rows = gridStr.split("\n");

  if (rows.length !== puzzle.gridSize) {
    issues.push(`grid rows ${rows.length} !== gridSize ${puzzle.gridSize}`);
  }

  for (let y = 0; y < rows.length; y++) {
    const chars = splitGridRow(rows[y]);
    if (chars.length !== puzzle.gridSize) {
      issues.push(`row ${y} length ${chars.length} !== ${puzzle.gridSize}`);
    }
  }

  if (countEmoji(gridStr, CELL_SOURCE) !== 1) {
    issues.push("expected exactly 1 source (⭕)");
  }
  if (countEmoji(gridStr, CELL_FLAG) !== 1) {
    issues.push("expected exactly 1 flag (🏳️)");
  }
  if (countEmoji(gridStr, CELL_OBSTACLE) !== puzzle.obstacles.length) {
    issues.push(
      `expected ${puzzle.obstacles.length} obstacles (⬜), got ${countEmoji(gridStr, CELL_OBSTACLE)}`
    );
  }

  for (let y = 0; y < puzzle.gridSize; y++) {
    const chars = splitGridRow(rows[y]);
    for (let x = 0; x < puzzle.gridSize; x++) {
      const cell = chars[x];
      const isSource = puzzle.source.x === x && puzzle.source.y === y;
      const isFlag = puzzle.flag.x === x && puzzle.flag.y === y;
      const isObstacle = puzzle.obstacles.some((o) => o.x === x && o.y === y);

      if (isSource && cell !== CELL_SOURCE) {
        issues.push(`source at (${x},${y}) renders as ${cell ?? "missing"}`);
      }
      if (isFlag && cell !== CELL_FLAG) {
        issues.push(`flag at (${x},${y}) renders as ${cell ?? "missing"}`);
      }
      if (isObstacle && !isSource && !isFlag && cell !== CELL_OBSTACLE) {
        issues.push(`obstacle at (${x},${y}) renders as ${cell ?? "missing"}`);
      }
      if (!isSource && !isFlag && !isObstacle && cell !== CELL_EMPTY) {
        issues.push(`empty at (${x},${y}) renders as ${cell ?? "missing"}`);
      }
    }
  }

  const sourceKey = posKey(puzzle.source.x, puzzle.source.y);
  const flagKey = posKey(puzzle.flag.x, puzzle.flag.y);
  if (sourceKey === flagKey) {
    issues.push("puzzle data: source and flag share a cell");
  }

  for (const obstacle of puzzle.obstacles) {
    const key = posKey(obstacle.x, obstacle.y);
    if (key === sourceKey) {
      issues.push("puzzle data: obstacle overlaps source");
    }
    if (key === flagKey) {
      issues.push("puzzle data: obstacle overlaps flag");
    }
  }

  for (const number of puzzle.numbers) {
    const key = posKey(number.x, number.y);
    if (key === sourceKey) {
      issues.push("puzzle data: number overlaps source");
    }
    if (key === flagKey) {
      issues.push("puzzle data: number overlaps flag");
    }
  }

  // Fixed-size scorecard share text: 7 lines (header, blank, 3 meters, blank,
  // URL), no emoji grid. Simulate a realistic solve: 2 mirrors above the proven
  // minimum, 90 seconds, 1 misroute.
  const minMirrors = getPuzzleStats(puzzle.id).minMirrors;
  const mirrorsUsed = (minMirrors ?? 3) + 2;
  const share = getShareText(puzzle.id, 90, mirrorsUsed, 1);
  const lines = share.split("\n");
  const paddedId = String(puzzle.id).padStart(3, "0");

  if (lines.length !== 7) {
    issues.push(`share text expected 7 lines, got ${lines.length}`);
  }
  if (lines[0] !== `Lattice #${paddedId} · ${puzzle.gridSize}×${puzzle.gridSize}`) {
    issues.push(`share text header wrong: ${JSON.stringify(lines[0])}`);
  }
  if (lines[1] !== "" || lines[5] !== "") {
    issues.push("share text lines 2 and 6 should be blank separators");
  }

  // Each meter row: padded label, exactly five dots, then a detail.
  const meters: Array<[line: string | undefined, label: string]> = [
    [lines[2], "Efficiency"],
    [lines[3], "Speed"],
    [lines[4], "Accuracy"],
  ];
  for (const [line, label] of meters) {
    if (!line?.startsWith(label)) {
      issues.push(`expected a ${label} meter, got ${JSON.stringify(line)}`);
      continue;
    }
    const filled = countEmoji(line, "🔴");
    const empty = countEmoji(line, "⚫");
    if (filled + empty !== 5 || filled < 1) {
      issues.push(`${label} meter should have 5 dots (≥1 filled): ${JSON.stringify(line)}`);
    }
  }

  // Details: +2 mirrors above the known minimum, m:ss time, 1 misroute = 5/5.
  if (minMirrors !== undefined && !lines[2]?.endsWith("+2 Mirrors Above Optimal")) {
    issues.push(`efficiency detail wrong: ${JSON.stringify(lines[2])}`);
  }
  if (!lines[3]?.endsWith("1:30")) {
    issues.push(`speed detail wrong: ${JSON.stringify(lines[3])}`);
  }
  if (!lines[4]?.endsWith("1 Mistake") || countEmoji(lines[4] ?? "", "🔴") !== 5) {
    issues.push(`accuracy detail wrong (1 misroute should be 5/5 + "1 Mistake"): ${JSON.stringify(lines[4])}`);
  }
  if (lines[6] !== productionSiteUrl) {
    issues.push(`share text url wrong: ${JSON.stringify(lines[6])}`);
  }
  for (const emoji of [CELL_EMPTY, CELL_OBSTACLE, CELL_SOURCE, CELL_FLAG]) {
    if (share.includes(emoji)) {
      issues.push("share text should not contain the emoji grid");
      break;
    }
  }

  return issues;
}

let failed = 0;

console.log("=== ALL REGISTERED PUZZLES ===");
for (const puzzle of PUZZLES) {
  const issues = verifyPuzzle(puzzle);
  if (issues.length > 0) {
    failed += 1;
    console.log(`#${puzzle.id} FAIL:`, issues);
  } else {
    console.log(
      `#${puzzle.id} OK (${puzzle.gridSize}x${puzzle.gridSize}, ⭕@(${puzzle.source.x},${puzzle.source.y}), 🏳️@(${puzzle.flag.x},${puzzle.flag.y}), ${puzzle.obstacles.length}⬜)`
    );
  }
}

console.log("\n=== SCHEDULED DAILY PUZZLES ===");
const scheduledIds = [...new Set(Object.values(PUZZLE_SCHEDULE))].sort(
  (a, b) => a - b
);
for (const id of scheduledIds) {
  const puzzle = PUZZLES.find((entry) => entry.id === id);
  if (!puzzle) {
    failed += 1;
    console.log(`#${id} NOT IN REGISTRY`);
    continue;
  }

  const issues = verifyPuzzle(puzzle);
  if (issues.length > 0) {
    failed += 1;
    console.log(`#${id} SCHEDULED FAIL:`, issues);
  }
}

if (failed > 0) {
  console.log(`\n${failed} puzzle(s) failed share verification`);
  process.exit(1);
}

console.log("\nAll puzzles passed share verification");

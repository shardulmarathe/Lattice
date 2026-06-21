import type {
  BoardCell,
  Direction,
  LaserResult,
  LaserSegment,
  MirrorOrientation,
  MirrorPlacement,
  Position,
  Puzzle,
} from "./puzzleTypes";

const DIRECTION_VECTORS: Record<Direction, { dx: number; dy: number }> = {
  right: { dx: 1, dy: 0 },
  left: { dx: -1, dy: 0 },
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
};


function reflectDirection(
  direction: Direction,
  mirror: MirrorOrientation
): Direction {
  if (mirror === "/") {
    const map: Record<Direction, Direction> = {
      right: "up",
      up: "right",
      left: "down",
      down: "left",
    };
    return map[direction];
  }
  const map: Record<Direction, Direction> = {
    right: "down",
    down: "right",
    left: "up",
    up: "left",
  };
  return map[direction];
}

export function buildBoard(
  puzzle: Puzzle,
  mirrors: MirrorPlacement[]
): BoardCell[][] {
  const { gridSize } = puzzle;
  const board: BoardCell[][] = Array.from({ length: gridSize }, () =>
    Array.from({ length: gridSize }, () => ({ type: "empty" as const }))
  );

  for (const obs of puzzle.obstacles) {
    board[obs.y][obs.x] = { type: "obstacle" };
  }

  for (const num of puzzle.numbers) {
    board[num.y][num.x] = { type: "number", number: num.value };
  }

  board[puzzle.source.y][puzzle.source.x] = {
    type: "source",
    sourceDirection: puzzle.source.direction,
  };

  board[puzzle.flag.y][puzzle.flag.x] = { type: "flag" };

  for (const mirror of mirrors) {
    const cell = board[mirror.y]?.[mirror.x];
    if (cell?.type === "empty") {
      board[mirror.y][mirror.x] = {
        type: "mirror",
        mirror: mirror.orientation,
      };
    }
  }

  return board;
}

export function calculateLaserPath(
  puzzle: Puzzle,
  mirrors: MirrorPlacement[]
): LaserResult {
  const board = buildBoard(puzzle, mirrors);
  const { gridSize } = puzzle;
  const segments: LaserSegment[] = [];
  const visitedCells: Position[] = [];
  const collectedNumbers: number[] = [];

  let x = puzzle.source.x;
  let y = puzzle.source.y;
  let direction = puzzle.source.direction;
  let reachedFlag = false;
  let terminatedBy: LaserResult["terminatedBy"] = null;

  const maxSteps = gridSize * gridSize * 4;
  let steps = 0;

  while (steps < maxSteps) {
    steps++;
    visitedCells.push({ x, y });

    const cell = board[y][x];

    if (cell.type === "number" && cell.number !== undefined) {
      collectedNumbers.push(cell.number);
    }

    if (cell.type === "flag") {
      reachedFlag = true;
      terminatedBy = "flag";
      break;
    }

    if (cell.type === "mirror" && cell.mirror) {
      direction = reflectDirection(direction, cell.mirror);
    }

    const { dx, dy } = DIRECTION_VECTORS[direction];
    const nextX = x + dx;
    const nextY = y + dy;

    if (
      nextX < 0 ||
      nextX >= gridSize ||
      nextY < 0 ||
      nextY >= gridSize
    ) {
      segments.push({
        from: { x, y },
        to: { x: x + dx * 0.5, y: y + dy * 0.5 },
      });
      terminatedBy = "boundary";
      break;
    }

    const nextCell = board[nextY][nextX];
    if (nextCell.type === "obstacle") {
      segments.push({
        from: { x, y },
        to: { x: x + dx * 0.5, y: y + dy * 0.5 },
      });
      terminatedBy = "obstacle";
      break;
    }

    segments.push({
      from: { x, y },
      to: { x: nextX, y: nextY },
    });

    x = nextX;
    y = nextY;
  }

  return {
    segments,
    visitedCells,
    collectedNumbers,
    reachedFlag,
    terminatedBy,
  };
}

export function canPlaceMirror(
  puzzle: Puzzle,
  mirrors: MirrorPlacement[],
  x: number,
  y: number
): boolean {
  const board = buildBoard(puzzle, mirrors);
  const cell = board[y]?.[x];
  return cell?.type === "empty";
}

export function getMirrorAt(
  mirrors: MirrorPlacement[],
  x: number,
  y: number
): MirrorOrientation | null {
  const mirror = mirrors.find((m) => m.x === x && m.y === y);
  return mirror?.orientation ?? null;
}

export function cycleMirrorOrientation(
  current: MirrorOrientation | null
): MirrorOrientation | null {
  if (current === null) return "/";
  if (current === "/") return "\\";
  return null;
}

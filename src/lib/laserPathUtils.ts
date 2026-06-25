import type {
  BoardCell,
  LaserSegment,
  MirrorOrientation,
  Position,
} from "@/lib/puzzleTypes";

/** Larger pad = shorter mirror bar inside the cell. */
export const MIRROR_PAD_RATIO = 0.14;
export const MIRROR_FACE_STROKE_RATIO = 0.042;
export const MIRROR_GLOW_STROKE_RATIO = 0.07;

export interface MirrorContact {
  incomingFrom: Position;
  outgoingTo: Position;
}

export interface PathPoint {
  x: number;
  y: number;
}

export interface ContinuousPath {
  points: PathPoint[];
  segmentLengths: number[];
  totalLength: number;
}

export function mirrorCellKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function buildMirrorContactMap(
  segments: LaserSegment[]
): Map<string, MirrorContact> {
  const map = new Map<string, MirrorContact>();

  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    const next = segments[i + 1];
    if (
      Number.isInteger(seg.to.x) &&
      Number.isInteger(seg.to.y) &&
      seg.to.x === next.from.x &&
      seg.to.y === next.from.y
    ) {
      map.set(mirrorCellKey(seg.to.x, seg.to.y), {
        incomingFrom: seg.from,
        outgoingTo: next.to,
      });
    }
  }

  return map;
}

function getGridDirection(
  from: Position,
  to: Position
): { dx: number; dy: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) return { dx: 0, dy: 0 };
  return { dx: Math.sign(dx), dy: Math.sign(dy) };
}

/**
 * Mirror shift by incoming direction + mirror orientation.
 * Incoming direction = travel into the mirror cell (prev cell → mirror).
 */
export function getMirrorVisualOffset(
  contact: MirrorContact,
  mirrorCell: Position,
  cellSize: number,
  orientation: MirrorOrientation
): PathPoint {
  const incomingDir = getGridDirection(contact.incomingFrom, mirrorCell);

  // Locked: from the east (beam travels left), \ mirror (y = -x)
  if (incomingDir.dx < 0 && orientation === "\\") {
    return { x: -1.9, y: 1.9 };
  }

  // Locked: from the east (beam travels left), / mirror (y = x)
  if (incomingDir.dx < 0 && orientation === "/") {
    return { x: -3.35, y: -3.35 };
  }

  // Locked: from the south (beam travels up), / mirror (y = x) — left + up
  if (incomingDir.dy < 0 && orientation === "/") {
    return { x: -3.35, y: -3.35 };
  }

  // Locked: from the south (beam travels up), \ mirror (y = -x) — right + up
  if (incomingDir.dy < 0 && orientation === "\\") {
    return { x: 1.9, y: -1.9 };
  }

  // Locked: from the west (beam travels right), \ mirror (y = -x) — right + up
  if (incomingDir.dx > 0 && orientation === "\\") {
    return { x: 1.9, y: -1.9 };
  }

  // Locked: from the west (beam travels right), / mirror (y = x) — right + down
  if (incomingDir.dx > 0 && orientation === "/") {
    return { x: 1.65, y: 1.65 };
  }

  // Locked: from the north (beam travels down), / mirror (y = x) — right + down
  if (incomingDir.dy > 0 && orientation === "/") {
    return { x: 1.3, y: 1.3 };
  }

  // From the north (beam travels down), \ mirror (y = -x) — left + up
  if (incomingDir.dy > 0 && orientation === "\\") {
    return { x: -2.9, y: -0.1 };
  }

  return { x: 0, y: 0 };
}

/** Full mirror bar centered in the cell. */
export function getMirrorLineInCell(
  size: number,
  orientation: MirrorOrientation
): { x1: number; y1: number; x2: number; y2: number } {
  const inset = size * MIRROR_PAD_RATIO;
  const center = size / 2;
  const arm = size / 2 - inset;

  if (orientation === "/") {
    return {
      x1: center - arm,
      y1: center + arm,
      x2: center + arm,
      y2: center - arm,
    };
  }

  return {
    x1: center - arm,
    y1: center - arm,
    x2: center + arm,
    y2: center + arm,
  };
}

export function toPixel(
  x: number,
  y: number,
  cellSize: number
): PathPoint {
  return {
    x: x * cellSize + cellSize / 2,
    y: y * cellSize + cellSize / 2,
  };
}

/** Laser always follows cell centers — no mirror clipping. */
export function segmentToPixels(
  segment: LaserSegment,
  cellSize: number
): { from: PathPoint; to: PathPoint } {
  return {
    from: toPixel(segment.from.x, segment.from.y, cellSize),
    to: toPixel(segment.to.x, segment.to.y, cellSize),
  };
}

/** Orbit radius for the victory ring around the flag icon. */
export const FLAG_ORBIT_RADIUS_RATIO = 0.34;

export function getFlagVisualCenter(
  flagX: number,
  flagY: number,
  cellSize: number
): PathPoint {
  const cellCenter = toPixel(flagX, flagY, cellSize);
  const flagSize = cellSize * 0.5;
  const viewBoxCenter = 12;
  const visualCenterX = 9;
  const visualCenterY = 12;
  const offsetX = ((visualCenterX - viewBoxCenter) / 24) * flagSize;
  const offsetY = ((visualCenterY - viewBoxCenter) / 24) * flagSize;

  return {
    x: cellCenter.x + offsetX,
    y: cellCenter.y + offsetY,
  };
}

function shortenLastSegmentToFlagOrbit(
  from: PathPoint,
  to: PathPoint,
  flagPosition: Position,
  cellSize: number
): PathPoint {
  const flagCenter = getFlagVisualCenter(
    flagPosition.x,
    flagPosition.y,
    cellSize
  );
  const orbitRadius = cellSize * FLAG_ORBIT_RADIUS_RATIO;
  const dx = flagCenter.x - from.x;
  const dy = flagCenter.y - from.y;
  const mag = Math.hypot(dx, dy) || 1;
  return {
    x: flagCenter.x - (dx / mag) * orbitRadius,
    y: flagCenter.y - (dy / mag) * orbitRadius,
  };
}

export function buildVictoryLinearPath(
  segments: LaserSegment[],
  cellSize: number,
  flagPosition: Position
): ContinuousPath {
  if (segments.length === 0) {
    return { points: [], segmentLengths: [], totalLength: 0 };
  }

  const points: PathPoint[] = [];
  const segmentLengths: number[] = [];

  for (let i = 0; i < segments.length; i++) {
    const { from, to: clippedTo } = segmentToPixels(segments[i], cellSize);
    let to = clippedTo;

    const isLast = i === segments.length - 1;
    if (
      isLast &&
      segments[i].to.x === flagPosition.x &&
      segments[i].to.y === flagPosition.y
    ) {
      to = shortenLastSegmentToFlagOrbit(from, to, flagPosition, cellSize);
    }

    if (i === 0) {
      points.push(from);
    }
    points.push(to);

    const length = Math.hypot(to.x - from.x, to.y - from.y);
    segmentLengths.push(length);
  }

  const totalLength = segmentLengths.reduce((sum, len) => sum + len, 0);
  return { points, segmentLengths, totalLength };
}

export function getPointOnCircle(
  center: PathPoint,
  radius: number,
  t: number
): PathPoint {
  const angle = t * Math.PI * 2;
  return {
    x: center.x + Math.cos(angle) * radius,
    y: center.y + Math.sin(angle) * radius,
  };
}

export function buildContinuousPath(
  segments: LaserSegment[],
  cellSize: number
): ContinuousPath {
  if (segments.length === 0) {
    return { points: [], segmentLengths: [], totalLength: 0 };
  }

  const points: PathPoint[] = [];
  const segmentLengths: number[] = [];

  for (let i = 0; i < segments.length; i++) {
    const { from, to } = segmentToPixels(segments[i], cellSize);

    if (i === 0) {
      points.push(from);
    }
    points.push(to);

    const length = Math.hypot(to.x - from.x, to.y - from.y);
    segmentLengths.push(length);
  }

  const totalLength = segmentLengths.reduce((sum, len) => sum + len, 0);

  return { points, segmentLengths, totalLength };
}

export function getPointOnPath(
  path: ContinuousPath,
  t: number
): PathPoint | null {
  if (path.totalLength === 0 || path.points.length < 2) return null;

  const normalized = ((t % 1) + 1) % 1;
  let target = normalized * path.totalLength;

  for (let i = 0; i < path.segmentLengths.length; i++) {
    const segLen = path.segmentLengths[i];
    if (target <= segLen) {
      const ratio = segLen === 0 ? 0 : target / segLen;
      const from = path.points[i];
      const to = path.points[i + 1];
      return {
        x: from.x + (to.x - from.x) * ratio,
        y: from.y + (to.y - from.y) * ratio,
      };
    }
    target -= segLen;
  }

  return path.points[path.points.length - 1];
}

export function getDirectionOnPath(
  path: ContinuousPath,
  t: number
): { dx: number; dy: number } | null {
  if (path.segmentLengths.length === 0) return null;

  const normalized = ((t % 1) + 1) % 1;
  let target = normalized * path.totalLength;

  for (let i = 0; i < path.segmentLengths.length; i++) {
    const segLen = path.segmentLengths[i];
    if (target <= segLen || i === path.segmentLengths.length - 1) {
      const from = path.points[i];
      const to = path.points[i + 1];
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const mag = Math.hypot(dx, dy) || 1;
      return { dx: dx / mag, dy: dy / mag };
    }
    target -= segLen;
  }

  return null;
}

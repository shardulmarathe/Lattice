import type { LaserSegment, Position } from "@/lib/puzzleTypes";

export interface PathPoint {
  x: number;
  y: number;
}

export interface ContinuousPath {
  points: PathPoint[];
  segmentLengths: number[];
  totalLength: number;
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

/** Orbit radius for the victory ring around the flag icon. */
export const FLAG_ORBIT_RADIUS_RATIO = 0.34;

/**
 * Visual center of the flag icon (FlagTile SVG), offset from the cell center.
 * The pole sits left of the SVG viewBox center, so the ring must shift left.
 */
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

/** Linear laser path for victory mode — stops at the flag orbit, not the cell center. */
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
    const from = toPixel(segments[i].from.x, segments[i].from.y, cellSize);
    let to = toPixel(segments[i].to.x, segments[i].to.y, cellSize);

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
    const from = toPixel(segments[i].from.x, segments[i].from.y, cellSize);
    const to = toPixel(segments[i].to.x, segments[i].to.y, cellSize);

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

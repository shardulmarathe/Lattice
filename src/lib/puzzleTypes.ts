export type Direction = "up" | "down" | "left" | "right";

export type MirrorOrientation = "/" | "\\";

export type CellType =
  | "empty"
  | "number"
  | "source"
  | "flag"
  | "obstacle"
  | "mirror";

export interface Position {
  x: number;
  y: number;
}

export interface SourceConfig extends Position {
  direction: Direction;
}

export interface NumberTile extends Position {
  value: number;
}

export interface Puzzle {
  id: number;
  code: string;
  gridSize: number;
  source: SourceConfig;
  flag: Position;
  numbers: NumberTile[];
  obstacles: Position[];
}

export interface MirrorPlacement extends Position {
  orientation: MirrorOrientation;
}

export interface LaserSegment {
  from: { x: number; y: number };
  to: { x: number; y: number };
}

export interface LaserResult {
  segments: LaserSegment[];
  visitedCells: Position[];
  collectedNumbers: number[];
  reachedFlag: boolean;
  terminatedBy: "boundary" | "obstacle" | "revisit" | "flag" | null;
}

export interface ValidationResult {
  isValidOrder: boolean;
  isComplete: boolean;
  generatedSequence: string;
  warningMessage: string | null;
}

export interface BoardCell {
  type: CellType;
  number?: number;
  mirror?: MirrorOrientation;
  sourceDirection?: Direction;
}

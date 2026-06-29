import type { LaserResult, ValidationResult } from "./puzzleTypes";

export function validateSequence(
  targetCode: string,
  laserResult: LaserResult
): ValidationResult {
  const generatedSequence = laserResult.collectedNumbers.join("");
  const isValidOrder = generatedSequence === targetCode;
  const isComplete =
    isValidOrder && laserResult.reachedFlag && generatedSequence.length > 0;

  let warningMessage: string | null = null;

  if (
    generatedSequence.length > 0 &&
    (generatedSequence.length > targetCode.length ||
      !targetCode.startsWith(generatedSequence))
  ) {
    warningMessage = "Numbers must follow the target code order.";
  } else if (
    laserResult.reachedFlag &&
    generatedSequence !== targetCode
  ) {
    warningMessage =
      "Collect all numbers in order before reaching the flag.";
  }

  return {
    isValidOrder,
    isComplete,
    generatedSequence,
    warningMessage,
  };
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

/** Correct vs incorrect number tiles along the current laser path (by cell). */
export function getNumberTileStates(
  targetCode: string,
  board: { type: string; number?: number }[][],
  visitedCells: { x: number; y: number }[]
): { collectedKeys: Set<string>; incorrectKeys: Set<string>; correctPrefixLength: number } {
  const targetDigits = targetCode.split("").map(Number);
  const collectedKeys = new Set<string>();
  const incorrectKeys = new Set<string>();
  let matchIndex = 0;

  for (const pos of visitedCells) {
    const cell = board[pos.y]?.[pos.x];
    if (cell?.type !== "number" || cell.number === undefined) continue;

    const key = cellKey(pos.x, pos.y);
    if (
      matchIndex < targetDigits.length &&
      cell.number === targetDigits[matchIndex]
    ) {
      collectedKeys.add(key);
      incorrectKeys.delete(key);
      matchIndex++;
    } else {
      incorrectKeys.add(key);
      collectedKeys.delete(key);
    }
  }

  return { collectedKeys, incorrectKeys, correctPrefixLength: matchIndex };
}

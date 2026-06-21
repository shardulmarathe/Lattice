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

export function getShareText(puzzleId: number, timeSeconds: number): string {
  return `LATTICE #${puzzleId.toString().padStart(3, "0")}\nSolved in ${formatTime(timeSeconds)}`;
}

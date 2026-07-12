"use client";

interface TapRippleProps {
  cellSize: number;
  cellX: number;
  cellY: number;
}

/**
 * Expanding white ring marking a simulated tap on a board cell. Runs its CSS
 * animation once on mount — remount with a fresh key to replay it.
 */
export default function TapRipple({ cellSize, cellX, cellY }: TapRippleProps) {
  const ringSize = cellSize * 0.6;

  return (
    <div
      className="pointer-events-none absolute z-50 flex items-center justify-center"
      style={{
        left: cellX * cellSize,
        top: cellY * cellSize,
        width: cellSize,
        height: cellSize,
      }}
    >
      <div
        className="animate-tap-ripple rounded-full border border-white/80"
        style={{ width: ringSize, height: ringSize }}
      />
    </div>
  );
}

"use client";

interface FlagTileProps {
  size: number;
}

export default function FlagTile({ size }: FlagTileProps) {
  const flagSize = size * 0.5;
  return (
    <div
      className="flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg
        width={flagSize}
        height={flagSize}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M5 21V3M5 3L15 7L5 11"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

"use client";

interface HeaderProps {
  time: string;
  isPaused: boolean;
  onPause: () => void;
  onClear: () => void;
  disabled?: boolean;
}

export default function Header({
  time,
  isPaused,
  onPause,
  onClear,
  disabled = false,
}: HeaderProps) {
  return (
    <header className="flex w-full items-center justify-between px-4 py-3 md:px-6">
      <div className="font-mono text-lg tracking-wider text-white md:text-xl">
        {time}
      </div>

      <div className="flex gap-2 md:gap-3">
        <button
          onClick={onPause}
          disabled={disabled}
          className="border border-white/10 px-3 py-1.5 text-xs tracking-[0.15em] text-white/70 transition-colors hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 md:px-4 md:py-2 md:text-sm"
        >
          {isPaused ? "RESUME" : "PAUSE"}
        </button>
        <button
          onClick={onClear}
          disabled={disabled}
          className="border border-white/10 px-3 py-1.5 text-xs tracking-[0.15em] text-white/70 transition-colors hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 md:px-4 md:py-2 md:text-sm"
        >
          CLEAR BOARD
        </button>
      </div>
    </header>
  );
}

"use client";

interface HeaderProps {
  time: string;
  isPaused: boolean;
  onHome: () => void;
  onRules: () => void;
  onPause: () => void;
  onClear: () => void;
  disabled?: boolean;
}

const buttonBase =
  "bg-transparent px-3 py-1.5 text-[0.83rem] tracking-[0.15em] text-white/38 transition-colors outline-none focus:outline-none focus-visible:outline-none hover:text-white/52 disabled:cursor-not-allowed md:px-4 md:py-2 md:text-[0.97rem] [-webkit-tap-highlight-color:transparent]";

const navButtonClass = `${buttonBase} border border-transparent active:border-transparent`;

export default function Header({
  time,
  isPaused,
  onHome,
  onRules,
  onPause,
  onClear,
  disabled = false,
}: HeaderProps) {
  return (
    <header className="flex w-full items-center justify-between px-4 py-3 md:px-6">
      <div className="flex gap-2 md:gap-3">
        <button onClick={onHome} className={navButtonClass}>
          HOME
        </button>
        <button
          onClick={onClear}
          disabled={disabled}
          className={navButtonClass}
        >
          CLEAR BOARD
        </button>
      </div>

      <div className="flex items-center gap-3 md:gap-4">
        <button onClick={onRules} className={navButtonClass}>
          RULES
        </button>
        <button
          onClick={onPause}
          disabled={disabled}
          className={navButtonClass}
        >
          {isPaused ? "RESUME" : "PAUSE"}
        </button>
        <div className="font-mono text-lg tracking-wider text-white md:text-xl">
          {time}
        </div>
      </div>
    </header>
  );
}

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
  "bg-transparent px-2 py-1.5 text-[0.72rem] tracking-[0.1em] text-white/88 transition-colors outline-none focus:outline-none focus-visible:outline-none hover:text-white disabled:cursor-not-allowed disabled:text-white/38 sm:px-3 sm:text-[0.83rem] sm:tracking-[0.15em] md:px-4 md:py-2 md:text-[0.97rem] [-webkit-tap-highlight-color:transparent]";

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
    <header className="flex w-full shrink-0 items-center justify-between gap-2 px-2 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] sm:px-4 md:px-6">
      <div className="flex gap-1 sm:gap-2 md:gap-3">
        <button onClick={onHome} className={navButtonClass}>
          HOME
        </button>
        <button
          onClick={onClear}
          disabled={disabled}
          className={navButtonClass}
        >
          RESET
        </button>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-3 md:gap-4">
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
        <div className="font-mono text-base tracking-wider text-white sm:text-lg md:text-xl">
          {time}
        </div>
      </div>
    </header>
  );
}

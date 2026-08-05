"use client";

import { useSound } from "./SoundProvider";

interface SoundToggleProps {
  /** Lets the game header hand it the same class the other nav buttons use. */
  className?: string;
}

/**
 * Icon rather than a word: the game header already carries six items at
 * 0.72rem on a narrow phone and a SOUND / MUTED label forces it to wrap.
 */
export default function SoundToggle({ className = "" }: SoundToggleProps) {
  // Deliberately `audible`, not `enabled`: before a gesture arms audio nothing
  // can be heard, so showing the speaker as on would be a lie and the first tap
  // would read as muting something that was never playing.
  const { audible, toggle } = useSound();

  return (
    <button
      type="button"
      data-sound-toggle
      onClick={toggle}
      aria-label={audible ? "Mute sound" : "Enable sound"}
      aria-pressed={audible}
      className={className}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M11 5 6 9H3v6h3l5 4V5z" />
        {audible ? (
          <>
            <path d="M15.5 8.5a5 5 0 0 1 0 7" />
            <path d="M18.5 5.5a9 9 0 0 1 0 13" />
          </>
        ) : (
          <>
            <path d="M22 9l-6 6" />
            <path d="M16 9l6 6" />
          </>
        )}
      </svg>
    </button>
  );
}

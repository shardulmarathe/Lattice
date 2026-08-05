const STORAGE_KEY = "lattice-sound";

/** Sound is on by default; it still needs a gesture before anything is audible. */
export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;

  try {
    return localStorage.getItem(STORAGE_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setSoundEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    // Ignore quota / private browsing errors
  }
}

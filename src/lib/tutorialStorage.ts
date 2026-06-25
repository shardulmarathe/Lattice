const STORAGE_KEY = "lattice-seen-tutorial";

export function hasSeenTutorial(): boolean {
  if (typeof window === "undefined") return false;

  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markTutorialSeen(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // Ignore quota / private browsing errors
  }
}

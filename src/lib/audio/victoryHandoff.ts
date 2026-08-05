/**
 * Hands the victory sting across the /play -> /complete route change.
 *
 * The board shows the victory laser for only ~350ms before navigating, so the
 * sting is two voices: victoryCharge fires on the board, victoryResolve lands
 * on the complete screen's checkmark. This flag is what tells the complete
 * screen it was reached by an actual solve.
 *
 * Module state deliberately, not storage: a hard reload or a deep link to
 * /complete starts a fresh module, so a revisited completion screen is silent.
 */
let armed = false;

export function armVictoryResolve(): void {
  armed = true;
}

/** True at most once per solve. */
export function consumeVictoryResolve(): boolean {
  if (!armed) return false;
  armed = false;
  return true;
}

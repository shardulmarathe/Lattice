/**
 * The audio engine is a module-level singleton, deliberately outside React.
 *
 * It has to survive client-side route changes: the victory sting starts on the
 * board in /play and finishes on the checkmark in /complete, which is only
 * possible if the AudioContext and its running nodes are not owned by a
 * component that unmounts at the route boundary.
 *
 * Browsers refuse to start an AudioContext without a user gesture, and
 * mousemove does not count. Everything here no-ops until unlock() runs from a
 * real gesture, so a cold home page load is silent until the sound toggle (or
 * any click) arms it.
 */

import {
  createBeamVoice,
  createCursorVoice,
  createImpulseResponse,
  digitCollected,
  hintChime,
  illegalTap,
  mirrorPlace,
  mirrorRemove,
  mirrorRotate,
  navCharge,
  navFire,
  uiTick,
  victoryCharge,
  victoryResolve,
  wrongState,
  type BeamVoice,
  type Buses,
  type CursorVoice,
} from "./voices";

/** Headroom below unity so stacked voices cannot clip. */
const MASTER_LEVEL = 0.85;
/** Bed bus level while ducked (paused, tab hidden, tutorial open). */
const DUCK_LEVEL = 0.08;
/** Wet return level. This is the master control on how much "aura" there is. */
const REVERB_RETURN = 0.5;
// A room, not a hall. The palette is high-frequency crackle now, and a long
// tail overlaps each transient's sizzle with the one before it until the
// texture reads as undifferentiated mush instead of a laser.
const REVERB_SECONDS = 0.55;
const REVERB_DECAY = 5.5;
/**
 * How much of the continuous voices' hum goes to the reverb: the "aura" around
 * the blade. Small, because a sustained voice in a reverb is a wash rather than
 * a tail, and the chorus inside `buildHum` is already doing most of this job.
 *
 * Tapped off the bed bus rather than added per-voice, which is what makes it
 * duck: a per-voice send sits upstream of the bed gain, so a hidden tab would
 * keep ringing at full level with the voice itself silenced.
 */
const BED_VERB_SEND = 0.12;
const NEAR_ZERO = 0.0001;

const ONE_SHOTS = {
  mirrorPlace,
  mirrorRotate,
  mirrorRemove,
  illegalTap,
  wrongState,
  hintChime,
  uiTick,
  navCharge,
  navFire,
  victoryCharge,
  victoryResolve,
} as const;

export type SoundName = keyof typeof ONE_SHOTS;
export type DuckReason = "paused" | "hidden" | "locked";

/**
 * Derived from the voice rather than restated, so the shape the game sends and
 * the shape the synth reads can never drift apart.
 */
export type BeamState = Parameters<BeamVoice["setState"]>[0];

let buses: Buses | null = null;
let master: GainNode | null = null;
let enabled = true;
let cursor: CursorVoice | null = null;
let beam: BeamVoice | null = null;
let beamState: BeamState = {
  length: 0,
  bounces: 0,
  terminatedBy: null,
  mistake: false,
};
let cursorWanted = false;
let beamWanted = false;
/** Extra bed level for the beam. 1 on /play; quieter on /complete. */
let beamPresence = 1;
const ducks = new Set<DuckReason>();
let visibilityBound = false;
const armedListeners = new Set<(armed: boolean) => void>();

type WebkitWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

function createContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
  if (!Ctor) return null;

  try {
    return new Ctor();
  } catch {
    // Some privacy modes throw on construction.
    return null;
  }
}

/** Builds the graph on first use. Returns null where Web Audio is unavailable. */
function ensure(): Buses | null {
  if (buses) return buses;

  const ctx = createContext();
  if (!ctx) return null;

  const masterGain = ctx.createGain();
  masterGain.gain.value = enabled ? MASTER_LEVEL : NEAR_ZERO;
  masterGain.connect(ctx.destination);

  const fx = ctx.createGain();
  fx.gain.value = 1;
  fx.connect(masterGain);

  const bedBus = ctx.createGain();
  bedBus.gain.value = ducks.size > 0 ? DUCK_LEVEL : 1;
  bedBus.connect(masterGain);

  // Parallel reverb send. The impulse is generated, not shipped, so the aura
  // costs no bytes. One-shots send into it individually, at the per-voice
  // levels in SEND; the continuous voices get one small shared tap off the bed
  // instead, so their aura ducks with them.
  const verbBus = ctx.createGain();
  verbBus.gain.value = 1;
  const convolver = ctx.createConvolver();
  convolver.buffer = createImpulseResponse(ctx, REVERB_SECONDS, REVERB_DECAY);
  const verbReturn = ctx.createGain();
  verbReturn.gain.value = REVERB_RETURN;
  verbBus.connect(convolver).connect(verbReturn).connect(masterGain);

  const bedSend = ctx.createGain();
  bedSend.gain.value = BED_VERB_SEND;
  bedBus.connect(bedSend).connect(verbBus);

  master = masterGain;
  buses = { ctx, fx, bed: bedBus, verb: verbBus };

  bindVisibility();
  return buses;
}

function bindVisibility(): void {
  if (visibilityBound || typeof document === "undefined") return;
  visibilityBound = true;

  document.addEventListener("visibilitychange", () => {
    duck("hidden", document.hidden);
  });
}

/** Live only when armed, enabled, and the context is actually running. */
function active(): Buses | null {
  const b = buses;
  if (!b || !enabled || b.ctx.state !== "running") return null;
  return b;
}

/**
 * Whether audio has been armed by a gesture and is actually able to sound.
 * The UI needs this: an enabled-but-locked toggle must read "tap to enable",
 * not "on", or the first tap on it silences the app instead of starting it.
 */
export function isArmed(): boolean {
  return buses?.ctx.state === "running";
}

export function subscribeArmed(listener: (armed: boolean) => void): () => void {
  armedListeners.add(listener);
  return () => armedListeners.delete(listener);
}

function notifyArmed(): void {
  const armed = isArmed();
  for (const listener of armedListeners) listener(armed);
}

/**
 * Arms audio. Must be called from a user gesture handler; safe to call
 * repeatedly. Restarts any continuous voice that was requested while locked.
 */
export function unlock(): void {
  const b = ensure();
  if (!b) return;

  if (b.ctx.state !== "running") {
    void b.ctx
      .resume()
      .then(() => {
        syncContinuous();
        notifyArmed();
      })
      .catch(() => {
        // Still locked, a later gesture will try again.
      });
    return;
  }

  syncContinuous();
  notifyArmed();
}

export function isEnabled(): boolean {
  return enabled;
}

export function setEnabled(on: boolean): void {
  enabled = on;

  if (!on) {
    // Tear the continuous voices down rather than only muting them, so a muted
    // tab is not burning CPU on oscillators nobody can hear.
    cursor?.stop();
    cursor = null;
    beam?.stop();
    beam = null;
  }

  const b = buses;
  if (!b || !master) return;

  const t = b.ctx.currentTime;
  master.gain.cancelScheduledValues(t);
  master.gain.setTargetAtTime(on ? MASTER_LEVEL : NEAR_ZERO, t, 0.05);

  // Deliberately not unlock(): applying a stored preference on mount must not
  // construct an AudioContext for a visitor who never interacts. Arming is the
  // job of a real gesture. This only rebuilds voices torn down while muted.
  if (on) syncContinuous();
}

/**
 * Reference-counted attenuation of the bed bus, which carries every continuous
 * voice. Several reasons can overlap (paused while the tab is hidden), so the
 * bus lifts only when all of them are clear.
 */
export function duck(reason: DuckReason, on: boolean): void {
  if (on) ducks.add(reason);
  else ducks.delete(reason);

  const b = buses;
  if (!b) return;

  const t = b.ctx.currentTime;
  b.bed.gain.cancelScheduledValues(t);
  b.bed.gain.setTargetAtTime(ducks.size > 0 ? DUCK_LEVEL : 1, t, 0.12);
}

export function play(name: SoundName): void {
  const b = active();
  if (!b) return;

  ONE_SHOTS[name](b, b.ctx.currentTime);
}

/** Scheduled variant, used to land the victory resolve on the checkmark. */
export function playIn(name: SoundName, delaySeconds: number): void {
  const b = active();
  if (!b) return;

  ONE_SHOTS[name](b, b.ctx.currentTime + Math.max(0, delaySeconds));
}

export function playDigit(index: number): void {
  const b = active();
  if (!b) return;

  digitCollected(b, b.ctx.currentTime, index);
}

// --- continuous voices ----------------------------------------------------

/** Rebuilds whichever continuous voices are wanted but not currently running. */
function syncContinuous(): void {
  const b = active();
  if (!b) return;

  if (cursorWanted && !cursor) cursor = createCursorVoice(b);
  if (beamWanted && !beam) {
    beam = createBeamVoice(b);
    // A voice rebuilt after unmute starts from nothing; replaying the last
    // state is what makes it come back as the beam currently on the board.
    beam.setState(beamState);
    beam.setPresence(beamPresence);
  }
}

/** Home page only. Torn down on unmount so it cannot bleed into /play. */
export function setCursorActive(on: boolean): void {
  cursorWanted = on;

  if (!on) {
    cursor?.stop();
    cursor = null;
    return;
  }

  syncContinuous();
}

/** @param speed normalized 0-1. */
export function setCursorSpeed(speed: number): void {
  cursor?.setSpeed(speed);
}

/** In-game only. Torn down on unmount so it cannot bleed into /complete. */
export function setBeamActive(on: boolean): void {
  beamWanted = on;

  if (!on) {
    beam?.stop();
    beam = null;
    return;
  }

  syncContinuous();
}

/**
 * The beam the player can see, as the beam they can hear. Kept even while no
 * voice exists, because the state is the game's, not the synth's, and a voice
 * built later has to arrive already sounding like the current board.
 */
export function setBeamState(state: BeamState): void {
  beamState = state;
  beam?.setState(state);
}

/**
 * Multiplier on the continuous beam. /play leaves this at 1; /complete turns
 * it down so the solved path stays audible under the results without competing
 * with the UI.
 */
export function setBeamPresence(level: number): void {
  beamPresence = Math.max(0, Math.min(1, level));
  beam?.setPresence(beamPresence);
}

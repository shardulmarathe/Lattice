/**
 * Every sound in Lattice is synthesized here, there are no audio assets.
 *
 * There are two voice families, and they are deliberately different animals.
 *
 * --- ONE-SHOTS: an electrical arc ---
 *
 * Every discrete event - a mirror seated, a digit locked, the victory sting -
 * is an industrial emitter striking. Four layers, in this order:
 *
 *   1. transient  - the contactor closing. `resonantClick`, a 4ms impulse rung
 *                   through high-Q bandpasses so the decay comes from the
 *                   filter rather than an envelope, which is what makes it read
 *                   as a physical object.
 *   2. body       - a resonant tone falling (or rising) through the mid band.
 *                   `beamCore`. Short; it is the strike, not the sound.
 *   3. SIZZLE     - the frying, arcing high end. This is the layer that makes
 *                   the whole thing believable, and it is the one the first two
 *                   passes got wrong.
 *   4. tail       - the reverb send. Every one-shot ends there, which is what
 *                   makes a set of synthesized noises cohere into one palette.
 *
 * The crux is layer 3. Sizzle is NOT filtered noise. Static bandpassed noise is
 * "shhh" and it is what made the earlier passes sound like escaping air. Sizzle
 * is noise MODULATING something: an electrical arc is irregular because its
 * conduction path is collapsing and re-striking hundreds of times a second, so
 * both its brightness and its loudness stutter. `sizzle()` reproduces that by
 * running random signals into a bandpass's cutoff, its Q, and its output gain
 * at once, plus discrete spark pops on top.
 *
 * Web Audio makes this cheap and asset-free: an AudioBufferSourceNode can be
 * connected straight to an AudioParam, so a buffer of white noise IS a
 * modulator, a buffer of held random values IS a sample & hold, and a buffer of
 * sparse impulses IS a crackle generator. No oscillators, no samples.
 *
 * --- CONTINUOUS VOICES: a lightsaber hum ---
 *
 * The cursor tone and the in-game beam are the opposite, and they used to be
 * built on the same arc rig as the one-shots. They cannot be. A texture that is
 * exciting for 300ms is punishing for 300 seconds, and the arc rig has two
 * properties that make it actively unpleasant when held: its energy lives at
 * 2-9 kHz, and its amplitude is chopped by a sample & hold running at engine
 * speeds. Players heard the first as "scratchy" and the second, sitting under
 * a 52 Hz resonant sweep, as a lawnmower. Both readings were correct.
 *
 * So a held beam is a HUM, `buildHum`, and it contains no noise at all:
 *
 *   - a small harmonic stack, fundamental plus octave plus fifth, so it is a
 *     chord rather than a tone. The fifth is what stops it reading as an organ.
 *   - each partial doubled and detuned, the two copies panned apart. The
 *     beating between them is the aura, and it costs nothing.
 *   - two sine vibratos at incommensurate rates. One rate is a synth patch;
 *     two that never line up is something alive.
 *   - two sine amplitude LFOs, likewise incommensurate, so a hum held for a
 *     five-minute solve never audibly loops.
 *   - a GENTLE lowpass. Q is 1.2, not the 9 it was: filter resonance over a low
 *     fundamental is most of what made the old voice a motor.
 *
 * Everything the board needs to say is said through those parameters rather
 * than through noise - see `createBeamVoice` for the mapping.
 *
 * All levels live in MIX, all timings in SHAPE. Tuning the mix means editing
 * those two objects, not the voice bodies.
 */

/**
 * Drive levels, NOT output peaks. Every voice runs through resonant filters,
 * which add 10-20 dB, so these numbers cannot be compared to each other by eye.
 * They are set by rendering each voice through an OfflineAudioContext and
 * scaling until the measured peaks land where they should.
 * Re-measure after changing any filter Q.
 */
export const MIX = {
  // The continuous voices sit far below the one-shots on purpose: sustained
  // tone reads much louder than a transient of the same peak, so matching them
  // numerically would put the beam on top of the gameplay. These two are also
  // the only voices that are never not sounding, and anything fatiguing about
  // them compounds over a five-minute solve.
  //
  // Unlike the one-shots these are NOT resonant-filter drives - the hum's
  // lowpass sits at Q 1.2, near unity - so they are much closer to the peak
  // they actually produce.
  cursor: 0.0166,
  /** The whole in-game beam. It is one hum now, so it is one number. */
  beamHum: 0.0152,
  mirrorPlace: 0.04266,
  mirrorRotate: 0.0487,
  mirrorRemove: 0.06137,
  digit: 0.03732,
  illegalTap: 0.6059,
  wrongState: 0.02445,
  hint: 0.0316,
  // Very high drive because a 4ms impulse loses most of its energy in the
  // bandpasses, and a millisecond-scale click needs more peak than a sustained
  // tone to read as equally loud.
  uiTick: 2.22714,
  navCharge: 0.05706,
  navFire: 0.03572,
  victoryCharge: 0.06031,
  victoryResolve: 0.077,
} as const;

/**
 * Durations in seconds. The `*Sizzle` entries are longer than the bodies they
 * accompany on purpose: the strike is instant, the arc keeps frying after it.
 * That asymmetry is what makes the sound feel like equipment discharging rather
 * than a sample being played.
 */
export const SHAPE = {
  mirror: 0.11,
  mirrorSizzle: 0.34,
  mirrorRemove: 0.15,
  mirrorRemoveSizzle: 0.4,
  digit: 0.34,
  digitSizzle: 0.3,
  illegalTap: 0.11,
  illegalSizzle: 0.16,
  wrongState: 0.34,
  wrongSizzle: 0.46,
  hint: 0.7,
  hintSizzle: 0.5,
  uiTickSizzle: 0.07,
  navCharge: 0.5,
  navFire: 0.3,
  navFireSizzle: 0.44,
  victoryCharge: 0.55,
  victoryChargeTail: 0.5,
  victoryResolve: 1.9,
  victoryResolveSizzle: 1.15,
} as const;

/**
 * Global pitch transposition for the whole palette, applied inside the three
 * primitives that every voice is built from, so the balance between voices is
 * preserved and there is exactly one knob to turn.
 *
 * `PITCH` moves the tonal content: bodies, clicks, the whine, the digit scale,
 * the victory chord. 0.5 is a full octave down.
 *
 * `SIZZLE_PITCH` moves the noise bands, kept a little above PITCH because the
 * sizzle IS the high-frequency arc character and dropping it all the way turns
 * the spitting into a rumble.
 *
 * Both re-balance the mix as a side effect: resonant filters contribute
 * frequency-dependent gain, so transposing changes every voice's loudness by a
 * different amount. Always re-measure and re-normalize MIX after touching them.
 */
const PITCH = 0.5;
const SIZZLE_PITCH = 0.58;

/**
 * How loud the continuous frying/arcing texture sits within each voice. This is
 * THE laser sound; at 0 the palette collapses to click + body + reverb and the
 * beam voice, which has no transient or body to fall back on, goes silent.
 */
const SIZZLE_LEVEL = 0.55;

/**
 * How loud the discrete spark POPS are, independently of the sizzle they sit
 * on. These are two different layers and they need two different knobs: the
 * sizzle is the continuous frying that makes a laser sound like a laser, the
 * crackle is the intermittent snapping on top of it. Turning the sizzle down to
 * quiet the popping removes the laser and keeps the problem.
 */
const CRACKLE_LEVEL = 0.75;

/** Per-voice reverb send, 0-1. Dry sounds read as blocked, wet as open. */
const SEND = {
  mirror: 0.3,
  digit: 0.5,
  illegalTap: 0.05,
  wrongState: 0.35,
  hint: 0.55,
  uiTick: 0.22,
  nav: 0.5,
  victory: 0.7,
} as const;

export interface Buses {
  ctx: AudioContext;
  /** One-shot effects, dry. */
  fx: GainNode;
  /**
   * Continuous voices (cursor hum, game beam). Ducked on pause / tab hide, and
   * given its own small reverb send by the engine - see BED_VERB_SEND there,
   * and do not add a per-voice send on top of it.
   */
  bed: GainNode;
  /** Reverb send. Per-voice, and one-shots only: the bed has its own tap. */
  verb: GainNode;
}

// --- shared helpers -------------------------------------------------------

/**
 * Percussive gain envelope. exponentialRampToValueAtTime can never reach zero,
 * so every voice decays to NEAR_ZERO and is then hard-stopped.
 */
const NEAR_ZERO = 0.0001;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

let cachedNoise: AudioBuffer | null = null;

/** One second of white noise, built once and reused by every noise voice. */
function noiseBuffer(ctx: AudioContext): AudioBuffer {
  if (cachedNoise && cachedNoise.sampleRate === ctx.sampleRate) {
    return cachedNoise;
  }

  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  cachedNoise = buffer;
  return buffer;
}

/**
 * Modulator buffers are cached by shape, not rebuilt per voice: a mirror tap
 * would otherwise allocate half a megabyte of Float32 every time. The sizzle
 * rig deliberately asks for only one shape of each and varies the *rate* with
 * playbackRate, so in practice this map holds two entries for the app's life.
 */
const modCache = new Map<string, AudioBuffer>();

/**
 * Sample & hold: random values held for 1/stepHz seconds each. Fed into a
 * filter cutoff this gives the stepped, raspy, gritty jumps that a smoothly
 * swept filter cannot; fed into a gain it gives stuttering amplitude. The
 * length is rounded up to a whole number of steps so looping never lands
 * mid-step and clicks.
 */
export function steppedRandomBuffer(
  ctx: AudioContext,
  stepHz: number,
  seconds: number
): AudioBuffer {
  const hz = Math.max(0.05, stepHz);
  const key = `step:${ctx.sampleRate}:${hz.toFixed(2)}:${seconds.toFixed(2)}`;
  const cached = modCache.get(key);
  if (cached) return cached;

  const stepSamples = Math.max(1, Math.round(ctx.sampleRate / hz));
  const steps = Math.max(
    1,
    Math.ceil((Math.max(0.01, seconds) * ctx.sampleRate) / stepSamples)
  );
  const buffer = ctx.createBuffer(1, steps * stepSamples, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let step = 0; step < steps; step++) {
    const start = step * stepSamples;
    data.fill(Math.random() * 2 - 1, start, start + stepSamples);
  }

  modCache.set(key, buffer);
  return buffer;
}

/**
 * Sparse impulses: individual sparks, not hiss. Each event is 1-3 samples of
 * random signed amplitude, which is broadband by construction, so the pitch of
 * a pop is decided by the filter it is played through rather than baked in.
 *
 * Density is exponential because the interesting range is at the bottom: a
 * handful of pops per second reads as "arcing", a hundred reads as "frying",
 * and the linear middle between them is where it stops sounding like sparks.
 */
export function crackleBuffer(
  ctx: AudioContext,
  seconds: number,
  density: number
): AudioBuffer {
  const d = clamp(density, 0, 1);
  const key = `crackle:${ctx.sampleRate}:${seconds.toFixed(2)}:${d.toFixed(2)}`;
  const cached = modCache.get(key);
  if (cached) return cached;

  const length = Math.max(1, Math.floor(ctx.sampleRate * Math.max(0.01, seconds)));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  const perSecond = 4 * 120 ** d;
  const chance = perSecond / ctx.sampleRate;

  for (let i = 0; i < length; i++) {
    if (Math.random() >= chance) continue;

    const amp = (Math.random() * 2 - 1) * (0.35 + Math.random() * 0.65);
    const width = 1 + Math.floor(Math.random() * 3);
    for (let k = 0; k < width && i + k < length; k++) {
      // Sum rather than assign so overlapping sparks stack instead of erasing
      // each other, which is what keeps dense settings from thinning out.
      data[i + k] +=
        amp * (1 - k / width) * (k === 0 ? 1 : Math.random() * 2 - 1);
    }
  }

  modCache.set(key, buffer);
  return buffer;
}

/**
 * The reverb impulse, generated rather than shipped as a file. Decaying noise,
 * one-pole filtered with a coefficient that falls over the tail so the aura
 * darkens as it fades instead of hissing. That darkening matters more now that
 * every voice sends a bright 2-9 kHz sizzle into it.
 */
export function createImpulseResponse(
  ctx: AudioContext,
  seconds = 1.7,
  decay = 3.4
): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);

  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const t = i / length;
      const brightness = 0.85 - t * 0.7;
      last += brightness * (Math.random() * 2 - 1 - last);
      data[i] = last * (1 - t) ** decay;
    }
  }

  return buffer;
}

function envelope(
  ctx: AudioContext,
  peak: number,
  when: number,
  attack: number,
  duration: number
): GainNode {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(NEAR_ZERO, when);
  gain.gain.exponentialRampToValueAtTime(peak, when + attack);
  gain.gain.exponentialRampToValueAtTime(NEAR_ZERO, when + duration);
  return gain;
}

function tone(
  ctx: AudioContext,
  type: OscillatorType,
  when: number,
  duration: number
): OscillatorNode {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.start(when);
  osc.stop(when + duration + 0.02);
  return osc;
}

/** A random start offset, so two taps in a row are never the same noise. */
function randomOffset(buffer: AudioBuffer): number {
  return Math.random() * buffer.duration * 0.9;
}

function noise(
  ctx: AudioContext,
  when: number,
  duration: number
): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  src.start(when, randomOffset(src.buffer));
  src.stop(when + duration + 0.02);
  return src;
}

/** Dry to fx, a scaled copy to the reverb. Every one-shot ends here. */
function emit(buses: Buses, node: AudioNode, send: number): void {
  node.connect(buses.fx);
  if (send <= 0) return;

  const sendGain = buses.ctx.createGain();
  sendGain.gain.value = send;
  node.connect(sendGain).connect(buses.verb);
}

// --- the sizzle rig -------------------------------------------------------

/**
 * The modulators are always built at one canonical rate and re-rated with
 * playbackRate. Two reasons: allocation stays constant no matter how many
 * variations the voices ask for, and playbackRate is an AudioParam, so the
 * modulation rate can glide with setTargetAtTime while the voice is running.
 */
const STEP_BASE_HZ = 120;
const STEP_BASE_SECONDS = 1.5;
const CRACKLE_BASE_SECONDS = 2.2;
/** ~55 sparks/second at playbackRate 1, so the useful range brackets it. */
const CRACKLE_BASE_DENSITY = 0.55;

/**
 * A running electrical arc. Everything is exposed as a param so one rig can be
 * a 300ms spit or a continuous beam.
 */
interface SizzleRig {
  /** Connect onward to an envelope (one-shot) or a bus gain (continuous). */
  out: GainNode;
  /** Centre of the arc band. Automate this to move the sizzle's pitch. */
  band: BiquadFilterNode;
  /** Depth in Hz of the audio-rate cutoff jitter. */
  fmDepth: GainNode;
  /** Depth in Hz of the stepped cutoff jumps. */
  stepDepth: GainNode;
  /** Depth in Q units of the bandwidth breathing. */
  qDepth: GainNode;
  /** Fast amplitude stutter depth. This is most of the audible grit. */
  ampFast: GainNode;
  /** Slow amplitude breathing depth. This is what makes the arc sound alive. */
  ampSlow: GainNode;
  /** Sample & hold rate, 1 = STEP_BASE_HZ. Higher is more violent. */
  stepRate: AudioParam;
  /** Level of the discrete spark pops, relative to the rig output. */
  crackleLevel: GainNode;
  /** Spark rate multiplier, 1 = the base density. */
  crackleRate: AudioParam;
  start(when: number): void;
  stop(when: number): void;
}

/**
 * The most the two cutoff modulators are allowed to sum to, given the lowest
 * frequency the band will ever be automated to.
 *
 * A bandpass driven to 0 Hz does not go quiet, it goes unstable: the biquad
 * loses its pole and rings up without bound. Measured, an unclamped intensity
 * of 1 peaked at 112378 - five orders of magnitude over full scale - and
 * because the blow-up is chaotic it also made every other number in the render
 * non-reproducible. Both modulators are symmetric and independent, so the only
 * safe rule is that their summed downward excursion stays strictly inside the
 * floor even when both peak negative in the same sample.
 */
function depthBudget(floorHz: number): number {
  // The 200Hz term matters for the low sweeps: a biquad whose cutoff sits a
  // couple of hundred Hz above zero has poles almost on the unit circle, and
  // even when it does not blow up outright it stops being bit-reproducible,
  // which makes every measurement of it noise.
  return Math.max(60, Math.min(floorHz * 0.7, floorHz - 200));
}

/**
 * One random noise source feeding several destinations at once is the whole
 * trick. Here the same handful of random signals drive:
 *
 *   - the bandpass cutoff, twice over: white noise at audio rate for continuous
 *     grit, and a sample & hold for the discrete jumps that read as the arc
 *     re-striking. Either alone is bland; together they are plasma.
 *   - the bandpass Q, from a slow sample & hold, so the bandwidth breathes and
 *     the arc alternately focuses and splatters.
 *   - the output gain, from the same two sample & holds, so loudness stutters
 *     in sympathy with brightness. A real arc dims when it wanders.
 *
 * Plus a sparse impulse layer for the discrete pops, which no amount of
 * filtering will produce from continuous noise.
 */
function buildSizzle(
  ctx: AudioContext,
  opts: {
    /** Centre frequency, and the reference all the depths are scaled from. */
    bandHz: number;
    /** Lowest the band will ever be automated to. Bounds the modulation. */
    floorHz?: number;
    /** 0-1, how violent. Drives every modulation depth and rate together. */
    intensity?: number;
    /** 0-1 spark density. */
    crackle?: number;
    q?: number;
  }
): SizzleRig {
  const {
    bandHz,
    floorHz = bandHz,
    intensity = 0.6,
    crackle = 0.3,
    q = 5,
  } = opts;
  const i = clamp(intensity, 0, 1);
  const ck = clamp(crackle, 0, 1);

  // Scale the two cutoff depths together so their sum fits the budget. Scaling
  // rather than clipping keeps their ratio, so the character does not change
  // as intensity approaches 1 - it just stops being able to destroy itself.
  const budget = depthBudget(floorHz);
  const wantFm = bandHz * (0.08 + 0.19 * i);
  const wantStep = bandHz * (0.18 + 0.34 * i);
  const fit = Math.min(1, budget / (wantFm + wantStep));

  const out = ctx.createGain();
  out.gain.value = 1;

  // Keeps the very top off the listener's ears. The FM below throws energy well
  // above the band centre and without this it turns into a hiss halo.
  const tame = ctx.createBiquadFilter();
  tame.type = "lowpass";
  tame.frequency.value = 11000;
  tame.Q.value = 0.7;
  tame.connect(out);

  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = bandHz;
  band.Q.value = q;

  // Amplitude is modulated in two stages rather than one summed node, and that
  // is not fussiness. Summed into a single gain, deep modulation pushes the
  // gain negative, |gain| folds back up, and the envelope range COMPRESSES
  // exactly where it was supposed to open up. In series each stage stays
  // strictly positive and the ranges multiply, so the arc can go from nearly
  // extinguished to hard-struck without either stage ever flipping sign.
  //
  //   amp   - fast stutter, grit inside a syllable
  //   drift - the arc guttering and re-striking over tens of milliseconds
  const amp = ctx.createGain();
  amp.gain.value = 1;
  const drift = ctx.createGain();
  drift.gain.value = 1;
  band.connect(amp).connect(drift).connect(tame);

  const carrier = ctx.createBufferSource();
  carrier.buffer = noiseBuffer(ctx);
  carrier.loop = true;
  carrier.connect(band);

  // Destination 1a: cutoff, at audio rate. Held to a shallow depth on purpose.
  // Full-band noise wobbling the cutoff hard just smears the bandpass into a
  // wideband noise gate, which is the "shhh" this whole file exists to avoid;
  // shallow, it adds sideband fizz while the band keeps its identity. The
  // character comes from the stepped layer below, not from here.
  const fm = ctx.createBufferSource();
  fm.buffer = noiseBuffer(ctx);
  fm.loop = true;
  const fmDepth = ctx.createGain();
  fmDepth.gain.value = wantFm * fit;
  fm.connect(fmDepth).connect(band.frequency);

  // Destination 1b: cutoff, stepped. This is the layer that sounds electrical
  // rather than merely noisy.
  const stepFast = ctx.createBufferSource();
  stepFast.buffer = steppedRandomBuffer(ctx, STEP_BASE_HZ, STEP_BASE_SECONDS);
  stepFast.loop = true;
  stepFast.playbackRate.value = 0.32 + 1.1 * i;
  const stepDepth = ctx.createGain();
  stepDepth.gain.value = wantStep * fit;
  stepFast.connect(stepDepth).connect(band.frequency);

  // Destination 2: bandwidth, and the drift stage above.
  //
  // The rate here is deliberate and it is narrow. Around 10-18Hz is where an
  // arc audibly gutters: slow enough to survive being averaged into a 20ms
  // window, fast enough not to be heard as the shape of the sound instead of
  // its texture. Move this layer up out of that band and the sizzle measures -
  // and sounds - like static filtered noise no matter how much fine grit sits
  // on top of it.
  const stepSlow = ctx.createBufferSource();
  stepSlow.buffer = steppedRandomBuffer(ctx, STEP_BASE_HZ, STEP_BASE_SECONDS);
  stepSlow.loop = true;
  stepSlow.playbackRate.value = 0.08 + 0.07 * i;
  const qDepth = ctx.createGain();
  qDepth.gain.value = Math.min(q - 1.5, 1 + 3 * i);
  stepSlow.connect(qDepth).connect(band.Q);

  // Destination 3: amplitude, from both sample & holds. This is the layer the
  // ear reads as "alive", and the two rates do different jobs. The fast one is
  // grit inside a syllable; the slow one is the arc guttering and recovering
  // over tens of milliseconds, and it is the only modulator slow enough to
  // survive being averaged into a 20ms window. Starve the slow one and the
  // whole thing measures - and sounds - like static noise with a filter on it.
  //
  // The fast one is rounded off first: raw stepped gain is a hard discontinuity
  // every step, which is a buzz at the step rate rather than a flutter.
  const ampSmooth = ctx.createBiquadFilter();
  ampSmooth.type = "lowpass";
  ampSmooth.frequency.value = 300;
  ampSmooth.Q.value = 0.7;
  // Both depths keep a floor that does not scale with intensity. An arc is
  // irregular at every power setting - intensity decides how violent and how
  // bright it is, not whether it flickers at all - and letting these go to zero
  // with it made a low-intensity sizzle indistinguishable from static noise.
  // Each stays strictly below 1 so its stage never changes sign.
  const ampFast = ctx.createGain();
  ampFast.gain.value = 0.35 + 0.3 * i;
  stepFast.connect(ampSmooth).connect(ampFast).connect(amp.gain);

  const ampSlow = ctx.createGain();
  ampSlow.gain.value = 0.5 + 0.3 * i;
  stepSlow.connect(ampSlow).connect(drift.gain);

  // The sparks.
  //
  // Each impulse in the buffer is 1-3 samples. Broadband, but far too short to
  // survive next to a continuous fry: averaged over even a millisecond its
  // energy disappears under the bed, which is why the first version of this was
  // inaudible and measured zero discrete transients despite being wired
  // correctly and rendering. Ringing each impulse through a resonant bandpass
  // turns it into a few milliseconds of decaying tick - which is both what a
  // spark actually sounds like and what makes it read as an event rather than
  // as more noise. The level then has to sit ABOVE the bed, not under it,
  // because a crackle that does not stick out is not a crackle.
  const sparks = ctx.createBufferSource();
  sparks.buffer = crackleBuffer(
    ctx,
    CRACKLE_BASE_SECONDS,
    CRACKLE_BASE_DENSITY
  );
  // Rate matters as much as level. Run fast enough and the pops overlap into a
  // continuous ring - measured, crackle:1 at 130 pops/s had a HIGHER RMS than
  // the bed and still read as zero discrete transients, because nothing stood
  // out from its own neighbours. Sparse is the whole point: single sparks with
  // audible gaps between them.
  sparks.loop = true;
  sparks.playbackRate.value = clamp(0.12 + 0.5 * ck, 0.04, 3);
  const sparkRing = ctx.createBiquadFilter();
  sparkRing.type = "bandpass";
  sparkRing.frequency.value = clamp(bandHz * 1.35, 1800 * SIZZLE_PITCH, 9000 * SIZZLE_PITCH);
  // Low Q on purpose. A narrow ring rejects most of an impulse's energy, so it
  // costs peak height to buy ring length - exactly backwards for something that
  // has to punch through a continuous bed. Wide and short is both louder per
  // spark and less of a contribution to the local median it has to beat.
  sparkRing.Q.value = 4;
  const sparkBody = ctx.createBiquadFilter();
  sparkBody.type = "highpass";
  sparkBody.frequency.value = 1100 * SIZZLE_PITCH;
  sparkBody.Q.value = 0.7;
  const crackleLevel = ctx.createGain();
  crackleLevel.gain.value = 12 * ck * CRACKLE_LEVEL;
  sparks.connect(sparkRing).connect(sparkBody).connect(crackleLevel).connect(tame);

  const sources = [carrier, fm, stepFast, stepSlow, sparks];

  return {
    out,
    band,
    fmDepth,
    stepDepth,
    qDepth,
    ampFast,
    ampSlow,
    stepRate: stepFast.playbackRate,
    crackleLevel,
    crackleRate: sparks.playbackRate,
    start(when: number) {
      for (const src of sources) {
        src.start(when, src.buffer ? randomOffset(src.buffer) : 0);
      }
    },
    stop(when: number) {
      for (const src of sources) src.stop(when);
    },
  };
}

/**
 * A one-shot arc. Fast spit, then a fry that fades over the tail, which is what
 * gives every voice its length without the body having to be long.
 */
export function sizzle(
  buses: Buses,
  when: number,
  opts: {
    duration: number;
    level: number;
    /** 0-1, how violent. */
    intensity?: number;
    bandFrom?: number;
    bandTo?: number;
    /** Spark density, 0-1. */
    crackle?: number;
    send?: number;
    attack?: number;
  }
): void {
  const {
    duration,
    level,
    intensity = 0.6,
    bandFrom = 2800,
    bandTo = 6000,
    crackle = 0.3,
    send = 0,
    attack = Math.min(0.014, duration * 0.2),
  } = opts;
  const { ctx } = buses;

  // Bail before building anything when the layer is off. Not just an
  // optimisation: exponentialRampToValueAtTime THROWS on a target of exactly 0,
  // so a zero level would raise on every single one-shot.
  const peak = level * SIZZLE_LEVEL;
  if (peak <= NEAR_ZERO) return;

  const from = Math.max(120, bandFrom * SIZZLE_PITCH);
  const to = Math.max(120, bandTo * SIZZLE_PITCH);

  // Depths are scaled from the LOW end of the sweep, not its start or its mean,
  // because the modulation is in Hz: sized for the top it would swamp the
  // bottom. floorHz then caps the total so the cutoff cannot reach zero however
  // violent the caller asks for.
  const rig = buildSizzle(ctx, {
    bandHz: Math.min(from, to) * 1.4,
    floorHz: Math.min(from, to),
    intensity,
    crackle,
  });

  rig.band.frequency.setValueAtTime(from, when);
  rig.band.frequency.exponentialRampToValueAtTime(to, when + duration);

  const env = ctx.createGain();
  env.gain.setValueAtTime(NEAR_ZERO, when);
  env.gain.exponentialRampToValueAtTime(peak, when + attack);
  // Relative to `peak`, not to `level`: scaled off the raw level this sustain
  // exceeded the attack peak whenever SIZZLE_LEVEL fell below 0.3, so the arc
  // swelled after the strike instead of decaying from it.
  env.gain.exponentialRampToValueAtTime(
    peak * 0.3,
    when + attack + (duration - attack) * 0.3
  );
  env.gain.exponentialRampToValueAtTime(NEAR_ZERO, when + duration);

  rig.out.connect(env);
  emit(buses, env, send);

  rig.start(when);
  rig.stop(when + duration + 0.02);
}

// --- the hum rig ----------------------------------------------------------

/**
 * The hum's character, in one place, for the same reason MIX and SHAPE exist:
 * tuning it should mean editing this object, not the voice body. Read at build
 * time, so a voice must be rebuilt to pick up a change.
 */
export const HUM: {
  partials: {
    ratio: number;
    type: OscillatorType;
    gain: number;
    /** Whether `setChorus` controls this partial's level. */
    chorus?: boolean;
  }[];
  vibrato: { rate: number; depth: number }[];
  breatheBase: number;
  breathe: { rate: number; depth: number }[];
  cutoffMin: number;
  cutoffSpan: number;
  q: number;
  widthMin: number;
  widthSpan: number;
  fifthMin: number;
  fifthSpan: number;
} = {
  /**
   * Three partials is the whole trick: a fundamental alone is a test tone,
   * fundamental plus octave is an organ, and it is the FIFTH that makes the ear
   * hear a resonating object rather than a note. It is the quietest layer and
   * it is the one doing the characterisation, which is why it is also the one
   * `setChorus` moves.
   *
   * The fundamental is the only sawtooth. Its harmonic series is the body; the
   * two upper partials are triangles because stacking three saws inside two
   * octaves just adds beating between harmonics that are already there, and
   * that beating is exactly the roughness this voice exists to avoid.
   *
   * Tuned by ear, the octave ended up LOUDER than the fundamental, which is not
   * what the paragraph above predicted: it puts the perceived pitch an octave
   * up and makes the blade read as thinner and more focused. That is also why
   * the cutoff floor below came down so far - it compensates.
   */
  partials: [
    { ratio: 1, type: "sawtooth", gain: 0.68 },
    { ratio: 2, type: "triangle", gain: 1 },
    { ratio: 1.5, type: "triangle", gain: 0.26, chorus: true },
  ],

  /**
   * Vibrato, as two sine LFOs rather than one, in cents.
   *
   * 5.2 and 3.7 Hz is not an arbitrary pair. Their ratio is irrational enough
   * that the combined excursion does not repeat on any timescale a listener can
   * latch onto, which is the difference between "a hum" and "a synth patch with
   * vibrato on it". A single LFO here reads as a wobble effect within about two
   * seconds. The second is deliberately shallower so it perturbs the first
   * rather than competing with it.
   */
  vibrato: [
    { rate: 12, depth: 6 },
    { rate: 3.7, depth: 2.6 },
  ],

  /**
   * Amplitude breathing, same incommensurate-rates rule.
   *
   * These were tuned by ear well past what the original design intended: the
   * two depths sum to 0.6 against a base of 1, so the stage swings 0.4 to 1.6 -
   * about 12 dB - rather than the gentle 16% it started at. That is a deep,
   * audible throb, and it is deliberate.
   *
   * The invariant that still matters is the sign: base minus the summed depths
   * must stay ABOVE ZERO. At 0.4 there is room, but there is no longer much of
   * it. Push either depth past 0.5, or drop the base, and the stage crosses
   * zero, |gain| folds the waveform back on itself, and the voice starts
   * distorting instead of breathing.
   */
  breatheBase: 1,
  breathe: [
    { rate: 0.7, depth: 0.3 },
    { rate: 0.31, depth: 0.3 },
  ],

  /**
   * `setBrightness` maps 0-1 onto this cutoff range. The floor came down a long
   * way from its original 800 Hz, which is what keeps the boosted octave
   * partial above from making a dull beam sound bright.
   */
  cutoffMin: 350,
  cutoffSpan: 2100,

  /**
   * Gentle on purpose. The previous continuous voices ran Q 9 and Q 7, and a
   * resonant peak sweeping over a low fundamental is a large part of what made
   * the cursor tone read as a small engine. At 1 the filter shapes the
   * sawtooth's harmonic series without ever announcing itself.
   */
  q: 1,

  /**
   * Stereo spread of the detuned pair, as `setChorus` opens it. Nearly centred
   * at rest and very wide when busy, so a folded beam opens up rather than
   * merely getting louder.
   */
  widthMin: 0.06,
  widthSpan: 0.58,

  /** The fifth's level range, likewise driven by `setChorus`. */
  fifthMin: 0.26,
  fifthSpan: 0.16,
};

/**
 * A held beam: warm, harmonic, and containing no noise whatsoever.
 *
 * Every parameter the game can move is a setter taking an absolute time and a
 * time constant, and every one of them goes through setTargetAtTime. That is
 * not a style choice - the beam voice is re-driven on every single board edit,
 * and a stepped assignment to any of these would click on every tap.
 *
 * Frequencies passed in are pre-PITCH, matching `beamCore` and `resonantClick`,
 * so the file keeps exactly one global transposition knob.
 */
interface HumRig {
  /** Presence. The caller automates this gain and connects it onward. */
  out: GainNode;
  /** Fundamental, pre-PITCH. Upper partials follow their ratios. */
  setPitch(hz: number, when: number, timeConstant?: number): void;
  /** 0-1 onto the lowpass cutoff. Dull to open. */
  setBrightness(value: number, when: number, timeConstant?: number): void;
  /** 0-1 unsteadiness: vibrato depth and rate together. */
  setWobble(value: number, when: number, timeConstant?: number): void;
  /** 0-1 thickness: the fifth's level and the stereo spread. */
  setChorus(value: number, when: number, timeConstant?: number): void;
  /** Detune between the two panned copies, in cents. Wide is sour. */
  setSpread(cents: number, when: number, timeConstant?: number): void;
  start(when: number): void;
  stop(when: number): void;
}

function buildHum(
  ctx: AudioContext,
  opts: {
    /** Starting fundamental, pre-PITCH. */
    hz: number;
    /** Drive, from MIX. */
    level: number;
  }
): HumRig {
  const { hz, level } = opts;

  const out = ctx.createGain();
  out.gain.value = 1;

  const drive = ctx.createGain();
  drive.gain.value = level;
  drive.connect(out);

  // The breathing stage. Its intrinsic value is the base and the LFOs sum onto
  // it, which is why the depths above have to stay inside the base.
  const breathe = ctx.createGain();
  breathe.gain.value = HUM.breatheBase;
  breathe.connect(drive);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.Q.value = HUM.q;
  filter.frequency.value = HUM.cutoffMin + HUM.cutoffSpan * 0.4;
  filter.connect(breathe);

  // Two copies of the whole stack, detuned against each other and panned apart.
  // The beating between them IS the aura; it costs six oscillators and no
  // reverb. One shared filter downstream is fine - a biquad processes a stereo
  // input per channel, so the panning survives it.
  const partials: { gain: GainNode; chorus: boolean }[] = [];
  const oscs: { osc: OscillatorNode; ratio: number }[] = [];
  const detunes: { param: AudioParam; sign: number }[] = [];
  const pans: { param: AudioParam; sign: number }[] = [];

  for (const sign of [-1, 1]) {
    const panner = ctx.createStereoPanner();
    panner.pan.value = sign * HUM.widthMin;
    panner.connect(filter);
    pans.push({ param: panner.pan, sign });

    for (const partial of HUM.partials) {
      const partialGain = ctx.createGain();
      partialGain.gain.value = partial.gain;
      partialGain.connect(panner);
      partials.push({ gain: partialGain, chorus: partial.chorus === true });

      const osc = ctx.createOscillator();
      osc.type = partial.type;
      osc.frequency.value = hz * partial.ratio * PITCH;
      // Intrinsic value is the static spread; the vibrato LFOs connect to the
      // same param and Web Audio sums them.
      osc.detune.value = sign * HUM.vibrato[0].depth;
      osc.connect(partialGain);

      oscs.push({ osc, ratio: partial.ratio });
      detunes.push({ param: osc.detune, sign });
    }
  }

  const vibratos = HUM.vibrato.map(({ rate, depth }) => {
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = rate;

    const depthGain = ctx.createGain();
    depthGain.gain.value = depth;
    lfo.connect(depthGain);
    for (const { param } of detunes) depthGain.connect(param);

    return { lfo, depthGain, rate, depth };
  });

  const breathers = HUM.breathe.map(({ rate, depth }) => {
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = rate;

    const depthGain = ctx.createGain();
    depthGain.gain.value = depth;
    lfo.connect(depthGain).connect(breathe.gain);

    return lfo;
  });

  const sources = [
    ...oscs.map((o) => o.osc),
    ...vibratos.map((v) => v.lfo),
    ...breathers,
  ];

  return {
    out,
    setPitch(value, when, timeConstant = 0.2) {
      const base = Math.max(20, value) * PITCH;
      for (const { osc, ratio } of oscs) {
        osc.frequency.setTargetAtTime(base * ratio, when, timeConstant);
      }
    },
    setBrightness(value, when, timeConstant = 0.2) {
      filter.frequency.setTargetAtTime(
        HUM.cutoffMin + HUM.cutoffSpan * clamp(value, 0, 1),
        when,
        timeConstant
      );
    },
    setWobble(value, when, timeConstant = 0.25) {
      const w = clamp(value, 0, 1);
      for (const { depthGain, lfo, rate, depth } of vibratos) {
        // Depth and rate move together: an emitter that wanders further also
        // wanders faster. Moving only the depth reads as a deeper vibrato,
        // which is a musical effect rather than an instability.
        depthGain.gain.setTargetAtTime(depth * (1 + 2 * w), when, timeConstant);
        lfo.frequency.setTargetAtTime(rate * (1 + 0.28 * w), when, timeConstant);
      }
    },
    setChorus(value, when, timeConstant = 0.3) {
      const c = clamp(value, 0, 1);
      for (const { gain, chorus } of partials) {
        if (!chorus) continue;
        gain.gain.setTargetAtTime(
          HUM.fifthMin + HUM.fifthSpan * c,
          when,
          timeConstant
        );
      }
      for (const { param, sign } of pans) {
        param.setTargetAtTime(
          sign * (HUM.widthMin + HUM.widthSpan * c),
          when,
          timeConstant
        );
      }
    },
    setSpread(cents, when, timeConstant = 0.3) {
      for (const { param, sign } of detunes) {
        param.setTargetAtTime(sign * cents, when, timeConstant);
      }
    },
    start(when: number) {
      for (const src of sources) src.start(when);
    },
    stop(when: number) {
      for (const src of sources) src.stop(when);
    },
  };
}

// --- the strike primitives ------------------------------------------------

/**
 * The resonant body under the sizzle. Detuned sawtooths beating against each
 * other through a resonant lowpass; the beating is what stops it sounding like
 * a clean musical note.
 *
 * Retuned upward from the old drone: the body of a laser strike sits in the
 * mid band, not the bass. Anything with real weight below 200Hz stops reading
 * as an emitter and starts reading as a hum, which is how the last pass ended
 * up sounding like a lightsaber.
 */
function beamCore(
  buses: Buses,
  when: number,
  opts: {
    fromHz: number;
    toHz?: number;
    duration: number;
    level: number;
    q?: number;
    detune?: number;
    send?: number;
    attack?: number;
  }
): void {
  const {
    fromHz: rawFromHz,
    toHz: rawToHz = rawFromHz,
    duration,
    level,
    q = 9,
    detune = 15,
    send = 0,
    attack = 0.008,
  } = opts;
  const { ctx } = buses;

  const fromHz = rawFromHz * PITCH;
  const toHz = rawToHz * PITCH;

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.Q.value = q;
  filter.frequency.setValueAtTime(Math.min(16000, fromHz * 5), when);
  filter.frequency.exponentialRampToValueAtTime(
    Math.max(180, toHz * 3),
    when + duration
  );

  const gain = envelope(ctx, level, when, attack, duration);
  filter.connect(gain);
  emit(buses, gain, send);

  for (const cents of [-detune, detune]) {
    const osc = tone(ctx, "sawtooth", when, duration);
    osc.detune.setValueAtTime(cents, when);
    osc.frequency.setValueAtTime(fromHz, when);
    if (toHz !== fromHz) {
      osc.frequency.exponentialRampToValueAtTime(toHz, when + duration * 0.85);
    }
    osc.connect(filter);
  }
}

/**
 * A mechanical click, synthesized the way real ones are: a near-instantaneous
 * noise impulse rung through high-Q bandpasses. The ring decay comes from Q,
 * not from an envelope, which is what makes it read as a physical object
 * rather than a shaped beep.
 */
function resonantClick(
  buses: Buses,
  when: number,
  opts: {
    level: number;
    partials: [number, number][];
    q?: number;
    send?: number;
  }
): void {
  const { level, partials, q = 20, send = 0 } = opts;
  const { ctx } = buses;

  const impulse = noise(ctx, when, 0.004);
  const shaper = ctx.createGain();
  shaper.gain.setValueAtTime(NEAR_ZERO, when);
  shaper.gain.exponentialRampToValueAtTime(1, when + 0.0004);
  shaper.gain.exponentialRampToValueAtTime(NEAR_ZERO, when + 0.004);
  impulse.connect(shaper);

  const out = ctx.createGain();
  out.gain.value = level;

  for (const [freq, weight] of partials) {
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.Q.value = q;
    band.frequency.value = freq * PITCH;

    const partialGain = ctx.createGain();
    partialGain.gain.value = weight;
    shaper.connect(band).connect(partialGain).connect(out);
  }

  emit(buses, out, send);
}

// --- one-shot voices ------------------------------------------------------

/**
 * Mirror seated into its mount and the beam striking it. Contactor, then a
 * body falling through the mid band, then the arc frying out over ~350ms.
 * Descending is what tells this apart from rotate.
 */
export function mirrorPlace(buses: Buses, when: number): void {
  resonantClick(buses, when, {
    level: MIX.mirrorPlace * 1.5,
    partials: [
      [1150, 1],
      [1900, 0.5],
      [310, 0.5],
    ],
    send: SEND.mirror,
  });

  beamCore(buses, when + 0.005, {
    fromHz: 660,
    toHz: 250,
    duration: SHAPE.mirror,
    level: MIX.mirrorPlace * 0.85,
    q: 8,
    send: SEND.mirror * 0.6,
  });

  sizzle(buses, when + 0.003, {
    duration: SHAPE.mirrorSizzle,
    level: MIX.mirrorPlace * 1.1,
    intensity: 0.62,
    bandFrom: 5400,
    bandTo: 2300,
    crackle: 0.34,
    send: SEND.mirror,
  });
}

/**
 * Mirror cycled / to \. Same mount, same contactor, but the arc climbs instead
 * of falling, so the two actions are one mechanism rather than two noises.
 */
export function mirrorRotate(buses: Buses, when: number): void {
  resonantClick(buses, when, {
    level: MIX.mirrorRotate * 1.4,
    partials: [
      [960, 1],
      [1620, 0.45],
      [270, 0.45],
    ],
    send: SEND.mirror,
  });

  beamCore(buses, when + 0.005, {
    fromHz: 300,
    toHz: 700,
    duration: SHAPE.mirror * 0.9,
    level: MIX.mirrorRotate * 0.7,
    q: 8,
    send: SEND.mirror * 0.6,
  });

  sizzle(buses, when + 0.003, {
    duration: SHAPE.mirrorSizzle * 0.9,
    level: MIX.mirrorRotate * 1.05,
    intensity: 0.55,
    bandFrom: 2500,
    bandTo: 6400,
    crackle: 0.28,
    send: SEND.mirror,
  });
}

/**
 * Mirror released: the mount lets go and the arc collapses. Longest and
 * dirtiest of the three, with the most sparks, because losing a beam path
 * should sound less controlled than making one.
 */
export function mirrorRemove(buses: Buses, when: number): void {
  resonantClick(buses, when, {
    level: MIX.mirrorRemove * 1.2,
    partials: [
      [560, 1],
      [210, 0.7],
    ],
    q: 13,
    send: SEND.mirror,
  });

  beamCore(buses, when + 0.006, {
    fromHz: 620,
    toHz: 150,
    duration: SHAPE.mirrorRemove,
    level: MIX.mirrorRemove * 0.7,
    q: 7,
    detune: 22,
    send: SEND.mirror * 0.6,
  });

  sizzle(buses, when + 0.004, {
    duration: SHAPE.mirrorRemoveSizzle,
    level: MIX.mirrorRemove * 1.05,
    intensity: 0.78,
    bandFrom: 4600,
    bandTo: 1500,
    crackle: 0.48,
    send: SEND.mirror,
  });
}

/** Minor-pentatonic offsets, so the lock climbs as digits are collected. */
const DIGIT_STEPS = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22];
/** C4. An octave below a game pickup jingle, so it reads as equipment. */
const DIGIT_BASE_HZ = 261.63 * PITCH;

/**
 * A code digit was collected in order: the beam locking onto a target. `index`
 * is zero-based, so the last digit of the code is always the highest. The one
 * voice where the pitch has to survive, so the arc here is clean and short and
 * gets out of the tone's way.
 */
export function digitCollected(
  buses: Buses,
  when: number,
  index: number
): void {
  const d = SHAPE.digit;
  const step = DIGIT_STEPS[clamp(index, 0, DIGIT_STEPS.length - 1)];
  const freq = DIGIT_BASE_HZ * 2 ** (step / 12);

  // The arc striking the target, ahead of the lock. The band tracks the digit's
  // pitch so the tenth digit sounds hotter than the first, but it is clamped
  // into the arc's 2-9kHz range: unclamped, the top of the scale lands the
  // sweep near 17kHz, where it is both inaudible and, where it is audible,
  // painful.
  sizzle(buses, when, {
    duration: SHAPE.digitSizzle,
    level: MIX.digit * 0.8,
    intensity: 0.4,
    bandFrom: clamp(freq * 7, 2200, 4200),
    bandTo: clamp(freq * 15, 4500, 8500),
    crackle: 0.2,
    send: SEND.digit,
  });

  // The lock itself, held rather than struck.
  beamCore(buses, when + 0.03, {
    fromHz: freq * 0.55,
    toHz: freq,
    duration: d,
    level: MIX.digit * 1.15,
    q: 11,
    detune: 9,
    send: SEND.digit,
  });

  // An inharmonic partial reads as instrumentation rather than music.
  const shimmer = tone(buses.ctx, "triangle", when + 0.05, d * 0.55);
  shimmer.frequency.setValueAtTime(freq * 2.41, when + 0.05);
  const shimmerGain = envelope(
    buses.ctx,
    MIX.digit * 0.3,
    when + 0.05,
    0.01,
    d * 0.55
  );
  shimmer.connect(shimmerGain);
  emit(buses, shimmerGain, SEND.digit);
}

/**
 * Tapped a number tile or the flag: the beam hitting a blast shield. Nearly dry
 * on purpose, so it sounds absorbed rather than resonant, and the arc is
 * smothered low and short instead of frying out.
 */
export function illegalTap(buses: Buses, when: number): void {
  const d = SHAPE.illegalTap;
  const { ctx } = buses;

  resonantClick(buses, when, {
    level: MIX.illegalTap * 0.85,
    partials: [
      [150, 1],
      [240, 0.5],
    ],
    q: 8,
    send: SEND.illegalTap,
  });

  const thud = noise(ctx, when, d);
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.Q.value = 5;
  filter.frequency.setValueAtTime(340 * PITCH, when);
  filter.frequency.exponentialRampToValueAtTime(95, when + d);
  const gain = envelope(ctx, MIX.illegalTap * 0.75, when, 0.002, d);
  thud.connect(filter).connect(gain);
  emit(buses, gain, SEND.illegalTap);

  sizzle(buses, when, {
    duration: SHAPE.illegalSizzle,
    level: MIX.illegalTap * 0.045,
    intensity: 0.7,
    bandFrom: 1700,
    bandTo: 850,
    // Barely any sparks. This is a beam being absorbed by a blast shield, and
    // it measured as the sparkiest voice in the app, which is backwards: a
    // blocked beam should read dead, not energetic.
    crackle: 0.08,
    send: SEND.illegalTap,
  });
}

/**
 * The beam newly hit a wrong number, or reached the flag before the code was
 * complete. An emitter losing containment: low, detuned, sagging, and arcing
 * hard in a band well below where a healthy beam sits. Deliberately not a
 * musical interval.
 */
export function wrongState(buses: Buses, when: number): void {
  const d = SHAPE.wrongState;
  const { ctx } = buses;

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.Q.value = 9;
  filter.frequency.setValueAtTime(900 * PITCH, when);
  filter.frequency.exponentialRampToValueAtTime(150, when + d);

  const gain = envelope(ctx, MIX.wrongState * 1.2, when, 0.006, d);
  filter.connect(gain);
  emit(buses, gain, SEND.wrongState);

  // Close, non-harmonic detunings beat into a rough buzz rather than a chord.
  for (const [freq, cents] of [
    [72, -30],
    [74.5, 25],
    [108, 40],
  ] as const) {
    const osc = tone(ctx, "sawtooth", when, d);
    osc.detune.setValueAtTime(cents, when);
    osc.frequency.setValueAtTime(freq, when);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.72, when + d);
    osc.connect(filter);
  }

  // Maximum violence and maximum sparks: this is the sound of the arc going
  // where it should not.
  sizzle(buses, when, {
    duration: SHAPE.wrongSizzle,
    level: MIX.wrongState * 0.85,
    intensity: 0.95,
    bandFrom: 2300,
    bandTo: 900,
    crackle: 0.6,
    send: SEND.wrongState,
  });
}

/**
 * HINT placed or fixed a mirror. A guided beam sweeping up and settling.
 * Deliberately the cleanest arc in the set, low intensity and almost no sparks,
 * so it reads as the system assisting rather than something the player earned.
 */
export function hintChime(buses: Buses, when: number): void {
  const d = SHAPE.hint;

  beamCore(buses, when + 0.04, {
    fromHz: 180,
    toHz: 360,
    duration: d,
    level: MIX.hint * 1.1,
    q: 12,
    detune: 7,
    attack: 0.04,
    send: SEND.hint,
  });

  sizzle(buses, when, {
    duration: SHAPE.hintSizzle,
    level: MIX.hint * 0.55,
    intensity: 0.3,
    bandFrom: 2600,
    bandTo: 7200,
    crackle: 0.12,
    attack: 0.09,
    send: SEND.hint,
  });
}

/** Generic UI tick for buttons, modals and intro beats. */
export function uiTick(buses: Buses, when: number): void {
  // Wider bands than the mirror click: a 4ms impulse carries little energy
  // through a very narrow filter, and this needs to stay audible while being
  // the smallest sound in the app.
  resonantClick(buses, when, {
    level: MIX.uiTick,
    partials: [
      [1250, 1],
      [2000, 0.45],
      [520, 0.6],
    ],
    q: 11,
    send: SEND.uiTick,
  });

  // A whisper of arc, only so the UI belongs to the same machine as the board.
  // Any more and every button press becomes an event.
  sizzle(buses, when, {
    duration: SHAPE.uiTickSizzle,
    level: MIX.uiTick * 0.014,
    intensity: 0.45,
    bandFrom: 5200,
    bandTo: 3400,
    crackle: 0.2,
    send: SEND.uiTick,
  });
}

/**
 * PLAY was pressed and the laser is tracing the button perimeter. A quiet
 * spin-up under the lap animation, resolved by navFire when the route changes:
 * the arc strikes weakly and grows as the capacitor fills.
 */
export function navCharge(buses: Buses, when: number): void {
  const d = SHAPE.navCharge;

  beamCore(buses, when, {
    fromHz: 110,
    toHz: 330,
    duration: d,
    level: MIX.navCharge * 0.9,
    q: 12,
    attack: d * 0.6,
    send: SEND.nav * 0.6,
  });

  sizzle(buses, when, {
    duration: d,
    level: MIX.navCharge * 0.8,
    intensity: 0.5,
    bandFrom: 2000,
    bandTo: 7000,
    crackle: 0.3,
    attack: d * 0.72,
    send: SEND.nav * 0.6,
  });
}

/** The lap closed and the route is changing: the beam fires. */
export function navFire(buses: Buses, when: number): void {
  const d = SHAPE.navFire;

  resonantClick(buses, when, {
    level: MIX.navFire * 1.1,
    partials: [
      [820, 1],
      [1450, 0.5],
      [260, 0.6],
    ],
    q: 15,
    send: SEND.nav,
  });

  beamCore(buses, when + 0.004, {
    fromHz: 620,
    toHz: 140,
    duration: d * 0.85,
    level: MIX.navFire,
    q: 10,
    detune: 20,
    send: SEND.nav,
  });

  sizzle(buses, when + 0.002, {
    duration: SHAPE.navFireSizzle,
    level: MIX.navFire * 1.25,
    intensity: 0.8,
    bandFrom: 7200,
    bandTo: 2000,
    crackle: 0.42,
    send: SEND.nav,
  });
}

/**
 * Part one of the victory sting, fired the instant the board is solved. Spins
 * up and holds a quiet tail so it is still sounding when the route change to
 * /complete lands roughly 350ms later.
 */
export function victoryCharge(buses: Buses, when: number): void {
  const rise = SHAPE.victoryCharge;
  const total = rise + SHAPE.victoryChargeTail;
  const { ctx } = buses;

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.Q.value = 13;
  filter.frequency.setValueAtTime(200, when);
  filter.frequency.exponentialRampToValueAtTime(3200, when + rise);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(NEAR_ZERO, when);
  gain.gain.exponentialRampToValueAtTime(MIX.victoryCharge * 1.2, when + rise);
  gain.gain.exponentialRampToValueAtTime(
    MIX.victoryCharge * 0.4,
    when + rise + 0.1
  );
  gain.gain.exponentialRampToValueAtTime(NEAR_ZERO, when + total);
  filter.connect(gain);
  emit(buses, gain, SEND.victory);

  for (const cents of [-16, 16]) {
    const osc = tone(ctx, "sawtooth", when, total);
    osc.detune.setValueAtTime(cents, when);
    osc.frequency.setValueAtTime(55 * PITCH, when);
    osc.frequency.exponentialRampToValueAtTime(440, when + rise);
    osc.connect(filter);
  }

  // The arc climbing with the capacitor. Clean, because this is the machine
  // working correctly, not failing.
  sizzle(buses, when, {
    duration: rise + 0.12,
    level: MIX.victoryCharge * 0.75,
    intensity: 0.42,
    bandFrom: 2200,
    bandTo: 8000,
    crackle: 0.22,
    attack: rise * 0.78,
    send: SEND.victory,
  });
}

/**
 * Part two, landing on the complete screen's checkmark. The beam locks and
 * holds, then the aura carries it out. The one voice allowed real presence, and
 * the one that has to feel like a reward: the chord underneath is root, fifth
 * and octave, which is why it stays positive despite a violent arc on top.
 */
export function victoryResolve(buses: Buses, when: number): void {
  const d = SHAPE.victoryResolve;
  const lock = when + 0.16;
  const { ctx } = buses;

  // The strike, at the moment of lock.
  resonantClick(buses, lock, {
    level: MIX.victoryResolve * 0.9,
    partials: [
      [1320, 1],
      [2200, 0.55],
      [440, 0.6],
    ],
    q: 16,
    send: SEND.victory,
  });

  // The arc arriving: rising into the lock, then frying out across the tail.
  sizzle(buses, when, {
    duration: 0.3,
    level: MIX.victoryResolve * 0.5,
    intensity: 0.5,
    bandFrom: 2600,
    bandTo: 8200,
    crackle: 0.3,
    attack: 0.14,
    send: SEND.victory,
  });

  sizzle(buses, lock, {
    duration: SHAPE.victoryResolveSizzle,
    level: MIX.victoryResolve * 0.62,
    intensity: 0.62,
    bandFrom: 7600,
    bandTo: 2600,
    crackle: 0.34,
    send: SEND.victory,
  });

  // The sustained beam it lands on. Sawtooths through a slowly closing
  // resonant filter, so the tail darkens instead of ringing like a chime.
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.Q.value = 8;
  filter.frequency.setValueAtTime(3400 * PITCH, lock);
  filter.frequency.exponentialRampToValueAtTime(420, when + d);

  const body = envelope(ctx, MIX.victoryResolve * 1.5, lock, 0.02, d);
  filter.connect(body);
  emit(buses, body, SEND.victory);

  for (const [ratio, cents] of [
    [1, -8],
    [1, 9],
    [1.5, 4],
    [2, -5],
  ] as const) {
    const osc = tone(ctx, "sawtooth", lock, d);
    osc.detune.setValueAtTime(cents, lock);
    osc.frequency.setValueAtTime(220 * PITCH * ratio, lock);
    osc.connect(filter);
  }
}

// --- continuous voices ----------------------------------------------------

export interface CursorVoice {
  /** Normalized 0-1 cursor speed. */
  setSpeed(speed: number): void;
  stop(): void;
}

/**
 * Pitch of the cursor hum, pre-PITCH, so the audible values are half these:
 * 105 Hz at rest rising to 150 Hz at full speed. That band is chosen to sit
 * above where a hum turns into a motor - the old voice ran a 52 Hz sawtooth
 * pair under a resonant sweep, which is a small engine - and below where it
 * turns into a whine.
 *
 * The rise with speed is the Doppler idea, not physics: a saber swung fast
 * reads as pitching up, and the ear accepts it as effort.
 */
const CURSOR_IDLE_HZ = 210;
const CURSOR_FAST_HZ = 300;

/**
 * The home page trail tone: silent at rest, then swells, brightens and pitches
 * up with pointer speed. Same `buildHum` instrument as the in-game beam, at a
 * different setting.
 */
export function createCursorVoice({ ctx, bed }: Buses): CursorVoice {
  const now = ctx.currentTime;

  const rig = buildHum(ctx, { hz: CURSOR_IDLE_HZ, level: MIX.cursor });
  // Start silent; setSpeed opens it only when the pointer is moving.
  rig.out.gain.value = NEAR_ZERO;

  // Arrival is a separate stage from presence on purpose. setSpeed runs every
  // animation frame and owns rig.out.gain outright; a fade-in scheduled on that
  // same param would be overwritten by the first frame and become a click.
  const fade = ctx.createGain();
  fade.gain.setValueAtTime(NEAR_ZERO, now);
  fade.gain.setTargetAtTime(1, now, 0.6);
  rig.out.connect(fade).connect(bed);

  rig.start(now);

  let stopped = false;

  return {
    setSpeed(speed: number) {
      if (stopped) return;
      const s = clamp(speed, 0, 1);
      const t = ctx.currentTime;

      // Short time constants so the hum tracks the pointer rather than lagging
      // behind it, but not so short that it zippers. Squared, so slow drift
      // stays near silent and only a real swing opens it up.
      rig.out.gain.setTargetAtTime(s * s, t, 0.05);
      rig.setPitch(CURSOR_IDLE_HZ + (CURSOR_FAST_HZ - CURSOR_IDLE_HZ) * s, t, 0.06);
      rig.setBrightness(0.14 + 0.66 * s, t, 0.05);
      rig.setChorus(0.3 + 0.4 * s, t, 0.08);
      rig.setWobble(0.12 + 0.28 * s, t, 0.1);
    },
    stop() {
      if (stopped) return;
      stopped = true;
      const t = ctx.currentTime;
      fade.gain.cancelScheduledValues(t);
      fade.gain.setTargetAtTime(NEAR_ZERO, t, 0.05);
      rig.stop(t + 0.3);
    },
  };
}

export interface BeamVoice {
  setState(s: {
    /** Beam path length in cells. Typically 5-40. */
    length: number;
    /** Mirrors the beam bounces off. Typically 0-20. */
    bounces: number;
    /** What the beam path currently ends on. */
    terminatedBy: "flag" | "obstacle" | "boundary" | null;
    /** The board is in a wrong state. */
    mistake: boolean;
  }): void;
  /** Multiplier on top of the path-driven presence. 1 = full in-game level. */
  setPresence(level: number): void;
  stop(): void;
}

/**
 * Beam pitch, pre-PITCH, so the audible band is 96-150 Hz. A longer path
 * resonates lower, the same way a longer string does, which gives the whole
 * solve a slow downward arc as the beam grows.
 */
const BEAM_SHORT_HZ = 300;
const BEAM_LONG_HZ = 192;

/** Detune between the panned copies. Narrow is a blade, wide is a fault. */
const BEAM_SPREAD_BASE = 6;
const BEAM_SPREAD_MISTAKE = 34;

/**
 * The in-game beam: the laser the player is actually building, running
 * continuously, not an abstract drone. It is a held blade, and the board is
 * legible by ear through how that blade sits:
 *
 *   length       -> pitch and presence. Longer is lower and bigger.
 *   terminatedBy -> brightness. A beam that reached the flag is under control
 *                   and rings clear; one splashing off an obstacle is dull.
 *   bounces      -> thickness, via the fifth's level and the stereo spread.
 *                   Every fold adds another resonance to the chord. This is the
 *                   axis that used to be carried by spark density.
 *   mistake      -> the copies pushed apart until they beat, plus an unsteady
 *                   vibrato, a pitch sag and a darker filter.
 *
 * Every transition goes through setTargetAtTime, because the player edits the
 * board constantly and any stepped assignment here would click on every tap.
 *
 * It is very quiet, and it has to be: this is running for the entire five
 * minutes of a solve, and anything merely "not too loud" for 300ms is
 * unlistenable for 300 seconds.
 */
export function createBeamVoice({ ctx, bed }: Buses): BeamVoice {
  const now = ctx.currentTime;

  const rig = buildHum(ctx, { hz: BEAM_SHORT_HZ, level: MIX.beamHum });
  rig.out.gain.value = 0.6;

  // Presence lives on rig.out and is owned by setState; arrival is this
  // separate stage, so the two cannot fight over one param. A third stage
  // (screenPresence) lets /complete sit quieter without rewriting setState.
  const fade = ctx.createGain();
  fade.gain.setValueAtTime(NEAR_ZERO, now);
  // Fade in rather than appear, so arriving on the board is not a click.
  fade.gain.setTargetAtTime(1, now, 0.9);
  const screenPresence = ctx.createGain();
  screenPresence.gain.value = 1;
  rig.out.connect(fade).connect(screenPresence).connect(bed);

  rig.start(now);

  let stopped = false;

  return {
    setPresence(level: number) {
      if (stopped) return;
      screenPresence.gain.setTargetAtTime(
        clamp(level, 0, 1),
        ctx.currentTime,
        0.25
      );
    },
    setState({ length, bounces, terminatedBy, mistake }) {
      if (stopped) return;
      const t = ctx.currentTime;

      // 5-40 cells is the working range; 14 bounces is already a busy board, so
      // the thickness saturates before the theoretical maximum.
      const len = clamp((length - 5) / 35, 0, 1);
      const hits = clamp(bounces / 14, 0, 1);

      // What the beam ends on decides its character. A beam that made it to the
      // flag is a beam under control: focused, bright, steady. One splashing
      // off an obstacle or running off the board is unfocused and dull, and
      // wanders more.
      let bright =
        terminatedBy === "flag"
          ? 1
          : terminatedBy === "obstacle"
            ? 0.5
            : terminatedBy === "boundary"
              ? 0.3
              : 0.65;
      let rough =
        terminatedBy === "flag"
          ? 0.28
          : terminatedBy === "obstacle"
            ? 0.85
            : terminatedBy === "boundary"
              ? 0.66
              : 0.5;

      // A mistake sours everything at once: duller, unsteadier, and beating
      // against itself. It is meant to be uncomfortable without being loud.
      if (mistake) {
        bright *= 0.6;
        rough = Math.min(1, rough + 0.35);
      }

      // A long beam is a bigger installation, and a folded one is doing more
      // work than a straight one. Range deliberately narrow (0.55-1.0): this is
      // a sustained voice, and a dense board must stay clearly underneath the
      // one-shots however busy it gets.
      rig.out.gain.setTargetAtTime(
        length > 0 ? 0.55 + 0.3 * len + 0.15 * hits : NEAR_ZERO,
        t,
        0.3
      );

      // The sag on a mistake is small and it is a pitch move, not a level move.
      // Four percent is under a semitone - not heard as a wrong note, only as
      // the blade dropping slightly, which is what makes it read as a fault.
      rig.setPitch(
        (BEAM_SHORT_HZ - (BEAM_SHORT_HZ - BEAM_LONG_HZ) * len) *
          (mistake ? 0.96 : 1),
        t,
        0.3
      );
      rig.setBrightness(0.08 + 0.82 * bright, t, 0.3);
      rig.setChorus(clamp(0.15 + 0.75 * hits, 0, 1), t, 0.35);
      rig.setSpread(mistake ? BEAM_SPREAD_MISTAKE : BEAM_SPREAD_BASE, t, 0.35);
      rig.setWobble(rough, t, 0.3);
    },
    stop() {
      if (stopped) return;
      stopped = true;
      const t = ctx.currentTime;
      fade.gain.cancelScheduledValues(t);
      fade.gain.setTargetAtTime(NEAR_ZERO, t, 0.2);
      rig.stop(t + 0.8);
    },
  };
}

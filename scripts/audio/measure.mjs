/**
 * Measures the synthesized voice palette.
 *
 * Nothing in src/lib/audio ships as an audio file, so there is no waveform to
 * open and look at, and the levels are drive values into filters rather than
 * output peaks. Guessing at them does not work. This renders every voice
 * through an OfflineAudioContext in headless Chrome, wired into the same bus
 * graph engine.ts builds, and reports what actually reaches the speakers.
 *
 *   npm run sound:measure              # the working tree
 *   npm run sound:measure -- --baseline  # HEAD, for a before/after
 *   npm run sound:measure -- --json    # machine-readable
 *
 * Determinism matters and is not free. The noise buffers behind every one-shot
 * are built from Math.random(), so an unseeded run measures differently every
 * time - that once produced a round of numbers where RAISING a voice's drive
 * lowered its measured peak. The page seeds Math.random before the voice module
 * is evaluated, and `--verify` re-runs the whole sweep to prove two consecutive
 * runs agree before any figure here is trusted.
 *
 * The continuous voices are pure oscillators and use no randomness at all, so
 * they are exactly reproducible either way.
 */

import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import puppeteer from "puppeteer";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SOURCE = "src/lib/audio/voices.ts";

const args = process.argv.slice(2);
const useBaseline = args.includes("--baseline");
const asJson = args.includes("--json");
const verify = args.includes("--verify");
const doCompare = args.includes("--compare");

/**
 * Targets for the CONTINUOUS voices only - the ones this harness exists to
 * design. The one-shots have no absolute band here on purpose: they are already
 * tuned and signed off, so the useful question about them is not "are they in
 * some range I made up" but "did I change them", which is what --compare asks.
 *
 *   flatness    the scratch test. A harmonic stack measures ~0, white noise
 *               measures ~1. The old arc rig is noise by construction.
 *   hfFraction  where scratch lives: energy above 4 kHz.
 *   arcChop     the lawnmower test, and the subtle one. A sample & hold on a
 *               gain node chops the amplitude at tens of Hz. Measured on the
 *               HIGH BAND only, because that is the one thing an envelope can
 *               separate from the carrier: below ~200 Hz a fundamental and an
 *               amplitude chop are literally the same measurement.
 *   modHz       what modulation remains should be vibrato and breathing, i.e.
 *               single-digit Hz, not tens.
 */
const TARGETS = {
  continuous: {
    // The floor is low because the cursor hum at rest is SUPPOSED to be barely
    // there - it idles rather than stopping. What matters for a sustained voice
    // is the top of the range, which LOUDEST_CONTINUOUS below bounds properly.
    peak: [0.004, 0.055],
    flatness: [0, 0.15],
    centroid: [0, 1200],
    hfFraction: [0, 0.03],
    modHz: [0.15, 12],
    arcChop: [0, 0.2],
  },
};

/**
 * The loudest state any continuous voice can reach: a busy board with a long
 * beam, or the cursor at full tilt. Too quiet and the hum is not there; too
 * loud and it competes with the one-shots, which peak at 0.08-0.12.
 */
const LOUDEST_CONTINUOUS = [0.02, 0.04];

/** Compiles voices.ts standalone. It has no imports, so this is a clean emit. */
async function compileVoices(dir, fromHead) {
  const outDir = path.join(dir, fromHead ? "head" : "tree");
  let sourcePath = path.join(ROOT, SOURCE);

  if (fromHead) {
    const head = execFileSync("git", ["show", `HEAD:${SOURCE}`], {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    });
    sourcePath = path.join(dir, "voices.head.ts");
    await writeFile(sourcePath, head);
  }

  execFileSync(
    "npx",
    [
      "tsc",
      sourcePath,
      "--outDir",
      outDir,
      "--target",
      "es2020",
      "--module",
      "es2020",
      "--moduleResolution",
      "bundler",
      "--lib",
      "es2020,dom",
      "--skipLibCheck",
    ],
    { cwd: ROOT, stdio: ["ignore", "ignore", "inherit"] }
  );

  return readFile(
    path.join(outDir, fromHead ? "voices.head.js" : "voices.js"),
    "utf8"
  );
}

const PAGE = (voicesJs) => `<!doctype html>
<meta charset="utf-8">
<script>
// Seeded BEFORE the module below is evaluated, so the noise and crackle buffers
// - which are built lazily on first use and then cached for the page's life -
// are identical between runs.
(function () {
  const SEED = 0x9e3779b9;
  let s = SEED;
  Math.random = function () {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // Rewound before every render, so each voice is measured from the same PRNG
  // state regardless of what ran before it. Without this the sweep order leaks
  // into the numbers: the short noise-driven voices (uiTick, illegalTap) pick
  // their 4ms impulse via randomOffset, so removing randomness from the
  // continuous voices shifted the stream and moved uiTick's peak by 65% with
  // its code untouched. That is a harness artifact, and it would have read as
  // a regression.
  window.__reseed = function () { s = SEED; };
})();
</script>
<script type="module">
${voicesJs}

// --- engine.ts's bus graph, rebuilt offline -------------------------------
// These constants are duplicated from engine.ts on purpose: measuring through
// a graph that merely resembles the real one would be measuring nothing.
const MASTER_LEVEL = 0.85;
const REVERB_RETURN = 0.5;
const REVERB_SECONDS = 0.55;
const REVERB_DECAY = 5.5;
const BED_VERB_SEND = 0.12;

function buildBuses(ctx) {
  const master = ctx.createGain();
  master.gain.value = MASTER_LEVEL;
  master.connect(ctx.destination);

  const fx = ctx.createGain();
  fx.gain.value = 1;
  fx.connect(master);

  const bed = ctx.createGain();
  bed.gain.value = 1;
  bed.connect(master);

  const verb = ctx.createGain();
  verb.gain.value = 1;
  const convolver = ctx.createConvolver();
  convolver.buffer = createImpulseResponse(ctx, REVERB_SECONDS, REVERB_DECAY);
  const ret = ctx.createGain();
  ret.gain.value = REVERB_RETURN;
  verb.connect(convolver).connect(ret).connect(master);

  // Only present once the bed has a tap; the baseline build has none, and
  // wiring one in anyway would flatter it.
  if (typeof BED_VERB_SEND === "number" && BED_VERB_SEND > 0) {
    const bedSend = ctx.createGain();
    bedSend.gain.value = BED_VERB_SEND;
    bed.connect(bedSend).connect(verb);
  }

  return { ctx, fx, bed, verb };
}

// --- analysis --------------------------------------------------------------

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ar = re[i + k], ai = im[i + k];
        const br = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const bi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ar + br; im[i + k] = ai + bi;
        re[i + k + len / 2] = ar - br; im[i + k + len / 2] = ai - bi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr; cr = ncr;
      }
    }
  }
}

/** Hann-windowed power spectrum, averaged over frames across the region. */
function spectrum(mono, sampleRate, size = 16384) {
  const power = new Float64Array(size / 2);
  const frames = Math.max(1, Math.min(6, Math.floor(mono.length / size)));

  for (let f = 0; f < frames; f++) {
    const off = Math.floor((f * (mono.length - size)) / Math.max(1, frames - 1 || 1));
    const re = new Float64Array(size), im = new Float64Array(size);
    for (let i = 0; i < size; i++) {
      const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1));
      re[i] = (mono[off + i] || 0) * w;
    }
    fft(re, im);
    for (let i = 0; i < size / 2; i++) power[i] += re[i] * re[i] + im[i] * im[i];
  }

  for (let i = 0; i < power.length; i++) power[i] /= frames;
  return { power, binHz: sampleRate / size };
}

function spectralStats(mono, sampleRate) {
  const { power, binHz } = spectrum(mono, sampleRate);

  let total = 0, weighted = 0, hf = 0, logSum = 0;
  // Skip DC and the first couple of bins: they carry no pitch information and
  // any tiny offset there drags the centroid toward zero.
  const first = 2;
  const eps = 1e-20;

  for (let i = first; i < power.length; i++) {
    const p = power[i];
    const hz = i * binHz;
    total += p;
    weighted += p * hz;
    if (hz > 4000) hf += p;
    logSum += Math.log(p + eps);
  }

  const count = power.length - first;
  const arithmetic = total / count;
  const geometric = Math.exp(logSum / count);

  return {
    centroid: total > 0 ? weighted / total : 0,
    flatness: arithmetic > 0 ? geometric / arithmetic : 0,
    hfFraction: total > 0 ? hf / total : 0,
  };
}

/**
 * RMS envelope. the window must be several periods of the carrier or this
 * measures the waveform instead of its amplitude - the trap that made an
 * earlier version of this file report a 92 Hz fundamental's own octave partial
 * as "184 Hz of modulation".
 */
function envelopeOf(signal, window, hop, count) {
  const env = new Float64Array(count);
  for (let i = 0; i < count; i++) {
    let sum = 0;
    for (let k = 0; k < window; k++) {
      const v = signal[i * hop + k] || 0;
      sum += v * v;
    }
    env[i] = Math.sqrt(sum / window);
  }
  return env;
}

/** Envelope spectrum, DC removed. Returns power bins and their Hz spacing. */
function envelopeSpectrum(env, envRate) {
  const size = 1 << Math.floor(Math.log2(env.length));
  if (size < 64) return null;

  let mean = 0;
  for (let i = 0; i < size; i++) mean += env[i];
  mean /= size;
  if (mean <= 0) return null;

  const re = new Float64Array(size), im = new Float64Array(size);
  for (let i = 0; i < size; i++) {
    const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1));
    re[i] = (env[i] - mean) * w;
  }
  fft(re, im);

  const power = new Float64Array(size / 2);
  for (let i = 0; i < size / 2; i++) power[i] = re[i] * re[i] + im[i] * im[i];
  return { power, binHz: envRate / size, mean };
}

/** RBJ biquad, applied forward only. Used to isolate the arc band. */
function highpass(signal, sampleRate, hz, passes = 2) {
  let out = signal;
  for (let p = 0; p < passes; p++) {
    const w0 = (2 * Math.PI * hz) / sampleRate;
    const alpha = Math.sin(w0) / (2 * Math.SQRT1_2);
    const cw = Math.cos(w0);
    const b0 = (1 + cw) / 2, b1 = -(1 + cw), b2 = (1 + cw) / 2;
    const a0 = 1 + alpha, a1 = -2 * cw, a2 = 1 - alpha;

    const next = new Float64Array(out.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < out.length; i++) {
      const x0 = out[i];
      const y0 = (b0 / a0) * x0 + (b1 / a0) * x1 + (b2 / a0) * x2
        - (a1 / a0) * y1 - (a2 / a0) * y2;
      next[i] = y0;
      x2 = x1; x1 = x0; y2 = y1; y1 = y0;
    }
    out = next;
  }
  return out;
}

/**
 * Two separate questions, because one envelope cannot answer both.
 *
 * modHz and modDepth: what slow movement the voice has. The window is 46ms,
 * long enough to average away a 92 Hz carrier, which caps what it can see at
 * roughly 11 Hz - fine, because vibrato and breathing are the only things that
 * are supposed to be here.
 *
 * arcChop: whether the bright content is being chopped, which is the actual
 * lawnmower/scratch signature. Measured after a 3 kHz highpass, where the
 * carrier is fast enough that a 3ms window rejects it and the envelope stays
 * good to ~170 Hz.
 *
 * It is gated on hfFraction, taken from the FFT, NOT on the highpass output's
 * own level. A filter always leaks: gating on the filtered RMS let a 300 Hz
 * fundamental 60 dB down still dominate the envelope, and every voice in the
 * palette scored 0.96 - the identical carrier-in-the-envelope mistake this
 * function already documents one paragraph up, just an octave higher. Null
 * means there is no arc band at all, which is the strongest possible result.
 */
function modulationStats(mono, sampleRate, hfFraction) {
  const slowWindow = 2048, slowHop = 128;
  const slowCount = Math.floor((mono.length - slowWindow) / slowHop);
  let modHz = 0, modDepth = 0;

  if (slowCount >= 64) {
    const env = envelopeOf(mono, slowWindow, slowHop, slowCount);
    const spec = envelopeSpectrum(env, sampleRate / slowHop);
    if (spec) {
      let best = 0;
      for (let i = 1; i < spec.power.length; i++) {
        const hz = i * spec.binHz;
        if (hz < 0.15 || hz > 12) continue;
        if (spec.power[i] > best) { best = spec.power[i]; modHz = hz; }
      }
      let variance = 0;
      for (const v of env) variance += (v - spec.mean) ** 2;
      modDepth = Math.sqrt(variance / env.length) / spec.mean;
    }
  }

  // Is there enough genuine high-frequency content for the question to mean
  // anything? This threshold reads the FFT, which cannot leak.
  let arcChop = null;
  if (hfFraction > 0.02) {
    const hf = highpass(mono, sampleRate, 3000, 3);
    const fastWindow = 128, fastHop = 32;
    const fastCount = Math.floor((hf.length - fastWindow) / fastHop);
    if (fastCount >= 64) {
      const spec = envelopeSpectrum(
        envelopeOf(hf, fastWindow, fastHop, fastCount),
        sampleRate / fastHop
      );
      if (spec) {
        let total = 0, buzz = 0;
        for (let i = 1; i < spec.power.length; i++) {
          const hz = i * spec.binHz;
          if (hz < 1 || hz > 250) continue;
          total += spec.power[i];
          if (hz >= 25 && hz <= 200) buzz += spec.power[i];
        }
        arcChop = total > 0 ? buzz / total : 0;
      }
    }
  }

  return { modHz, modDepth, arcChop };
}

/** @param skip seconds to discard, so fade-ins are not measured. */
function analyze(buffer, skip = 0) {
  const sr = buffer.sampleRate;
  const start = Math.floor(skip * sr);
  const left = buffer.getChannelData(0).subarray(start);
  const right = buffer.numberOfChannels > 1
    ? buffer.getChannelData(1).subarray(start)
    : left;

  let peak = 0, sumSq = 0;
  for (let i = 0; i < left.length; i++) {
    const l = Math.abs(left[i]), r = Math.abs(right[i]);
    if (l > peak) peak = l;
    if (r > peak) peak = r;
    sumSq += left[i] * left[i] + right[i] * right[i];
  }

  const mono = new Float64Array(left.length);
  for (let i = 0; i < left.length; i++) mono[i] = (left[i] + right[i]) / 2;

  const spectral = spectralStats(mono, sr);

  return {
    peak,
    rms: Math.sqrt(sumSq / (left.length * 2)),
    ...spectral,
    ...modulationStats(mono, sr, spectral.hfFraction),
  };
}

async function render(seconds, drive) {
  window.__reseed();
  const ctx = new OfflineAudioContext(2, Math.ceil(44100 * seconds), 44100);
  const buses = buildBuses(ctx);
  await drive(buses, ctx);
  return ctx.startRendering();
}

// --- the sweep -------------------------------------------------------------

const TERMINATIONS = ["flag", "obstacle", "boundary", null];

window.measureAll = async () => {
  const results = [];

  // Continuous voices settle through a fade-in and a time constant; the first
  // 1.5s is arrival, not the voice, so it is discarded.
  for (const speed of [0, 0.3, 0.7, 1]) {
    const buffer = await render(4, (buses) => {
      const voice = createCursorVoice(buses);
      voice.setSpeed(speed);
    });
    results.push({
      group: "continuous",
      name: \`cursor speed=\${speed}\`,
      ...analyze(buffer, 1.5),
    });
  }

  for (const length of [6, 20, 40]) {
    for (const terminatedBy of TERMINATIONS) {
      for (const bounces of [0, 7, 14]) {
        for (const mistake of [false, true]) {
          const buffer = await render(4, (buses) => {
            const voice = createBeamVoice(buses);
            voice.setState({ length, bounces, terminatedBy, mistake });
          });
          results.push({
            group: "continuous",
            name: \`beam len=\${length} \${terminatedBy ?? "none"} b=\${bounces}\${mistake ? " MISTAKE" : ""}\`,
            ...analyze(buffer, 1.5),
          });
        }
      }
    }
  }

  const oneShots = {
    mirrorPlace, mirrorRotate, mirrorRemove, illegalTap, wrongState,
    hintChime, uiTick, navCharge, navFire, victoryCharge, victoryResolve,
  };
  for (const [name, fn] of Object.entries(oneShots)) {
    const buffer = await render(3, (buses, ctx) => fn(buses, ctx.currentTime + 0.05));
    results.push({
      group: name.startsWith("victory") ? "victory" : "oneShot",
      name,
      ...analyze(buffer),
    });
  }

  for (const index of [0, 4, 9]) {
    const buffer = await render(3, (buses, ctx) =>
      digitCollected(buses, ctx.currentTime + 0.05, index)
    );
    results.push({ group: "oneShot", name: \`digit \${index}\`, ...analyze(buffer) });
  }

  return results;
};
</script>`;

async function runSweep(page, voicesJs, dir, tag) {
  const file = path.join(dir, `${tag}.html`);
  await writeFile(file, PAGE(voicesJs));
  await page.goto(`file://${file}`);
  await page.waitForFunction("typeof window.measureAll === 'function'");
  return page.evaluate(() => window.measureAll());
}

function fmt(n, digits = 4) {
  return n === null || n === undefined || !Number.isFinite(n)
    ? "-"
    : n.toFixed(digits);
}

function checkRow(row) {
  const targets = TARGETS[row.group];
  if (!targets) return [];
  const failures = [];
  for (const [key, [lo, hi]] of Object.entries(targets)) {
    const v = row[key];
    // null means "not applicable", which for arcChop is the strongest possible
    // result: there is no bright band left to chop.
    if (v === null || v === undefined) continue;
    if (v < lo || v > hi) failures.push(`${key}=${fmt(v)} outside ${lo}..${hi}`);
  }
  return failures;
}

const COLUMNS = [
  ["peak", 8, 4],
  ["rms", 8, 4],
  ["centroid", 9, 0],
  ["flatness", 6, 3],
  ["hfFraction", 7, 3],
  ["modHz", 7, 2],
  ["modDepth", 8, 3],
  ["arcChop", 8, 3],
];

function report(rows) {
  const header = [
    "voice".padEnd(38),
    ...COLUMNS.map(([key, width]) => key.padStart(width)),
  ].join(" ");

  console.log(header);
  console.log("-".repeat(header.length));

  let failed = 0;
  let group = null;

  for (const row of rows) {
    if (row.group !== group) {
      group = row.group;
      console.log(`\n[${group}]`);
    }
    const failures = checkRow(row);
    if (failures.length) failed++;
    console.log(
      [
        row.name.padEnd(38),
        ...COLUMNS.map(([key, width, digits]) =>
          fmt(row[key], digits).padStart(width)
        ),
      ].join(" ") + (failures.length ? `  <-- ${failures.join("; ")}` : "")
    );
  }

  const continuous = rows.filter((r) => r.group === "continuous");
  if (continuous.length) {
    const worst = (key) =>
      Math.max(...continuous.map((r) => r[key]).filter(Number.isFinite));
    const chopped = continuous.filter((r) => r.arcChop !== null).length;
    const loudest = worst("peak");
    const [lo, hi] = LOUDEST_CONTINUOUS;
    const loudestOk = loudest >= lo && loudest <= hi;
    if (!loudestOk) failed++;

    console.log(
      `\ncontinuous worst case: peak ${fmt(loudest)}  ` +
        `flatness ${fmt(worst("flatness"), 3)}  ` +
        `centroid ${fmt(worst("centroid"), 0)}Hz  ` +
        `>4kHz ${fmt(worst("hfFraction"), 3)}  ` +
        `modHz ${fmt(worst("modHz"), 2)}\n` +
        `loudest continuous state ${fmt(loudest)} ` +
        `(want ${lo}..${hi})${loudestOk ? "" : "  <-- OUTSIDE"}\n` +
        `${chopped}/${continuous.length} continuous voices have enough energy ` +
        `above 4kHz for "is it being chopped" to even be a question.`
    );
  }

  console.log(
    failed
      ? `\n${failed}/${rows.length} voices outside target.`
      : `\nAll ${rows.length} voices inside target.`
  );
  return failed;
}

/**
 * The check that matters for the untouched voices. Absolute bands would be
 * invented; "identical to HEAD" is a fact.
 */
function compare(baseline, current) {
  const byName = new Map(baseline.map((r) => [r.name, r]));
  const changed = [];
  const missing = [];

  for (const row of current) {
    const before = byName.get(row.name);
    if (!before) {
      missing.push(row.name);
      continue;
    }
    const dPeak = row.peak - before.peak;
    if (Math.abs(dPeak) > 1e-9) {
      changed.push({ name: row.name, before, after: row, dPeak });
    }
  }

  console.log("CHANGED vs HEAD\n");
  const header = [
    "voice".padEnd(38),
    "peak".padStart(9),
    "was".padStart(9),
    "flat".padStart(7),
    "was".padStart(7),
    ">4kHz".padStart(7),
    "was".padStart(7),
  ].join(" ");
  console.log(header);
  console.log("-".repeat(header.length));

  for (const { name, before, after } of changed) {
    console.log(
      [
        name.padEnd(38),
        fmt(after.peak).padStart(9),
        fmt(before.peak).padStart(9),
        fmt(after.flatness, 3).padStart(7),
        fmt(before.flatness, 3).padStart(7),
        fmt(after.hfFraction, 3).padStart(7),
        fmt(before.hfFraction, 3).padStart(7),
      ].join(" ")
    );
  }

  const unchanged = current.length - changed.length - missing.length;
  console.log(
    `\n${changed.length} changed, ${unchanged} bit-identical to HEAD` +
      (missing.length ? `, ${missing.length} new (${missing.join(", ")})` : "")
  );
  return changed;
}

const dir = await mkdtemp(path.join(tmpdir(), "lattice-audio-"));
let exitCode = 0;

try {
  const voicesJs = await compileVoices(dir, useBaseline);
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--autoplay-policy=no-user-gesture-required"],
  });

  try {
    const page = await browser.newPage();
    page.on("pageerror", (err) => console.error("page error:", err.message));

    const rows = await runSweep(page, voicesJs, dir, "run1");

    if (verify) {
      // A fresh page, so the lazily-built noise buffers are rebuilt from a
      // freshly seeded Math.random rather than reused from the first run. That
      // is the whole point: reusing them would prove nothing.
      const fresh = await browser.newPage();
      const again = await runSweep(fresh, voicesJs, dir, "run2");
      await fresh.close();

      // Relative, not exact. Chrome's renderer is not bit-identical run to run
      // and never claimed to be; what this is guarding against is the seeding
      // being wrong, which moves peaks by whole percent, not by 1e-7.
      const TOLERANCE = 1e-4;
      let worstDrift = 0;
      let worstName = "";
      const drift = [];

      for (let i = 0; i < rows.length; i++) {
        const a = rows[i].peak;
        const b = again[i].peak;
        const rel = Math.abs(a - b) / Math.max(1e-12, Math.abs(a));
        if (rel > worstDrift) {
          worstDrift = rel;
          worstName = rows[i].name;
        }
        if (rel > TOLERANCE) drift.push(rows[i].name);
      }

      if (drift.length) {
        console.error(
          `\nNOT REPRODUCIBLE: ${drift.length} voices drift more than ` +
            `${TOLERANCE} between fresh runs (${drift.join(", ")}). ` +
            `Numbers below are noise - check the Math.random seeding.`
        );
        exitCode = 1;
      } else {
        console.log(
          `Reproducible: ${rows.length} voices agree across two fresh runs ` +
            `(worst drift ${worstDrift.toExponential(1)} on "${worstName}").\n`
        );
      }
    }

    if (doCompare) {
      const headJs = await compileVoices(dir, true);
      const headPage = await browser.newPage();
      const baseline = await runSweep(headPage, headJs, dir, "head");
      await headPage.close();
      compare(baseline, rows);
      console.log();
    }

    if (asJson) {
      console.log(JSON.stringify(rows, null, 2));
    } else {
      console.log(useBaseline ? "BASELINE (HEAD)\n" : "WORKING TREE\n");
      if (report(rows) > 0) exitCode = 1;
    }
  } finally {
    await browser.close();
  }
} finally {
  await rm(dir, { recursive: true, force: true });
}

process.exit(exitCode);

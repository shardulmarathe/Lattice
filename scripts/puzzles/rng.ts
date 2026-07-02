/**
 * Deterministic seeded RNG for reproducible puzzle generation.
 * mulberry32 (fast, good-enough distribution) seeded via an xmur3 string hash,
 * so the same seed string always yields the same puzzle.
 */

export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  /** Random element of a non-empty array. */
  pick<T>(items: readonly T[]): T;
  /** Fisher-Yates shuffle returning a new array. */
  shuffle<T>(items: readonly T[]): T[];
}

function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed: string): Rng {
  const seedFn = xmur3(seed);
  const rand = mulberry32(seedFn());

  const next = () => rand();

  return {
    next,
    int(min: number, max: number) {
      return min + Math.floor(next() * (max - min + 1));
    },
    pick<T>(items: readonly T[]): T {
      return items[Math.floor(next() * items.length)];
    },
    shuffle<T>(items: readonly T[]): T[] {
      const arr = [...items];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },
  };
}

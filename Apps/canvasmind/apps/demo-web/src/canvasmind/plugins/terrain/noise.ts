// Lightweight, deterministic FBM noise with a seed.
// Good enough for terrain prototyping; swap with GPU later if desired.

export type Noise2D = (x: number, y: number) => number;

function mulberry32(seed: number) {
  return function() {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(x: number, y: number, rnd: () => number) {
  // simple hash based on cell coords, stable per seed
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1 + (rnd() - 0.5) * 0.001;
}

function smoothstep(t: number) {
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function valueNoise2D(seed: number): Noise2D {
  const rnd = mulberry32(seed);
  return (x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;

    const h00 = hash(xi + 0, yi + 0, rnd);
    const h10 = hash(xi + 1, yi + 0, rnd);
    const h01 = hash(xi + 0, yi + 1, rnd);
    const h11 = hash(xi + 1, yi + 1, rnd);

    const u = smoothstep(xf);
    const v = smoothstep(yf);

    const a = lerp(h00, h10, u);
    const b = lerp(h01, h11, u);
    return lerp(a, b, v); // [-1,1] approx
  };
}

export function makeFBM2D(
  seed = 42,
  octaves = 5,
  lacunarity = 2.0,
  gain = 0.5
): Noise2D {
  const base = valueNoise2D(seed);
  return (x: number, y: number) => {
    let amp = 1.0;
    let freq = 1.0;
    let sum = 0.0;
    let norm = 0.0;
    for (let i = 0; i < octaves; i++) {
      sum += base(x * freq, y * freq) * amp;
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / (norm || 1); // [-1,1]
  };
}

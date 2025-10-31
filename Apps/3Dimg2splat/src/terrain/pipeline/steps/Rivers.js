// Simple gradient-descent river mask that CARVES the input height function
// non-destructively: returns { height(x,z) }
import { mulberry32 } from '../../../utils/SeedUtils.js';

export function applyRivers(base, seed = 0, params = {}) {
  // Accept either a height fn or an object with height()
  const baseHeight =
    (typeof base === 'function') ? base :
    (base && typeof base.height === 'function') ? base.height :
    null;

  if (!baseHeight) {
    console.warn('[Rivers] skipped: invalid field interface');
    const passthrough = (x, z) => 0;
    return { height: passthrough };
  }

  // Tunables (lightweight by default)
  const GRID     = params.riverGrid  ?? 256;   // mask tile size
  const SOURCES  = params.riverSrc   ?? 48;
  const STEPS    = params.riverSteps ?? 512;
  const MIN_ALT  = params.minAlt     ?? (params.seaLevel ?? 8) + 4;
  const K        = params.riverK     ?? 1.2;   // carve strength
  const GAMMA    = params.riverGamma ?? 0.75;  // carve curve
  const SEA      = params.seaLevel   ?? 8;

  // Deterministic RNG / tile offset so the mask "moves" with the seed
  const rng  = mulberry32((seed ^ 0xc0ffee) >>> 0);
  const offX = (rng() * 4096) | 0;
  const offZ = (rng() * 4096) | 0;

  const N = GRID;
  const H = new Float32Array(N * N);
  const F = new Float32Array(N * N);

  const idx = (x, y) => y * N + x;
  const clamp01 = (v, lo, hi) => (v < lo ? lo : (v > hi ? hi : v));

  // Sample the base height into a tile (periodic)
  for (let z = 0; z < N; z++) {
    for (let x = 0; x < N; x++) {
      H[idx(x, z)] = baseHeight(offX + x, offZ + z);
    }
  }

  // Bilinear sampler over H
  const sample = (x, z) => {
    x = (x % N + N) % N; z = (z % N + N) % N;
    const x0 = Math.floor(x), z0 = Math.floor(z);
    const x1 = (x0 + 1) % N,  z1 = (z0 + 1) % N;
    const tx = x - x0,       tz = z - z0;
    const a = H[idx(x0, z0)], b = H[idx(x1, z0)];
    const c = H[idx(x0, z1)], d = H[idx(x1, z1)];
    const u = a * (1 - tx) + b * tx;
    const v = c * (1 - tx) + d * tx;
    return u * (1 - tz) + v * tz;
  };

  // Central-diff gradient on H
  const grad = (x, z) => {
    const eps = 1;
    const gx = (sample(x + eps, z) - sample(x - eps, z)) * 0.5;
    const gz = (sample(x, z + eps) - sample(x, z - eps)) * 0.5;
    return [gx, gz];
  };

  // Seed sources up high; descend following -∇h, accumulate flow
  let tries = 0;
  for (let s = 0; s < SOURCES && tries < SOURCES * 20; ) {
    tries++;
    let x = rng() * N, z = rng() * N;
    if (sample(x, z) <= MIN_ALT) continue; // need altitude
    s++;

    for (let i = 0; i < STEPS; i++) {
      const [gx, gz] = grad(x, z);
      const len = Math.hypot(gx, gz) + 1e-6;
      x -= gx / len; z -= gz / len;               // step downhill
      x = clamp01(x, 0, N - 1); z = clamp01(z, 0, N - 1);

      F[idx(x | 0, z | 0)] += 1;

      if (sample(x, z) <= SEA + 0.5) break;      // reached sea
    }
  }

  // Quick blur to widen channels
  const blur1 = new Float32Array(N * N);
  for (let z = 0; z < N; z++) {
    for (let x = 0; x < N; x++) {
      let sum = 0, c = 0;
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = (x + dx + N) % N, zz = (z + dz + N) % N;
          sum += F[idx(xx, zz)]; c++;
        }
      }
      blur1[idx(x, z)] = sum / c;
    }
  }
  // Normalize mask
  let maxF = 0;
  for (let i = 0; i < blur1.length; i++) if (blur1[i] > maxF) maxF = blur1[i];
  const invMax = maxF > 0 ? 1 / maxF : 0;

  // Carved height fn: subtract a small amount based on flow^gamma
  const carvedHeight = (x, z) => {
    const baseH = baseHeight(x, z);
    const ix = ((x - offX) % N + N) % N | 0;
    const iz = ((z - offZ) % N + N) % N | 0;
    const f = blur1[idx(ix, iz)] * invMax;
    const carve = (f > 0) ? (K * Math.pow(f, GAMMA)) : 0;
    return baseH - carve;
  };

  return { height: carvedHeight };
}

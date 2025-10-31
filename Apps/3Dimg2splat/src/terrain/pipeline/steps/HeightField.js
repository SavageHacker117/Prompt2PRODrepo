// src/terrain/pipeline/steps/HeightField.js
import { mulberry32 } from '../../../utils/SeedUtils.js';
import { makeFractalNoise, NOISE_PRESETS } from '../../data/NoisePresets.js';

// Gaussian "gassling" lobes + fractal noise → base height
export function createHeightField(seed, params, lumInfo = null) {
  const rand = mulberry32(seed | 0);
  const noise = makeFractalNoise(rand, params.noisePreset || NOISE_PRESETS.default);

  // Scatter lobes
  const hills = [];
  const hillCount = Math.max(24, Math.floor(48 * (params.hilliness ?? 1)));
  const baseRadius = 18 + (rand() * 20);
  for (let i = 0; i < hillCount; i++) {
    hills.push({
      cx: (rand() * 1e6) | 0,
      cz: (rand() * 1e6) | 0,
      r: baseRadius * (0.75 + rand() * 1.4),
      h: 10 + rand() * 32
    });
  }

  const worldScale = params.worldScale ?? 1.0;         // bigger = more zoomed out
  const amp        = params.amplitude ?? 28;           // vertical amplitude
  const base       = params.baseLevel ?? 10;           // baseline elevation

  // Optional luminance map for image→terrain seeding
  const lum = (x, z) => {
    if (!lumInfo) return 0;
    const { lumMap, width, height } = lumInfo;
    const u = Math.abs(x % width) | 0;
    const v = Math.abs(z % height) | 0;
    const L = lumMap[(v * width + u) % lumMap.length];
    return (L - 0.5) * (params.lumInfluence ?? 16.0);
  };

  const gauss = (x, z) => {
    let g = 0;
    for (let i = 0; i < hills.length; i++) {
      const h = hills[i];
      const dx = x - h.cx, dz = z - h.cz;
      const d2 = (dx * dx + dz * dz) / (h.r * h.r);
      if (d2 < 6.0) g += h.h * Math.exp(-d2);
    }
    return g;
  };

  // Height function (unbounded, worldGen clamps later)
  const height = (x, z) => {
    const n = noise(x / worldScale, z / worldScale);   // ~[-1..1]
    const g = gauss(x, z) * 0.35;
    const baseNoise = (n * amp);
    const seaBias = params.seaBiasFn ? params.seaBiasFn(x, z) : 0; // coast shaping
    return base + g + baseNoise + seaBias + lum(x, z);
  };

  return { height };
}

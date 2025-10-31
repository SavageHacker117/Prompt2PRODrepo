// src/terrain/data/NoisePresets.js
import { makeNoise2D, fbm } from '../../world/TerrainUtils.js';

// Build a 2D fractal noise function using a seeded RNG
export function makeFractalNoise(rand, preset = NOISE_PRESETS.default) {
  const base = makeNoise2D(rand);
  const { scale, octaves, lacunarity, gain } = preset;
  return (x, z) => fbm(base, x * scale, z * scale, octaves, lacunarity, gain);
}

export const NOISE_PRESETS = {
  // Balanced terrain
  default:   { scale: 0.0035, octaves: 5, lacunarity: 2.0,  gain: 0.5 },
  mountains: { scale: 0.0022, octaves: 6, lacunarity: 2.15, gain: 0.45 },
  dunes:     { scale: 0.0060, octaves: 3, lacunarity: 2.0,  gain: 0.55 },
};

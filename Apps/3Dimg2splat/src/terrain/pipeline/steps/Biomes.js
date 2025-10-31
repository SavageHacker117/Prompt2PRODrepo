// src/terrain/pipeline/steps/Biomes.js
import { surfaceMaterial } from '../../data/BiomePresets.js';

// Provide a surface classifier in terms your WorldGenerator understands.
export function makeMaterialPicker(params, sampleHeight) {
  const snowline = params.snowline ?? 26;

  // Quick finite difference slope in vertical units
  const slopeAt = (x, z) => {
    const h = sampleHeight(x, z);
    const hx = sampleHeight(x + 1, z);
    const hz = sampleHeight(x, z + 1);
    return Math.abs(hx - h) + Math.abs(hz - h);
  };

  // A simple dryness noise proxy: farther from water level → drier
  const drynessAt = (y, seaLevel) => {
    const d = Math.max(0, y - seaLevel);
    return Math.max(0, Math.min(1, d / 24)); // normalize-ish
  };

  const pick = (x, y, z, surfaceY, seaLevel) => {
    if (y < surfaceY - 4) return 'stone';
    if (y === surfaceY) {
      const mat = surfaceMaterial({
        y: surfaceY,
        snowline,
        slope: slopeAt(x, z),
        dryness: drynessAt(surfaceY, seaLevel)
      });
      return mat;
    }
    return 'dirt';
  };

  return { pick };
}

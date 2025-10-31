// src/terrain/pipeline/steps/Water.js

// Keep a simple, explicit sea level. You can make this adaptive later.
export function resolveWater(params) {
  const seaLevel = (params.seaLevel ?? 8) | 0; // lower than before to avoid "submerged worlds"
  return { seaLevel };
}

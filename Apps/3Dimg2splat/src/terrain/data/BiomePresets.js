// src/terrain/data/BiomePresets.js

// Simple altitude/temperature/moisture → surface material
// Expand or swap with more detailed rules later
export function surfaceMaterial({ y, snowline, slope, dryness }) {
  // Rock on steep areas
  if (slope > 2.25) return 'stone';
  // Snow cap
  if (y >= snowline) return 'snow';
  // Dry = sand, otherwise grass
  if (dryness >= 0.68) return 'sand';
  return 'grass';
}

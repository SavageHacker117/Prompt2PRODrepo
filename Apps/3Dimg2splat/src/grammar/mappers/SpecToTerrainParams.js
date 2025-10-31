// src/grammar/mappers/SpecToTerrainParams.js

const dir = s => s && /NE\-SW|NW\-SE|E\-W|W\-E|N\-S|S\-N/i.test(s) ? s.toUpperCase() : null;

export function specToParams(spec, seed) {
  // Defaults tuned to avoid "perma underwater"
  const params = {
    worldScale: 1.0,
    amplitude: 28,
    baseLevel: 11,
    snowline: 28,
    hilliness: 1.0,
    seaLevel: 8,
    rivers: { count: 0, depth: 5, width: 7, orientation: 'E-W' },
    noisePreset: undefined,
    // Optional coast bias (lowers terrain near one side)
    seaBiasFn: null,
  };

  // Scale hint
  if (spec.scaleKm) {
    params.worldScale = Math.max(0.6, Math.min(2.4, 16 / spec.scaleKm));
  }

  // Parse features
  for (const f of (spec.features || [])) {
    if (f.type === 'mountainRange') {
      params.amplitude = 30 + Math.round(6 * (f.steepness ?? 0.6));
      params.hilliness = 1.0 + (f.ridges ?? 1) * 0.15;
      if (f.orientation) params.rivers.orientation = dir(f.orientation) || params.rivers.orientation;
      params.noisePreset = { scale: 0.0025, octaves: 6, lacunarity: 2.1, gain: 0.48 };
      if (f.snowline) params.snowline = Math.round(20 + 18 * f.snowline);
    }
    if (f.type === 'river') {
      params.rivers.count = Math.max(params.rivers.count, f.count || 1);
      if (f.width) params.rivers.width = 5 + (f.width | 0);
    }
  }

  // Dunes
  if (spec.dunes) {
    params.noisePreset = { scale: 0.006, octaves: 3, lacunarity: 2.0, gain: 0.55 };
    params.amplitude = Math.max(params.amplitude, 22);
  }

  // Coast: bias height near an edge
  if (spec.coast && spec.coast.position) {
    const pos = String(spec.coast.position).toUpperCase(); // N S E W
    const width = 480; // pixels in world coords to bias
    params.seaLevel = 8; // keep modest
    params.seaBiasFn = (x, z) => {
      const m = 0.006; // magnitude
      if (pos === 'W') return -m * Math.max(0, width - (x % 1e6)) * 0.02;
      if (pos === 'E') return -m * Math.max(0, width - ((1e6 - x) % 1e6)) * 0.02;
      if (pos === 'N') return -m * Math.max(0, width - (z % 1e6)) * 0.02;
      if (pos === 'S') return -m * Math.max(0, width - ((1e6 - z) % 1e6)) * 0.02;
      return 0;
    };
  }

  return params;
}

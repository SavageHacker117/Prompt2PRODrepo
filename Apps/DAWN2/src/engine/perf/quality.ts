// src/engine/perf/quality.ts

export type QualityMode = "low" | "balanced" | "high";

export type ShadowQuality = {
  mapSize: number; // shadow map resolution (mapSize x mapSize)
};

export type PixelRatioRange = {
  min: number;
  max: number;
};

export type OceanQuality = {
  lodStart: number;
  lodFade: number;
  causticsSize: number;
};

export type QualityPreset = {
  shadows: ShadowQuality;
  pixelRatio: PixelRatioRange;
  ocean: OceanQuality;
};

export const QUALITY_PRESETS: Record<QualityMode, QualityPreset> = {
  low: {
    shadows: { mapSize: 1024 },
    pixelRatio: { min: 0.9, max: 1.1 },
    ocean: { lodStart: 20, lodFade: 40, causticsSize: 256 },
  },
  balanced: {
    shadows: { mapSize: 1536 },
    pixelRatio: { min: 1.0, max: 1.5 },
    ocean: { lodStart: 40, lodFade: 80, causticsSize: 512 },
  },
  high: {
    shadows: { mapSize: 2048 },
    pixelRatio: { min: 1.0, max: 2.0 },
    ocean: { lodStart: 60, lodFade: 120, causticsSize: 1024 },
  },
};

export function getQualityPreset(mode: QualityMode): QualityPreset {
  return QUALITY_PRESETS[mode];
}

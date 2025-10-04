/**
 * Schedules for pacing spawn/quality/etc. in the runtime.
 * Returns multipliers in [0, 1].
 */

export type ScheduleFn = (t: number) => number;

export interface CosineWRConfig {
  /** Base cycle length in ticks (frames or seconds) */
  T0: number;
  /** Multiplier applied to each subsequent cycle (SGDR style). Default: 2 */
  Tmult?: number;
  /** Minimum floor for the returned multiplier (0..1). Default: 0 */
  floor?: number;
}

/**
 * Cosine Warm Restarts (SGDR) that’s stable and log-free.
 * t: current tick (frame or second)
 * T0: base cycle length
 * Tmult: cycle length multiplier (2 doubles each restart)
 */
export function cosineWarmRestarts(t: number, T0: number, Tmult = 2, floor = 0): number {
  if (T0 <= 0) return 1; // avoid division by zero / bad config
  if (t < 0) t = 0;
  if (Tmult < 1) Tmult = 1;

  // find the current cycle by subtracting completed cycles
  let Ti = T0;
  let tCur = t;
  while (tCur >= Ti) {
    tCur -= Ti;
    Ti = Math.max(T0, Ti * Tmult);
  }

  // cosine from 1 -> floor over the course of the cycle
  const x = tCur / Ti; // [0,1)
  const raw = 0.5 * (1 + Math.cos(Math.PI * x)); // [0,1]
  const clampedFloor = Math.max(0, Math.min(1, floor));
  return clampedFloor + (1 - clampedFloor) * raw; // map to [floor,1]
}

/**
 * Convenience: construct a schedule function from config.
 */
export function makeCosineWRSchedule(cfg: CosineWRConfig): ScheduleFn {
  const { T0, Tmult = 2, floor = 0 } = cfg;
  return (t: number) => cosineWarmRestarts(t, T0, Tmult, floor);
}

/**
 * Map a [0..1] multiplier into [min..max].
 */
export function scaleToRange(mult: number, min: number, max: number): number {
  const m = Math.min(1, Math.max(0, mult));
  return min + (max - min) * m;
}

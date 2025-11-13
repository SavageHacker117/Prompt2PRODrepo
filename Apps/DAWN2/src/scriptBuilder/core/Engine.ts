// Lightweight engine surface that other modules can use.
// We already expose __engine in Rose; this just normalizes helpers.

export type Vec3 = [number, number, number]

export class Engine {
  private updaters = new Set<(dt: number) => void>()
  private sky: { inclination?: number; azimuth?: number } = {}
  private sun: Vec3 = [1, 1, 1]

  onUpdate(fn: (dt: number) => void) { this.updaters.add(fn) }
  offUpdate(fn: (dt: number) => void) { this.updaters.delete(fn) }
  tick(dt: number) { for (const u of this.updaters) u(dt) }

  setSky(inclination?: number, azimuth?: number) {
    if (inclination !== undefined) this.sky.inclination = inclination
    if (azimuth !== undefined) this.sky.azimuth = azimuth
  }
  setSun(v?: Vec3) { if (v) this.sun = v }

  get state() { return { sky: this.sky, sun: this.sun } }
}

// make sure a single global exists
export function ensureEngine(): Engine {
  const w = window as any
  if (!w.__engine) w.__engine = new Engine()
  return w.__engine as Engine
}

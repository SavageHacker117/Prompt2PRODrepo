// Lightweight engine surface that other modules can use.
// We already expose __engine in Rose; this just normalizes helpers.

export type Vec3 = [number, number, number]

/** Optional Gaussian Splat extension, filled in by your GS viewer later. */
export type GSExt = {
  /** Spawn a .splat scene/object – meme.ts will call this if present. */
  spawnSplat?: (url: string, opts?: any) => string | void
}

export class Engine {
  private updaters = new Set<(dt: number) => void>()
  private sky: { inclination?: number; azimuth?: number } = {}
  private sun: Vec3 = [1, 1, 1]

  // ---------------------------------------------------------------------------
  // Optional extension points – other modules are free to attach to these.
  // GLBinject.tsx will usually set spawnActor/destroyActor.
  // A GS viewer can hang off `gs.spawnSplat`.
  // ---------------------------------------------------------------------------
  spawnActor?: (url: string, opts?: any) => string | void
  destroyActor?: (id: string) => void
  gs?: GSExt

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
export function ensureEngine(): Engine & { gs: GSExt } {
  const w = window as any

  // If __engine doesn't exist yet, start with a fresh Engine instance.
  // If something else already created __engine as a plain object
  // (e.g. App.tsx with `__engine ||= {}`), we KEEP it and just
  // treat it as an Engine (TS-only) and attach the GS extension.
  if (!w.__engine) {
    w.__engine = new Engine()
  }

  const eng = w.__engine as Engine & { gs?: GSExt }

  // Make sure we always have an engine.gs with at least a no-op spawnSplat,
  // so meme.spawnAll can call it safely even before the real GS viewer exists.
  if (!eng.gs) {
    eng.gs = {
      spawnSplat(url: string, opts?: any) {
        console.warn(
          '[engine.gs.spawnSplat] GS viewer not wired yet; requested',
          { url, opts },
        )
        // Return a stable id so callers can log something meaningful.
        return (opts && opts.id) || url
      },
    }
  } else if (!eng.gs.spawnSplat) {
    eng.gs.spawnSplat = (url: string, opts?: any) => {
      console.warn(
        '[engine.gs.spawnSplat] GS viewer not wired yet; requested',
        { url, opts },
      )
      return (opts && opts.id) || url
    }
  }

  return eng as Engine & { gs: GSExt }
}

// src/engine/perf.ts
import * as THREE from 'three'

export type QualityPresetName = 'low' | 'balanced' | 'high'

type QualityPreset = {
  /** device pixel ratio (or 'auto' for window.devicePixelRatio) */
  maxPixelRatio: number | 'auto'
  /** shadow map size (square) for the main directional light */
  shadowMapSize: number
  /** water LOD behaviour */
  oceanLOD: { start: number; fade: number }
  /** caustics render target size */
  causticsSize: number
}

const QUALITY_PRESETS: Record<QualityPresetName, QualityPreset> = {
  low: {
    maxPixelRatio: 1.0,
    shadowMapSize: 1024,
    oceanLOD: { start: 30, fade: 30 },
    causticsSize: 256,
  },
  balanced: {
    maxPixelRatio: 1.25,
    shadowMapSize: 1536,
    oceanLOD: { start: 40, fade: 40 },
    causticsSize: 512,
  },
  high: {
    maxPixelRatio: 'auto',
    shadowMapSize: 2048,
    oceanLOD: { start: 55, fade: 55 },
    causticsSize: 1024,
  },
}

const STORAGE_KEY = 'dawn2-quality-preset-v1'

function getStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null
    return window.localStorage
  } catch {
    return null
  }
}

export function getQualityPreset(): QualityPresetName {
  const storage = getStorage()
  if (!storage) return 'balanced'
  const raw = storage.getItem(STORAGE_KEY)
  if (raw === 'low' || raw === 'balanced' || raw === 'high') return raw
  return 'balanced'
}

export function setQualityPreset(name: QualityPresetName) {
  const storage = getStorage()
  if (!storage) return
  try {
    storage.setItem(STORAGE_KEY, name)
  } catch {
    // ignore quota / privacy errors
  }
}

type ApplyCtx = {
  renderer?: THREE.WebGLRenderer
  mainLight?: THREE.DirectionalLight | null
  engine?: any
}

/**
 * Safe: every access is guarded. It is OK to call this before ocean / light exist.
 * If ctx is omitted, it will fall back to window.__renderer / window.__engine.
 */
export function applyQualityPreset(name: QualityPresetName, ctx: ApplyCtx = {}) {
  const preset = QUALITY_PRESETS[name]
  if (!preset) return

  const w: any = typeof window !== 'undefined' ? window : undefined

  const engine: any = ctx.engine ?? w?.__engine ?? undefined
  const renderer: THREE.WebGLRenderer | undefined = ctx.renderer ?? w?.__renderer
  const mainLight: THREE.DirectionalLight | null | undefined =
    ctx.mainLight ?? engine?.mainLight ?? engine?.dirLight ?? null

  // Renderer DPR
  if (renderer) {
    const dpr =
      preset.maxPixelRatio === 'auto'
        ? (typeof window !== 'undefined' ? window.devicePixelRatio : 1)
        : preset.maxPixelRatio
    renderer.setPixelRatio(dpr)
  }

  // Main directional light shadow map
  if (mainLight && (mainLight as any).shadow) {
    const shadow: any = (mainLight as any).shadow
    const mapSize = shadow.mapSize
    if (mapSize && typeof mapSize.set === 'function') {
      const sz = preset.shadowMapSize
      mapSize.set(sz, sz)
      shadow.needsUpdate = true
    }
  }

  // Ocean LOD / caustics (if ocean plugin is present)
  const ocean = engine?.iss?.ocean
  if (ocean) {
    try {
      if (typeof ocean.setLOD === 'function') {
        ocean.setLOD(preset.oceanLOD.start, preset.oceanLOD.fade)
      }
    } catch {
      // ignore
    }
    try {
      if (typeof ocean.setCausticsSize === 'function') {
        ocean.setCausticsSize(preset.causticsSize)
      }
    } catch {
      // ignore
    }
  }

  // Expose on engine for console / grammars
  if (engine) {
    engine.quality ||= {}
    engine.quality.current = name
  }

  setQualityPreset(name)
}

/* ──────────────────────────────────────────────────────────────── */
/* Simple estimators for budgets (used by GLBinject, etc.)         */
/* ──────────────────────────────────────────────────────────────── */

/** Rough triangle-count estimator for a mesh hierarchy */
export function estimateMeshTris(root: any): number {
  if (!root || !root.traverse) return 0
  let tris = 0
  root.traverse((o: any) => {
    if (!(o.isMesh || o.isSkinnedMesh) || !o.geometry) return
    const geom: THREE.BufferGeometry = o.geometry
    const index = geom.index
    if (index) {
      tris += index.count / 3
    } else if (geom.attributes?.position) {
      tris += geom.attributes.position.count / 3
    }
  })
  return tris
}

/**
 * Estimate texture memory in MB.
 * Accepts either a single texture or an Object3D hierarchy.
 */
export function estimateTextureMB(source: any): number {
  const seen = new Set<THREE.Texture>()
  let bytes = 0

  const handleTexture = (tex: any) => {
    if (!tex || !tex.isTexture || seen.has(tex)) return
    seen.add(tex)
    const w = tex.image?.width || 0
    const h = tex.image?.height || 0
    const bpp = 4 // assume RGBA8
    bytes += w * h * bpp
  }

  if (source && source.isTexture) {
    handleTexture(source)
  } else if (source && source.traverse) {
    source.traverse((o: any) => {
      const mats: any[] = !o.material
        ? []
        : Array.isArray(o.material)
        ? o.material
        : [o.material]
      for (const m of mats) {
        if (!m) continue
        for (const key in m) {
          const val = (m as any)[key]
          if (val && val.isTexture) handleTexture(val)
        }
      }
    })
  }

  return bytes / (1024 * 1024)
}

/* ──────────────────────────────────────────────────────────────── */
/* Perf snapshots + watch (for live logging & video demos)         */
/* ──────────────────────────────────────────────────────────────── */

export type PerfSnapshot = {
  tris: number
  textureMB: number
  drawCalls: number
  geometries: number
  textures: number
  quality: QualityPresetName
}

/** Grab a single snapshot of perf; optionally log with a label. */
export function getPerfSnapshot(label?: string): PerfSnapshot {
  if (typeof window === 'undefined') {
    return {
      tris: 0,
      textureMB: 0,
      drawCalls: 0,
      geometries: 0,
      textures: 0,
      quality: getQualityPreset(),
    }
  }

  const w: any = window as any
  const engine: any = w.__engine || {}
  const scene: THREE.Scene | undefined =
    (w.__three && w.__three.scene) || engine.scene
  const gl: THREE.WebGLRenderer | undefined = w.__renderer

  const tris = scene ? estimateMeshTris(scene) : 0
  const texMB = scene ? estimateTextureMB(scene) : 0
  const info = gl?.info

  const snapshot: PerfSnapshot = {
    tris,
    textureMB: texMB,
    drawCalls: info?.render.calls ?? 0,
    geometries: info?.memory.geometries ?? 0,
    textures: info?.memory.textures ?? 0,
    quality: (engine.quality?.current as QualityPresetName) || getQualityPreset(),
  }

  if (label) {
    console.log(`[perf] ${label}`, snapshot)
  }

  return snapshot
}

let perfWatchHandle: number | null = null

/** Start logging perf snapshot every N ms (default 1000ms) to the console. */
export function startPerfWatch(intervalMs = 1000) {
  if (typeof window === 'undefined') return
  if (perfWatchHandle !== null) {
    window.clearInterval(perfWatchHandle)
  }
  perfWatchHandle = window.setInterval(() => {
    getPerfSnapshot('watch')
  }, intervalMs)
}

/** Stop logging snapshots started by startPerfWatch. */
export function stopPerfWatch() {
  if (typeof window === 'undefined') return
  if (perfWatchHandle !== null) {
    window.clearInterval(perfWatchHandle)
    perfWatchHandle = null
  }
}

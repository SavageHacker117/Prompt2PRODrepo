// src/grammars/perf.ts
import * as THREE from 'three'
import {
  applyQualityPreset,
  estimateMeshTris,
  estimateTextureMB,
  getQualityPreset,
  type QualityPresetName,
  startPerfWatch,
  stopPerfWatch,
  getPerfSnapshot,
} from '../engine/perf'

export function registerPerfGrammar(
  dbg: any,
  engine: any,
  _levels: Record<string, unknown> = {},
  _extras: Record<string, unknown> = {},
) {
  const QUALITIES: QualityPresetName[] = ['low', 'balanced', 'high']

  dbg.extend(
    'perf',
    (args: string[]) => {
      const sub = (args[0] || '').toLowerCase()

      if (!sub || sub === 'help') {
        return [
          'perf help                 — show this help',
          'perf quality              — show current quality preset',
          'perf quality <name>       — set GPU quality (low | balanced | high)',
          'perf stats                — estimate triangles + texture MB for current scene',
          'perf watch                — log perf snapshot to console every second',
          'perf watch stop           — stop logging snapshots',
        ]
      }

      if (sub === 'quality') {
        const nameRaw = (args[1] || '').toLowerCase()

        if (!nameRaw) {
          const cur = getQualityPreset()
          return `perf quality: "${cur}"`
        }

        if (!QUALITIES.includes(nameRaw as QualityPresetName)) {
          return 'usage: perf quality <low|balanced|high>'
        }

        const q = nameRaw as QualityPresetName
        const w: any = window as any
        const eng: any = w.__engine || engine || {}

        // Prefer the React/engine API so HUD + App state stay in sync
        if (eng.quality && typeof eng.quality.set === 'function') {
          eng.quality.set(q)
        } else {
          const gl: THREE.WebGLRenderer | undefined = w.__renderer
          applyQualityPreset(q, {
            renderer: gl,
            mainLight: eng.mainLight || null,
            engine: eng,
          })
        }

        return `perf quality set → ${q}`
      }

      if (sub === 'stats') {
        const w: any = window as any
        const scene: THREE.Scene | undefined =
          (w.__three && w.__three.scene) || engine?.scene

        if (!scene) return 'perf: scene not ready'

        const tris = estimateMeshTris(scene)
        const texMB = estimateTextureMB(scene)

        const lines: string[] = []
        lines.push(`tris       ≈ ${Math.round(tris).toLocaleString()}`)
        lines.push(`textures   ≈ ${texMB.toFixed(1)} MB (RGBA8 approx)`)

        try {
          const gl: any = w.__renderer
          if (gl && gl.info) {
            const info = gl.info
            lines.push(
              `gl.info: ${info.render.calls} draws, ${info.memory.textures} textures, ${info.memory.geometries} geometries`,
            )
          }
        } catch {
          // ignore
        }

        return lines
      }

      if (sub === 'watch') {
        const mode = (args[1] || '').toLowerCase()

        if (mode === 'stop') {
          stopPerfWatch()
          return 'perf watch: stopped'
        }

        // start watching at 1s interval
        startPerfWatch(1000)
        const snap = getPerfSnapshot()
        return [
          'perf watch: started (logging to console every 1s)',
          `initial — tris≈${Math.round(snap.tris).toLocaleString()}, tex≈${snap.textureMB.toFixed(
            1,
          )}MB, draws=${snap.drawCalls}`,
        ]
      }

      return 'Unknown "perf" subcommand (try "perf help").'
    },
    'Perf + GPU tools (type "perf help").',
  )
}

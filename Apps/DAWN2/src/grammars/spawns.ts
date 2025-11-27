// src/grammars/spawns.ts
import type { SpawnType } from '../runtime/scene/SpawnSystem'

type Dbg = {
  extend: (
    name: string,
    fn: (args: string[]) => string | string[],
    help: string
  ) => void
}

export function registerSpawnsGrammar(dbg: Dbg) {
  const engine = (window as any).__engine || {}
  const api = engine.spawns
  const spawnActor: ((url: string, opts?: any) => string | void) | undefined =
    engine.spawnActor

  dbg.extend(
    'spawn',
    (args) => {
      if (!api && !spawnActor) {
        return 'spawn: system not ready (no engine.spawns / engine.spawnActor)'
      }

      const sub = (args[0] || '').toLowerCase()

      // -----------------------------------------------------------------------
      // Basic spawn-system management (existing behaviour)
      // -----------------------------------------------------------------------
      if (sub === 'list') {
        if (!api) return 'spawn list: spawns API not ready'
        return api
          .list()
          .map(
            (s: any) =>
              `${s.id} ${s.type} alive=${s.alive.size}/${s.maxAlive}`,
          )
      }

      if (sub === 'show') {
        if (!api) return 'spawn show: spawns API not ready'
        api.showHelpers(true)
        return 'helpers shown'
      }
      if (sub === 'hide') {
        if (!api) return 'spawn hide: spawns API not ready'
        api.showHelpers(false)
        return 'helpers hidden'
      }

      if (sub === 'add') {
        if (!api) return 'spawn add: spawns API not ready'
        // spawn add <type> <url> [x z] [maxAlive] [respawn]
        const type = (args[1] as SpawnType) || 'npc'
        const url = args[2]
        if (!url) {
          return 'usage: spawn add <type> <url> [x z] [maxAlive] [respawn]'
        }
        const x = parseFloat(args[3] || '0')
        const z = parseFloat(args[4] || '0')
        const maxAlive = parseInt(args[5] || '1', 10)
        const respawn = parseFloat(args[6] || '5')
        api.create({
          type,
          templateUrl: url,
          position: { x, y: 0, z },
          maxAlive,
          respawnDelay: respawn,
        })
        return `spawn created @ ${x},0,${z}`
      }

      if (sub === 'killall') {
        if (!api) return 'spawn killall: spawns API not ready'
        api.list().forEach((sp: any) => {
          Array.from(sp.alive).forEach((o: any) => o.despawn?.())
        })
        return 'all alive instances despawned'
      }

      // -----------------------------------------------------------------------
      // New: direct actor spawning via GLBinject (engine.spawnActor)
      // -----------------------------------------------------------------------
      if (sub === 'actor') {
        // spawn actor <url> [name]
        if (!spawnActor) {
          return 'spawn actor: engine.spawnActor not available (is InjectedActorsHost mounted?)'
        }
        const url = args[1]
        if (!url) {
          return 'usage: spawn actor <url> [name]'
        }
        const name = args[2] || url.split('/').pop() || 'actor'
        spawnActor(url, { name })
        return `spawned actor from ${url} as "${name}"`
      }

      // -----------------------------------------------------------------------
      // New: spawn from memeTo3D manifest (uses engine.__meme.lastJob)
      // -----------------------------------------------------------------------
      if (sub === 'meme') {
        if (!spawnActor) {
          return 'spawn meme: engine.spawnActor not available (is InjectedActorsHost mounted?)'
        }

        const meme = engine.__meme
        if (!meme || !meme.lastJob || !meme.lastJob.manifest) {
          return 'spawn meme: no meme manifest loaded. Run "meme.latest" first.'
        }

        const assets = meme.lastJob.manifest.assets ?? []
        if (!assets.length) {
          return 'spawn meme: manifest has no assets.'
        }

        const arg1 = args[1]
        const indices: number[] = []

        if (arg1 && /^\d+$/.test(arg1)) {
          const idx = parseInt(arg1, 10) - 1
          if (idx < 0 || idx >= assets.length) {
            return `spawn meme: index out of range (1..${assets.length}).`
          }
          indices.push(idx)
        } else {
          for (let i = 0; i < assets.length; i++) indices.push(i)
        }

        const lines: string[] = []
        lines.push(
          `spawn meme: spawning ${indices.length} asset(s) from job ${meme.lastJob.id} (${meme.lastJob.status})`,
        )

        for (const i of indices) {
          const asset = assets[i] as any
          const rawPath: string = asset.path || ''
          if (!rawPath) {
            lines.push(`${i + 1}. ${asset.name || 'unnamed'} — missing path, skipped.`)
            continue
          }

          // IMPORTANT:
          // We assume asset.path is already a browser-visible URL (e.g. "/assets/meme/foo.glb").
          // Right now your backend uses filesystem paths like "/root/data/jobs/...".
          // Once you update the backend to emit web URLs, this will Just Work™.
          const url = rawPath

          spawnActor(url, {
            name: asset.name || `meme_${i + 1}`,
            position: [0, 0, 0], // can be overridden later
          })

          lines.push(
            `${i + 1}. spawned "${asset.name || `meme_${i + 1}`}" from ${url}`,
          )
        }

        lines.push(
          'NOTE: asset.path must be a browser-visible URL (not a WSL filesystem path).',
        )
        lines.push(
          'Update your FastAPI manifest writer to store public GLB URLs once the generator is ready.',
        )

        return lines
      }

      // -----------------------------------------------------------------------
      // Help
      // -----------------------------------------------------------------------
      return [
        'spawn help — this help',
        'spawn list — list spawns',
        'spawn add <type> <url> [x z] [maxAlive] [respawn]',
        'spawn show | spawn hide — toggle helper rings',
        'spawn killall — despawn all instances',
        'spawn actor <url> [name] — spawn a one-off actor via engine.spawnActor (GLBinject)',
        'spawn meme [index] — spawn GLB asset(s) from the last memeTo3D manifest',
      ]
    },
    'spawn management + memeTo3D integration',
  )
}

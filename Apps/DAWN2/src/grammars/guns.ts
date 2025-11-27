// DAWN2/src/grammars/guns.ts
import * as THREE from 'three'
import type { ScriptHost } from '../scriptBuilder/core/ScriptHost'
import { ensureGunRigHost, GunRigDef } from '../weapon/GunRig'

type Dbg = {
  extend: (
    name: string,
    fn: (args: string[]) => string | string[],
    help: string,
  ) => void
}

type Engine = {
  activeActor?: { object?: THREE.Object3D }
  selected?: THREE.Object3D
  guns?: {
    active?: any
  }
}

function getActor(engine: Engine): THREE.Object3D | null {
  return (
    (engine.activeActor?.object as THREE.Object3D | null) ||
    (engine.selected as THREE.Object3D | null) ||
    null
  )
}

/**
 * guns … — weapon rig / bone injection helpers.
 */
export function registerGunsGrammar(
  dbg: Dbg,
  engine: Engine,
  _levels: Record<string, unknown> = {},
  extras: { scriptHost?: ScriptHost } = {},
) {
  const host = ensureGunRigHost()
  const scriptHost: ScriptHost | undefined =
    extras.scriptHost || (window as any).__scriptHost

  dbg.extend(
    'gun',
    (args: string[]): string | string[] => {
      const sub = (args[0] || 'help').toLowerCase()

      if (sub === 'help' || !sub) {
        return [
          'gun help                          — this help',
          'gun list                          — list rig presets',
          'gun new <name> <weaponKind>       — create/update rig',
          'gun attach <rig> <boneFilter>     — bind rig to bone (by name substring)',
          'gun pos <rig> x y z               — set local offset',
          'gun rot <rig> rx ry rz            — set local rotation (deg)',
          'gun apply <rig>                   — apply rig to active actor + active gun',
          'gun save                          — save all rigs to localStorage',
          'gun load                          — reload rigs from localStorage',
        ]
      }

      if (sub === 'list') {
        const names = host.list()
        return names.length ? names.join('\n') : '(no gun rigs)'
      }

      if (sub === 'new') {
        const name = args[1]
        const weaponKind = args[2] || 'Ak47'
        if (!name) return 'usage: gun new <name> <weaponKind>'
        const def: GunRigDef = { name, weaponKind }
        host.upsert(def)
        return `gun: created/updated rig "${name}" for ${weaponKind}`
      }

      if (sub === 'attach') {
        const [rigName, filterRaw] = [args[1], args[2]]
        if (!rigName || !filterRaw)
          return 'usage: gun attach <rig> <boneFilter>'

        const actor = getActor(engine)
        if (!actor) return 'gun: no active actor'

        const filter = filterRaw.toLowerCase()

        // Use ScriptHost bone map if available for better names. :contentReference[oaicite:17]{index=17}
        let best: string | null = null
        if (scriptHost?.boneMap?.size) {
          for (const name of scriptHost.boneMap.keys()) {
            if (name.toLowerCase().includes(filter)) {
              best = name
              break
            }
          }
        } else {
          // fallback: traverse
          actor.traverse(o => {
            if (best) return
            if (o.name && o.name.toLowerCase().includes(filter)) {
              best = o.name
            }
          })
        }

        if (!best) return `gun: no bone matching "${filterRaw}"`

        const def = host.get(rigName) || { name: rigName, weaponKind: 'Ak47' }
        def.attachBone = best
        host.upsert(def)
        return `gun: ${rigName}.attachBone = "${best}"`
      }

      if (sub === 'pos') {
        const [rigName] = [args[1]]
        if (!rigName) return 'usage: gun pos <rig> x y z'
        const x = parseFloat(args[2] || '0')
        const y = parseFloat(args[3] || '0')
        const z = parseFloat(args[4] || '0')
        const def = host.get(rigName) || { name: rigName, weaponKind: 'Ak47' }
        def.localPos = [x, y, z]
        host.upsert(def)
        return `gun: ${rigName}.localPos = [${x}, ${y}, ${z}]`
      }

      if (sub === 'rot') {
        const [rigName] = [args[1]]
        if (!rigName) return 'usage: gun rot <rig> rx ry rz'
        const rx = parseFloat(args[2] || '0')
        const ry = parseFloat(args[3] || '0')
        const rz = parseFloat(args[4] || '0')
        const def = host.get(rigName) || { name: rigName, weaponKind: 'Ak47' }
        def.localRotDeg = [rx, ry, rz]
        host.upsert(def)
        return `gun: ${rigName}.localRotDeg = [${rx}, ${ry}, ${rz}]`
      }

      if (sub === 'apply') {
        const rigName = args[1]
        if (!rigName) return 'usage: gun apply <rig>'

        const actor = getActor(engine)
        if (!actor) return 'gun: no active actor'

        const gun = (engine as any).guns?.active as {
          root?: THREE.Object3D
        } | undefined

        if (!gun?.root) return 'gun: no active weapon (engine.guns.active.root)'

        const ok = host.applyRig(rigName, gun.root, actor, scriptHost)
        return ok ? `gun: applied rig "${rigName}"` : 'gun: failed to apply rig'
      }

      if (sub === 'save') {
        host.saveToStorage()
        return 'gun: rigs saved to localStorage'
      }

      if (sub === 'load') {
        host.loadFromStorage()
        return 'gun: rigs reloaded'
      }

      return `gun: unknown subcommand "${sub}" (try "gun help")`
    },
    'Weapon rig helpers (gun help)',
  )
}

// DAWN2/src/grammars/mobs.ts
import * as THREE from 'three'

type Dbg = {
  extend: (
    name: string,
    fn: (args: string[]) => string | string[],
    help: string,
  ) => void
}

type Mob = {
  id: number
  object: THREE.Object3D
  speed: number
  stopRadius: number
}

let nextMobId = 1

export function registerMobGrammar(
  dbg: Dbg,
  engine: any,
  _levels: Record<string, unknown> = {},
  _extras: Record<string, unknown> = {},
) {
  const mobs: Mob[] = []
  const DIR = new THREE.Vector3()

  function getActiveActorRoot(): THREE.Object3D | null {
    const eng: any = engine

    // activeActor wrapper (preferred)
    const a = eng.activeActor
    if (a) {
      if (a.object && a.object.isObject3D) return a.object as THREE.Object3D
      if (a.root && a.root.isObject3D) return a.root as THREE.Object3D
      if (a.isObject3D) return a as THREE.Object3D
    }

    // explicit selection
    const sel = eng.selected
    if (sel && sel.isObject3D) return sel as THREE.Object3D

    // fall back to first actor in the table
    const actors = eng.actors
    if (actors && typeof actors === 'object') {
      const first = Object.values<any>(actors)[0]
      if (first) {
        if (first.object && first.object.isObject3D)
          return first.object as THREE.Object3D
        if (first.root && first.root.isObject3D)
          return first.root as THREE.Object3D
        if (first.isObject3D) return first as THREE.Object3D
      }
    }

    return null
  }

  function getPlayerRoot(): THREE.Object3D | null {
    // prefer movement's player
    const p = (engine.player && (engine.player.object || engine.player)) as
      | THREE.Object3D
      | undefined
    if (p && p.position) return p

    // otherwise chase whatever the "active" actor is
    return getActiveActorRoot()
  }

  const sys = {
    update(dt: number) {
      if (!mobs.length) return
      const target = getPlayerRoot()
      if (!target) return

      for (const m of mobs) {
        const root = m.object
        if (!root || !root.parent) continue // deleted from scene

        DIR.subVectors(target.position, root.position)
        DIR.y = 0 // no vertical chasing
        const distSq = DIR.lengthSq()
        if (distSq < 1e-4) continue

        const dist = Math.sqrt(distSq)
        if (dist <= m.stopRadius) {
          // close enough – hook attack logic here later
          continue
        }

        DIR.multiplyScalar((m.speed * dt) / dist)
        root.position.add(DIR)

        // face movement direction
        const yaw = Math.atan2(DIR.x, DIR.z)
        root.rotation.y = yaw
      }
    },
  }

  ;(engine.systems ||= new Set()).add(sys)

  function addActiveAsMob(): string {
    const root = getActiveActorRoot()
    if (!root || !root.position) {
      return 'mob: no active actor selected'
    }

    const id = nextMobId++
    mobs.push({
      id,
      object: root,
      speed: 3.0,
      stopRadius: 1.2,
    })

    return `mob: actor added as mob #${id}`
  }

  function clearMobs(): string {
    mobs.length = 0
    return 'mob: cleared mob list (actors remain in scene)'
  }

  function listMobs(): string[] {
    if (!mobs.length) return ['mob: (no mobs registered)']
    return mobs.map(
      (m) =>
        `#${m.id} at (${m.object.position.x.toFixed(
          1,
        )}, ${m.object.position.y.toFixed(1)}, ${m.object.position.z.toFixed(
          1,
        )})`,
    )
  }

  dbg.extend(
    'mob',
    (args: string[]) => {
      const sub = (args[0] || 'help').toLowerCase()
      switch (sub) {
        case 'help':
          return [
            'mob help          — show this help',
            'mob add           — mark the active actor as a chasing mob',
            'mob list          — list current mobs',
            'mob clear         — remove all mobs (actors stay in scene)',
          ]
        case 'add':
          return addActiveAsMob()
        case 'list':
          return listMobs()
        case 'clear':
          return clearMobs()
        default:
          return 'mob: unknown command; try "mob help"'
      }
    },
    'mob … — simple mob AI helpers (mob help)',
  )
}

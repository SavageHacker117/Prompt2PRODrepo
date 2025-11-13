// create/bind/respawn spawn points + UI helpers
import * as THREE from 'three'

export type SpawnType = 'npc' | 'player' | 'vendor'
export type SpawnPoint = {
  id: string
  type: SpawnType
  name?: string
  position: THREE.Vector3
  templateUrl?: string
  respawnDelay: number
  maxAlive: number
  alive: Set<string>
  marker: THREE.Object3D
  host?: THREE.Object3D | null
}

const _spawns = new Map<string, SpawnPoint>()
let _scene: THREE.Scene
let _engine: any

const TYPE_COLOR: Record<SpawnType, number> = {
  npc: 0x44c0ff,
  player: 0x26d07c,
  vendor: 0xffa63d,
}

function makeMarker(p: THREE.Vector3, type: SpawnType) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.4, 0.05, 8, 24),
    new THREE.MeshBasicMaterial({ color: TYPE_COLOR[type], transparent: true, opacity: 0.95 })
  )
  ring.rotation.x = -Math.PI / 2

  const geo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-0.35, 0.02, -0.35),
    new THREE.Vector3( 0.35, 0.02,  0.35),
    new THREE.Vector3( 0.35, 0.02, -0.35),
    new THREE.Vector3(-0.35, 0.02,  0.35),
  ])
  const line1 = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xffffff }))

  const group = new THREE.Group()
  group.add(ring)
  group.add(line1)
  group.position.copy(p)
  group.name = 'SpawnMarker'
  group.userData.pickRoot = true
  group.userData.isSpawn = true
  return group
}

export function initSpawnSystem(engine: any) {
  _engine = engine
  _scene = (window as any).__scene || engine.scene
  if (!_scene) throw new Error('SpawnSystem: scene missing')

  engine.spawns = {
    create,
    list: () => Array.from(_spawns.values()),
    remove,
    bindActor,
    attachToObject,
    getPickables: () => Array.from(_spawns.values()).map(s => s.marker),
    kill: onActorKilled,
    ui: {
      tool: 'none' as 'none' | 'place' | 'attach',
      type: 'npc' as SpawnType,
      templateUrl: '/assets/models/actors/dino1.glb',
      respawnDelay: 5,
      maxAlive: 1,
      lastCreatedId: '' as string | '',
    },
  }
}

export function create(opts: Partial<SpawnPoint> & { type: SpawnType, host?: THREE.Object3D | null }): SpawnPoint {
  const id = opts.id || `spawn_${Math.random().toString(36).slice(2, 8)}`
  const pos = opts.position ? opts.position.clone() : new THREE.Vector3()
  const marker = makeMarker(pos, opts.type)

  const sp: SpawnPoint = {
    id,
    type: opts.type,
    name: opts.name || id,
    position: pos,
    templateUrl: opts.templateUrl,
    respawnDelay: opts.respawnDelay ?? 5,
    maxAlive: opts.maxAlive ?? 1,
    alive: new Set<string>(),
    marker,
    host: opts.host ?? null,
  }

  marker.userData.spawnId = id
  marker.userData.pickRoot = true

  if (sp.host) {
    sp.host.add(marker)
    marker.position.set(0, 0, 0)
  } else {
    _scene.add(marker)
  }

  _spawns.set(id, sp)
  if (_engine?.spawns?.ui) _engine.spawns.ui.lastCreatedId = id
  console.debug('[SpawnSystem] created', sp)
  return sp
}

export function remove(id: string) {
  const sp = _spawns.get(id); if (!sp) return
  sp.marker.parent?.remove(sp.marker)
  _spawns.delete(id)
  console.debug('[SpawnSystem] removed', id)
}

export function bindActor(actorRoot: THREE.Object3D, spawnId: string) {
  const sp = _spawns.get(spawnId); if (!sp) return
  const wp = new THREE.Vector3()
  sp.marker.getWorldPosition(wp)
  actorRoot.position.copy(wp)
  actorRoot.userData.spawnId = spawnId
  actorRoot.userData.isActorRoot = true
  actorRoot.userData.pickRoot = true
  sp.alive.add(actorRoot.uuid)
  console.debug('[SpawnSystem] bind actor', actorRoot.uuid, '->', spawnId)
}

export function attachToObject(spawnId: string, host: THREE.Object3D | null) {
  const sp = _spawns.get(spawnId); if (!sp) return
  const wp = new THREE.Vector3()
  sp.marker.getWorldPosition(wp)
  sp.marker.parent?.remove(sp.marker)
  if (host) {
    host.add(sp.marker)
    sp.marker.position.set(0, 0, 0)
  } else {
    _scene.add(sp.marker)
    sp.marker.position.copy(wp)
  }
  sp.host = host
  console.debug('[SpawnSystem] attach', spawnId, 'to', host?.name || '(scene)')
}

export function onActorKilled(actorIdOrRoot: string | THREE.Object3D) {
  const id = typeof actorIdOrRoot === 'string' ? actorIdOrRoot : actorIdOrRoot.uuid
  for (const sp of _spawns.values()) {
    if (sp.alive.delete(id)) {
      console.debug('[SpawnSystem] actor removed', id, 'from', sp.id)
      if (sp.templateUrl && sp.alive.size < sp.maxAlive) {
        setTimeout(async () => {
          const root = await _engine.spawnActor?.(sp.templateUrl)
          if (root) bindActor(root, sp.id)
        }, sp.respawnDelay * 1000)
      }
      break
    }
  }
}

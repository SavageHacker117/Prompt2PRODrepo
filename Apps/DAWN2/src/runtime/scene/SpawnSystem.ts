// src/runtime/scene/SpawnSystem.ts
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { BulletPool } from '../../weapon/BulletPool'
import { Ak47 } from '../../weapon/Ak47'
import { ensureEngine } from '../../scriptBuilder/core/Engine'

/** Public types consumed by SpawnPanel */
export type SpawnType = 'npc' | 'player' | 'vendor'

export type SpawnPoint = {
  id: string
  name?: string
  type: SpawnType
  marker: THREE.Object3D            // visual helper in the world
  host?: THREE.Object3D | null      // when attached to an object
  position: THREE.Vector3           // last world position (kept in sync)
  templateUrl: string
  respawnDelay: number
  maxAlive: number
  alive: Set<THREE.Object3D>        // active instances
}

type EngineBridge = {
  scene: THREE.Scene
  camera: THREE.Camera
  dom: HTMLElement
  systems?: Set<{ update(dt: number): void }>
  focus?: (o: THREE.Object3D) => void
  selected?: any
}

const loader = new GLTFLoader()
const gltfCache = new Map<string, Promise<THREE.Object3D>>()

function uid() {
  return Math.random().toString(36).slice(2, 8)
}

async function loadTemplate(url: string): Promise<THREE.Object3D> {
  if (!gltfCache.has(url)) {
    gltfCache.set(
      url,
      (async () => {
        const gltf = await loader.loadAsync(url)
        // Important: clone later per spawn; here we just keep original.
        const root = new THREE.Group()
        root.add(gltf.scene)
        return root
      })(),
    )
  }
  const original = await gltfCache.get(url)!
  // Deep-clone so animation/skin state is independent
  return cloneSkinned(original)
}

function makeRingHelper(): THREE.Object3D {
  // simple additive ring that hovers & pulses
  const tex = new THREE.TextureLoader().load('/assets/vfx/spawn/ring_06.png')
  tex.encoding = THREE.sRGBEncoding
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity: 0.9,
  })
  const geo = new THREE.PlaneGeometry(0.9, 0.9)
  const mesh = new THREE.Mesh(geo, mat)
  mesh.rotation.x = -Math.PI * 0.5
  mesh.renderOrder = 10
  mesh.userData.isSpawnMarker = true
  return mesh
}

export class SpawnSystem {
  readonly scene: THREE.Scene
  readonly camera: THREE.Camera
  readonly dom: HTMLElement
  readonly raycaster = new THREE.Raycaster()
  private ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  private _clock = new THREE.Clock()

  private points = new Map<string, SpawnPoint>()
  private _helpersVisible = true
  private bullets!: BulletPool

  /** UI state that the SpawnPanel reads/writes */
  readonly ui = {
    type: 'npc' as SpawnType,
    templateUrl: '/assets/models/actors/dino1.glb',
    respawnDelay: 5,
    maxAlive: 1,
    tool: 'none' as 'none' | 'place' | 'attach',
    lastCreatedId: '' as string | undefined,
  }

  // Optional: simple wave support
  waves: Array<SpawnPoint[]> = []

  // exported API (attached onto window.__engine.spawns)
  api!: any

  constructor(eng: EngineBridge) {
    this.scene = eng.scene
    this.camera = eng.camera
    this.dom = eng.dom

    this.onPointerDown = this.onPointerDown.bind(this)

    // Attach input listener only once
    this.dom.addEventListener('pointerdown', this.onPointerDown)

    // Register a lightweight update loop (for marker pulse + respawn timers)
    const sys = {
      update: (dt: number) => this.update(dt),
    }

    const weng = ((window as any).__engine ||= {})
    weng.systems ||= new Set()
    ;(weng.systems as Set<{ update(dt: number): void }>).add(sys)

    // Bridge minimal API for HUD/console/Quick-Spawn
    this.api = {
      ui: this.ui,
      list: () => Array.from(this.points.values()),
      showHelpers: (on: boolean) => this.toggleHelpers(on),
      create: (opts: Partial<SpawnPoint> & {
        type: SpawnType
        position?: THREE.Vector3
        templateUrl: string
        respawnDelay?: number
        maxAlive?: number
        name?: string
        host?: THREE.Object3D | null
      }) => this.create(opts),
      remove: (id: string) => this.remove(id),
      attachToObject: (id: string, host: THREE.Object3D) => this.attachToObject(id, host),
      attachToSelection: () => this.attachToSelection(),
      spawnOne: (id: string) => this.spawnOne(id),
      // extremely simple wave API
      addWave: (ids: string[]) => {
        this.waves.push(ids.map((i) => this.points.get(i)).filter(Boolean) as SpawnPoint[])
      },
      spawnWave: (i: number) => {
        const arr = this.waves[i] || []
        arr.forEach((sp) => this.spawnOne(sp.id))
      },
    }

    // Publish on engine
    weng.spawns = this.api

    // Weapon / bullet setup shared across spawns
    const engine = ensureEngine()
    const impactCb = (hitObj: THREE.Object3D | null, hitPos: THREE.Vector3) => {
      // TODO: hook into damage / decals / sound once your combat loop is ready.
      // For now this is just a placeholder.
    }
    this.bullets = new BulletPool(this.scene, impactCb)

    ;(engine as any).guns ||= {}
    ;(engine as any).guns.bullets = this.bullets
  }

  /* ─────────────────────────────────────────────────────────────── UI actions */

  private getPointerNDC(event: PointerEvent): THREE.Vector2 {
    const rect = this.dom.getBoundingClientRect()
    return new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -(((event.clientY - rect.top) / rect.height) * 2 - 1),
    )
  }

  private pickGround(event: PointerEvent): THREE.Vector3 | null {
    const ndc = this.getPointerNDC(event)
    this.raycaster.setFromCamera(ndc, this.camera)
    const p = new THREE.Vector3()
    const hit = this.raycaster.ray.intersectPlane(this.ground, p)
    return hit ? p.clone() : null
  }

  private pickObject(event: PointerEvent): THREE.Object3D | null {
    const ndc = this.getPointerNDC(event)
    this.raycaster.setFromCamera(ndc, this.camera)
    const hits = this.raycaster.intersectObjects(this.scene.children, true)
    for (const h of hits) {
      const o = h.object
      if (o.userData?.isSpawnMarker) continue
      return o
    }
    return null
  }

  private async onPointerDown(ev: PointerEvent) {
    // HUD puts us in tool='place' / 'attach' temporarily.
    const tool = this.ui.tool
    if (tool === 'none') return

    if (tool === 'place' && ev.button === 0) {
      const p = this.pickGround(ev)
      if (p) {
        const id = await this.create({
          type: this.ui.type,
          position: p,
          templateUrl: this.ui.templateUrl,
          respawnDelay: this.ui.respawnDelay,
          maxAlive: this.ui.maxAlive,
        })
        this.ui.lastCreatedId = id
      }
      this.ui.tool = 'none'
      return
    }

    if (tool === 'attach' && ev.button === 0) {
      const host = this.pickObject(ev)
      const id = this.ui.lastCreatedId
      if (host && id) {
        this.attachToObject(id, host)
      }
      this.ui.tool = 'none'
      return
    }
  }

  /* ─────────────────────────────────────────────────────────────── CRUD */

  async create(opts: Partial<SpawnPoint> & {
    type: SpawnType
    position?: THREE.Vector3
    templateUrl: string
    respawnDelay?: number
    maxAlive?: number
    name?: string
    host?: THREE.Object3D | null
  }): Promise<string> {
    const id = opts.id || `sp_${uid()}`
    const marker = makeRingHelper()
    marker.visible = this._helpersVisible
    const position = (opts.position?.clone() || new THREE.Vector3()).setY(0)
    marker.position.copy(position)

    this.scene.add(marker)

    const sp: SpawnPoint = {
      id,
      name: opts.name,
      type: opts.type,
      marker,
      host: opts.host ?? null,
      position,
      templateUrl: opts.templateUrl,
      respawnDelay: Math.max(0, opts.respawnDelay ?? 5),
      maxAlive: Math.max(1, opts.maxAlive ?? 1),
      alive: new Set<THREE.Object3D>(),
    }

    this.points.set(id, sp)
    this.ui.lastCreatedId = id

    // If attached to a host, stick to it each frame
    if (sp.host) {
      sp.marker.userData.followHost = true
    }

    return id
  }

  remove(id: string) {
    const sp = this.points.get(id)
    if (!sp) return
    sp.alive.forEach((o) => {
      o.parent?.remove(o)
    })
    sp.marker.removeFromParent()
    this.points.delete(id)
    if (this.ui.lastCreatedId === id) this.ui.lastCreatedId = undefined
  }

  attachToObject(id: string, host: THREE.Object3D) {
    const sp = this.points.get(id)
    if (!sp) return
    sp.host = host
    sp.marker.userData.followHost = true
    const wp = new THREE.Vector3()
    host.getWorldPosition(wp)
    wp.y = 0
    sp.marker.position.copy(wp)
    sp.position.copy(wp)
  }

  attachToSelection() {
    const eng = (window as any).__engine || {}
    let host: THREE.Object3D | undefined
    const sel = eng.selected
    if (Array.isArray(sel)) host = sel[sel.length - 1]
    else if (sel && typeof sel.values === 'function') host = Array.from(sel.values()).slice(-1)[0]
    else host = sel

    const id = this.ui.lastCreatedId
    if (host && id) this.attachToObject(id, host)
  }

  toggleHelpers(on: boolean) {
    this._helpersVisible = !!on
    for (const sp of this.points.values()) sp.marker.visible = this._helpersVisible
  }

  /* ─────────────────────────────────────────────────────────────── Runtime */

  private _pulseT = 0
  private _respawnTimers = new Map<string, number>()

  private update(dt: number) {
    // Called by engine systems
    this._pulseT += dt
    const s = 1 + Math.sin(this._pulseT * 4) * 0.08
    for (const sp of this.points.values()) {
      // follow host if attached
      if (sp.host && sp.marker.userData.followHost) {
        sp.host.getWorldPosition(sp.marker.position)
        sp.marker.position.y = 0
        sp.position.copy(sp.marker.position)
      }
      // pulse marker
      sp.marker.scale.setScalar(s)
    }

    // process respawn timers
    for (const [id, t] of [...this._respawnTimers]) {
      const left = t - dt
      if (left <= 0) {
        this._respawnTimers.delete(id)
        this.spawnOne(id)
      } else {
        this._respawnTimers.set(id, left)
      }
    }
  }

  async spawnOne(id: string) {
    const sp = this.points.get(id)
    if (!sp) return
    if (sp.alive.size >= sp.maxAlive) return

    const obj = await loadTemplate(sp.templateUrl)
    obj.userData.__spawnId = id

    // position from spawn marker
    obj.position.copy(sp.position)
    obj.traverse((o: any) => {
      if (o.isMesh) {
        o.castShadow = true
        o.receiveShadow = true
      }
    })

    this.scene.add(obj)
    sp.alive.add(obj)

    // If this spawn point is a player, give it an AK and expose it on engine.guns
    if (sp.type === 'player') {
      const engine = ensureEngine()
      const ak = new Ak47(this.scene, this.bullets, 'ak47.default')
      ak.attach(obj)
      ;(obj as any).weapon = ak
      ;(engine as any).guns ||= {}
      ;(engine as any).guns.active = ak
    }

    // Provide a tiny helper API so game code can "kill" an instance,
    // which will trigger respawn after the configured delay.
    ;(obj as any).despawn = () => {
      if (!sp.alive.has(obj)) return
      obj.parent?.remove(obj)
      sp.alive.delete(obj)
      if (sp.respawnDelay > 0) {
        this._respawnTimers.set(sp.id, sp.respawnDelay)
      }
    }

    return obj
  }
}

/** Convenience initializer to keep App.tsx tiny. */
export function installSpawnSystem(engine: EngineBridge) {
  return new SpawnSystem(engine)
}

// Back-compat alias (App.tsx imports initSpawnSystem)
export const initSpawnSystem = installSpawnSystem

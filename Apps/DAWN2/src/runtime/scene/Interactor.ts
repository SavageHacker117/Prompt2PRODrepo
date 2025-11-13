// selection + transform controls + spawn tool + left-Ctrl parenting
import * as THREE from 'three'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'

export type InteractorAPI = {
  selection: Set<THREE.Object3D>
  setSelection: (objs: THREE.Object3D[], additive?: boolean) => void
  transform: TransformControls
}

export function initInteractor(engine: any): InteractorAPI | undefined {
  const scene: THREE.Scene | undefined = (window as any).__scene || engine.scene
  const camera: THREE.Camera | undefined = (window as any).__camera
  const gl: THREE.WebGLRenderer | undefined = (window as any).__renderer
  const dom = gl?.domElement
  if (!scene || !camera || !dom) { console.warn('Interactor: missing scene/camera/dom'); return }

  const selected: Set<THREE.Object3D> = (engine.selected ||= new Set<THREE.Object3D>())
  const ray = new THREE.Raycaster()
  const pt = new THREE.Vector2()
  const yPlane = new THREE.Plane(new THREE.Vector3(0,1,0), 0) // y=0

  // track Left-Ctrl only
  let leftCtrlDown = false
  window.addEventListener('keydown', e => { if (e.key === 'Control' && (e as any).location === 1) leftCtrlDown = true })
  window.addEventListener('keyup',   e => { if (e.key === 'Control' && (e as any).location === 1) leftCtrlDown = false })

  // Parenting (left-Ctrl + LMB first = parent; second = child)
  let parentPrimed: THREE.Object3D | null = null

  // Transform controls
  const tc = new TransformControls(camera, dom)
  tc.setMode('translate')
  tc.setSize(0.75)
  scene.add(tc)

  function pickables(): THREE.Object3D[] {
    const fromActors: THREE.Object3D[] =
      Array.isArray(engine.actors)
        ? engine.actors.map((a: any) => a?.root).filter(Boolean)
        : (engine.actors ? Object.values(engine.actors).map((a: any) => a?.root).filter(Boolean) : [])
    const fromSpawns: THREE.Object3D[] = engine.spawns?.getPickables?.() || []
    return [...fromActors, ...fromSpawns]
  }

  function rootOf(o: THREE.Object3D) {
    let p: any = o
    while (p && !p.userData?.pickRoot && p.parent) p = p.parent
    return p || o
  }

  function setSelection(objs: THREE.Object3D[], additive = false) {
    if (!additive) selected.clear()
    objs.forEach(o => selected.add(o))
    const last = [...selected].find(o => o.userData?.isActorRoot || o.userData?.isSpawn)
    if (last) tc.attach(last as any); else tc.detach()
    engine.onSelectChange?.(selected)
    console.debug('[Interactor] selection ->', [...selected].map(o => o.name || o.uuid))
  }

  function ndcFromEvent(e: PointerEvent) {
    const r = (dom as HTMLElement).getBoundingClientRect()
    pt.x =  ((e.clientX - r.left) / r.width) * 2 - 1
    pt.y = -((e.clientY - r.top)  / r.height) * 2 + 1
  }

  function handlePointerDown(e: PointerEvent) {
    if (e.button !== 0) return

    // ── Spawn tool intercept ─────────────────────
    const ui = engine.spawns?.ui
    if (ui && (ui.tool === 'place' || ui.tool === 'attach')) {
      ndcFromEvent(e)
      ray.setFromCamera(pt, camera)

      if (ui.tool === 'place') {
        const hit = new THREE.Vector3()
        if (ray.ray.intersectPlane(yPlane, hit)) {
          const sp = engine.spawns.create({
            type: ui.type, templateUrl: ui.templateUrl,
            respawnDelay: ui.respawnDelay, maxAlive: ui.maxAlive, position: hit
          })
          setSelection([sp.marker])
        }
        ui.tool = 'none'
        return
      }

      if (ui.tool === 'attach') {
        const hit = ray.intersectObjects(pickables(), true)[0]
        if (hit) {
          const root = rootOf(hit.object)
          const lastId = ui.lastCreatedId
          if (lastId) engine.spawns.attachToObject?.(lastId, root)
          setSelection([root])
        }
        ui.tool = 'none'
        return
      }
    }
    // ─────────────────────────────────────────────

    // Normal selection with plain LMB. Additive only with Left-Ctrl.
    ndcFromEvent(e)
    ray.setFromCamera(pt, camera)
    const hit = ray.intersectObjects(pickables(), true)[0]
    if (!hit) { setSelection([]); return }
    const root = rootOf(hit.object)

    // Parenting gesture: Left-Ctrl + LMB twice (parent then child)
    if (leftCtrlDown) {
      if (!parentPrimed) {
        parentPrimed = root
        setSelection([root]) // show which will become parent
        console.debug('[Interactor] primed parent:', parentPrimed.name || parentPrimed.uuid)
      } else {
        const parent = parentPrimed
        const child  = root
        parentPrimed = null
        if (parent !== child) {
          if (engine.bindings?.makeChild) {
            engine.bindings.makeChild(parent, child, { keepWorld: true })
          } else {
            // fallback: keep world transform
            const m = new THREE.Matrix4().copy(child.matrixWorld)
            parent.add(child)
            child.matrix.copy(m)
            child.matrix.decompose(child.position, child.quaternion, child.scale)
            child.updateMatrixWorld(true)
          }
          setSelection([parent, child], true)
        }
      }
      return
    }

    // Plain selection (no ctrl): click selects; Left-Ctrl adds
    setSelection([root], leftCtrlDown)
  }

  dom.addEventListener('pointerdown', handlePointerDown)

  // keyboard helpers
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Delete') {
      ;[...selected].forEach(o => o.parent?.remove(o))
      selected.clear(); tc.detach()
    }
    if (e.key === 'g') tc.setMode('translate')
    if (e.key === 'r') tc.setMode('rotate')
    if (e.key === 's') tc.setMode('scale')
  })

  const api: InteractorAPI = { selection: selected, setSelection, transform: tc }
  engine.interactor = api
  return api
}

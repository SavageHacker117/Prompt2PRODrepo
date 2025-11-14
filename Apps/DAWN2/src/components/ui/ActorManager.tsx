// src/components/ui/ActorManager.tsx
import React, { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import { addBinding } from '../../tools/BindingSystem'

function getEngine() {
  return (window as any).__engine || {}
}

type SceneActor = {
  id: string          // engine actor id (actor_xxx)
  name: string
  obj: THREE.Object3D | null
  api?: any           // GLBinject API for this actor, if available
}

/**
 * Collect actors from __engine.actors (GLBinject) plus any loose actor roots
 * in the scene. For GLBinject actors we keep the API so we can call
 * setScale / injectRig / wag, etc.
 */
function collectActors(): SceneActor[] {
  const eng = getEngine()
  const out: SceneActor[] = []
  const seen = new Set<THREE.Object3D>()

  const push = (
    id: string,
    name: string,
    obj: THREE.Object3D | null,
    api?: any,
  ) => {
    if (obj && seen.has(obj)) return
    if (obj) seen.add(obj)
    out.push({ id, name, obj, api })
  }

  const rawActors = eng.actors as any

  // Map-style: { actorId: api }
  if (rawActors && typeof rawActors === 'object' && !Array.isArray(rawActors)) {
    Object.entries<any>(rawActors).forEach(([id, api]) => {
      const obj: THREE.Object3D | null =
        (api && (api.object || api.root || api.obj)) || null
      const name: string =
        (api && (api.name || api.label)) ||
        obj?.name ||
        id

      if (!obj && !name) return
      push(id, name, obj, api)
    })
  } else if (Array.isArray(rawActors)) {
    // Array-style fallback, just in case
    ;(rawActors as any[]).forEach((a, idx) => {
      const obj: THREE.Object3D | null =
        (a && (a.object || a.root || a.obj)) || null
      const id = (a && a.id) || obj?.name || `actor_${idx}`
      const name =
        (a && (a.name || a.label)) ||
        obj?.name ||
        id
      push(id, name, obj, a)
    })
  }

  // Fallback: traverse scene for actor roots
  const scene: THREE.Scene | undefined = (window as any).__scene || eng.scene
  if (scene) {
    scene.traverse((o: any) => {
      if (o.userData?.isActorRoot || /^actor_/i.test(o.name)) {
        const id: string =
          o.userData?.actorId ||
          o.name ||
          o.uuid
        const name: string =
          o.userData?.name ||
          o.userData?.actorName ||
          o.name ||
          id
        push(id, name, o, undefined)
      }
    })
  }

  // De-dupe by id: prefer entries that have a GLBinject api
  const byId = new Map<string, SceneActor>()
  for (const a of out) {
    const cur = byId.get(a.id)
    if (!cur || (!!a.api && !cur.api)) byId.set(a.id, a)
  }

  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name))
}

// Safe scale reader so we never crash on "reading 'x'"
function getScaleFromObject(obj: THREE.Object3D | null): number {
  if (!obj) return 1
  const s: any = (obj as any).scale
  if (!s || typeof s.x !== 'number') return 1
  return Number.isFinite(s.x) ? s.x : 1
}

// Fallback focus helper if engine doesn't expose focus()
function focusObjectFallback(obj: THREE.Object3D) {
  const eng = getEngine()
  const scene: THREE.Scene | undefined = (window as any).__scene || eng.scene
  if (!scene) return

  const cam: THREE.Camera | undefined =
    eng.camera ||
    (window as any).__camera ||
    (eng.renderer && eng.renderer.camera)
  if (!cam) return

  const box = new THREE.Box3().setFromObject(obj)
  const center = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())
  const radius = Math.max(size.x, size.y, size.z) || 1

  const dir = new THREE.Vector3(0, 0.5, 1).normalize()
  cam.position.copy(center.clone().add(dir.multiplyScalar(radius * 2.5)))
  ;(cam as any).lookAt?.(center)
}

// Robust: only traverse when root is a real Object3D with traverse()
function boneNames(root?: THREE.Object3D | null): string[] {
  const names: string[] = []
  if (!root) return names
  const anyRoot: any = root
  if (typeof anyRoot.traverse !== 'function') {
    return names
  }

  anyRoot.traverse((o: any) => {
    if (o.isBone && o.name) names.push(o.name)
  })
  return names.sort()
}

export default function ActorManager() {
  const [actors, setActors] = useState<SceneActor[]>(collectActors())
  const [selectedId, setSelectedId] = useState<string>('')
  const [scale, setScale] = useState<number>(1)
  const [rig, setRig] = useState<number>(6)
  const eng = useMemo(getEngine, [])

  // keep list fresh
  useEffect(() => {
    const refresh = () => setActors(collectActors())
    const id = window.setInterval(refresh, 800)
    return () => window.clearInterval(id)
  }, [])

  // currently selected actor record + object/API
  const current = useMemo(
    () => actors.find((a) => a.id === selectedId) || null,
    [actors, selectedId],
  )
  const curObj = current?.obj || null
  const curApi = current?.api

  // auto-select first actor, and sync engine.activeActor
  useEffect(() => {
    if (!selectedId && actors.length) {
      const firstId = actors[0].id
      setSelectedId(firstId)
      eng.setActiveActor?.(firstId)
    }
  }, [actors, selectedId, eng])

  // sync scale slider from current actor (safely)
  useEffect(() => {
    setScale(getScaleFromObject(curObj))
  }, [curObj])

  const handleSelect = (id: string) => {
    setSelectedId(id)
    eng.setActiveActor?.(id)
  }

  const onFocus = () => {
    if (!curObj) return
    if (eng.focusActor && current?.id) {
      // optional helper on engine
      eng.focusActor(current.id)
    } else if (eng.focus) {
      eng.focus(curObj)
    } else {
      focusObjectFallback(curObj)
    }
  }

  const onScale = (v: number) => {
    setScale(v)
    if (curApi?.setScale) {
      // GLBinject-style actor
      curApi.setScale(v)
    } else if (curObj) {
      // raw THREE actor
      curObj.scale.setScalar(v)
    }
  }

  const inject = () => {
    if (!current) return
    if (curApi?.injectRig) {
      // GLBinject rig injection
      curApi.injectRig(rig)
    } else if (eng.bones?.inject && curObj) {
      // legacy fallback
      eng.bones.inject(curObj, rig)
    }
  }

  const wag = () => {
    if (!current) return
    if (curApi?.wag?.toggle) {
      curApi.wag.toggle()
    } else if (curApi?.wag?.start) {
      curApi.wag.start()
    } else if (eng.bones?.wag && curObj) {
      // legacy fallback
      eng.bones.wag(curObj)
    }
  }

  // Parent / Bind tools
  const [childId, setChildId] = useState<string>('')
  const [parentId, setParentId] = useState<string>('')
  const [bone, setBone] = useState<string>('')

  useEffect(() => {
    if (!childId && current) setChildId(current.id)
    if (!parentId && current) setParentId(current.id)
  }, [current, childId, parentId])

  const parentObj = actors.find((a) => a.id === parentId)?.obj || null
  const childObj = actors.find((a) => a.id === childId)?.obj || null
  const bones = useMemo(() => boneNames(parentObj), [parentObj])

  const makeChild = () => {
    if (!parentObj || !childObj || parentObj === childObj) return

    childObj.updateMatrixWorld()
    parentObj.updateMatrixWorld()

    const wp = new THREE.Vector3()
    const wq = new THREE.Quaternion()
    childObj.getWorldPosition(wp)
    childObj.getWorldQuaternion(wq)

    parentObj.add(childObj)
    childObj.position.copy(parentObj.worldToLocal(wp))
    childObj.quaternion.copy(wq)
  }

  const unparentToScene = () => {
    const scene: THREE.Scene | undefined = (window as any).__scene || eng.scene
    if (!scene || !childObj) return
    scene.attach(childObj)
  }

  const bindToBone = () => {
    if (!parentObj || !childObj) return
    addBinding({
      id: `bind_${Date.now().toString(36)}`,
      parent: { nodeId: parentObj.uuid, bone: bone || undefined },
      child: { nodeId: childObj.uuid },
      keepWorld: true,
    })
  }

  return (
    <div className="panel">
      <div className="label" style={{ marginBottom: 8 }}>
        Actors in Scene
      </div>

      <div className="row" style={{ gap: 8, marginBottom: 8 }}>
        <select
          className="input"
          value={selectedId}
          onChange={(e) => handleSelect(e.target.value)}
        >
          {actors.map((a, idx) => (
            <option key={`${a.id}_${idx}`} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <button className="btn" onClick={onFocus}>
          Focus
        </button>
      </div>

      <div
        className="row"
        style={{ gap: 8, alignItems: 'center', marginBottom: 8 }}
      >
        <div className="label" style={{ width: 60 }}>
          Scale
        </div>
        <input
          className="input"
          type="range"
          min={0.1}
          max={3}
          step={0.01}
          value={scale}
          onChange={(e) => onScale(parseFloat(e.target.value))}
        />
        <div className="label" style={{ width: 40, textAlign: 'right' }}>
          {scale.toFixed(2)}
        </div>
        <button className="btn" onClick={() => onScale(1)}>
          1×
        </button>
        <button className="btn" onClick={() => onScale(0.5)}>
          ½×
        </button>
        <button className="btn" onClick={() => onScale(2)}>
          2×
        </button>
      </div>

      <div
        className="row"
        style={{ gap: 8, alignItems: 'center', marginBottom: 10 }}
      >
        <div className="label" style={{ width: 60 }}>
          Rig
        </div>
        <input
          className="input num"
          type="number"
          min={1}
          max={20}
          value={rig}
          onChange={(e) =>
            setRig(parseInt(e.target.value || '6', 10))
          }
        />
        <button className="btn" onClick={inject}>
          Inject
        </button>
        <button className="btn" onClick={wag}>
          Wag
        </button>
      </div>

      <div
        className="panel"
        style={{ background: 'rgba(0,0,0,.25)', marginTop: 8 }}
      >
        <div
          className="label"
          style={{ fontWeight: 600, marginBottom: 6 }}
        >
          Parent / Bind
        </div>

        <div className="row" style={{ gap: 8, marginBottom: 6 }}>
          <div className="label" style={{ width: 70 }}>
            Child
          </div>
          <select
            className="input"
            value={childId}
            onChange={(e) => setChildId(e.target.value)}
            style={{ minWidth: 220 }}
          >
            {actors.map((a, idx) => (
              <option key={`${a.id}_child_${idx}`} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        <div className="row" style={{ gap: 8, marginBottom: 6 }}>
          <div className="label" style={{ width: 70 }}>
            Parent
          </div>
          <select
            className="input"
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            style={{ minWidth: 220 }}
          >
            {actors.map((a, idx) => (
              <option key={`${a.id}_parent_${idx}`} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <button className="btn" onClick={makeChild}>
            Make Child
          </button>
          <button className="btn" onClick={unparentToScene}>
            Unparent
          </button>
        </div>

        <div className="row" style={{ gap: 8, marginBottom: 6 }}>
          <div className="label" style={{ width: 70 }}>
            Bone
          </div>
          <select
            className="input"
            value={bone}
            onChange={(e) => setBone(e.target.value)}
            style={{ minWidth: 220 }}
          >
            <option value="">(no bone)</option>
            {bones.map((n, idx) => (
              <option key={`${n}_${idx}`} value={n}>
                {n}
              </option>
            ))}
          </select>
          <button
            className="btn"
            onClick={bindToBone}
            title="Bind child to parent (preserve world)"
          >
            Bind to Bone
          </button>
        </div>

        <div className="label" style={{ opacity: 0.7 }}>
          Tip: In the viewport hold <b>LeftCtrl</b> and click a child, then{' '}
          <b>LeftCtrl+Click</b> a second object to parent it quickly.
        </div>
      </div>
    </div>
  )
}

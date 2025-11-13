import React, { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import { addBinding } from '../../tools/BindingSystem'

function getEngine() {
  return (window as any).__engine || {}
}

/**
 * Normalize engine actors into {id,name,obj}
 * Supports both array and object maps:
 *   engine.actors = { [id]: { id, name, object } }  or  engine.actors = [...]
 */
function listSceneActors(): { id: string; name: string; obj: THREE.Object3D }[] {
  const eng = getEngine()
  const raw = eng.actors || {}
  const arr = Array.isArray(raw) ? raw : Object.values(raw)

  const seen = new Set<string>()
  const out: { id: string; name: string; obj: THREE.Object3D }[] = []

  for (const a of arr as any[]) {
    if (!a) continue

    // common fields: object / root / group / node
    const obj: THREE.Object3D | undefined =
      a.object || a.root || a.group || a.node
    if (!obj) continue

    const id: string = a.id || obj.uuid
    if (seen.has(id)) continue
    seen.add(id)

    const name: string =
      a.name ||
      obj.name ||
      obj.userData?.name ||
      id.slice(0, 8)

    out.push({ id, name, obj })
  }

  return out
}

function boneNames(root?: THREE.Object3D): string[] {
  const names: string[] = []
  if (!root) return names
  root.traverse((o: any) => {
    if (o.isBone && o.name) names.push(o.name)
  })
  return names.sort()
}

export default function ActorManager() {
  const [actors, setActors] = useState(listSceneActors())
  const [selectedId, setSelectedId] = useState<string>('')

  const [scale, setScale] = useState<number>(1)
  const [rig, setRig] = useState<number>(6)
  const eng = useMemo(getEngine, [])

  // refresh from engine periodically so new spawns show up
  useEffect(() => {
    const refresh = () => setActors(listSceneActors())
    const id = setInterval(refresh, 800)
    return () => clearInterval(id)
  }, [])

  // default selection to first actor
  useEffect(() => {
    if (!selectedId && actors.length) setSelectedId(actors[0].id)
  }, [actors, selectedId])

  const cur = useMemo(
    () => actors.find((a) => a.id === selectedId)?.obj || null,
    [actors, selectedId],
  )

  // keep engine's active actor in sync (so ANIM + debugger know what to drive)
  useEffect(() => {
    if (!selectedId) return
    eng.setActiveActor?.(selectedId)
  }, [selectedId, eng])

  // when current actor changes, update scale slider from its actual scale
  useEffect(() => {
    if (cur) setScale(cur.scale.x) // assume uniform scale
  }, [cur])

  const onFocus = () => eng.focus?.(cur)
  const onScale = (v: number) => {
    setScale(v)
    if (cur) cur.scale.setScalar(v)
  }
  const inject = () => eng.anim?.injectOn?.(cur, rig)
  const wag = () => eng.anim?.wag?.(cur)

  // Parent/Bind tools
  const [childId, setChildId] = useState<string>('')
  const [parentId, setParentId] = useState<string>('')
  const [bone, setBone] = useState<string>('')

  // default child/parent dropdowns to the selected actor
  useEffect(() => {
    if (!selectedId) return
    if (!childId) setChildId(selectedId)
    if (!parentId) setParentId(selectedId)
  }, [selectedId, childId, parentId])

  const parentObj = actors.find((a) => a.id === parentId)?.obj
  const childObj = actors.find((a) => a.id === childId)?.obj
  const bones = useMemo(() => boneNames(parentObj || undefined), [parentObj])

  const makeChild = () => {
    if (!parentObj || !childObj || parentObj === childObj) return
    // preserve world transform
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
    const scene: THREE.Scene | undefined =
      (window as any).__scene || eng.scene
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
          onChange={(e) => setSelectedId(e.target.value)}
        >
          {actors.map((a) => (
            <option key={a.id} value={a.id}>
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
          onChange={(e) => setRig(parseInt(e.target.value || '6'))}
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
            {actors.map((a) => (
              <option key={a.id} value={a.id}>
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
            {actors.map((a) => (
              <option key={a.id} value={a.id}>
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
            {bones.map((n) => (
              <option key={n} value={n}>
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

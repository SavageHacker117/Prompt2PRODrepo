// tools/BoneRuntime.js
import * as THREE from 'three'

export class BoneRuntime {
  constructor(root) {
    this.root = root
    this.entries = []   // { bones[], cb } or { bone, object }
    this._v = new THREE.Vector3()
    this._q = new THREE.Quaternion()
    this._s = new THREE.Vector3()
  }

  // Run callback for all bones whose name includes namePart (case-insensitive)
  add(namePart, cb) {
    const bones = []
    const lc = namePart.toLowerCase()
    this.root.traverse(o => { if (o.isBone && o.name.toLowerCase().includes(lc)) bones.push(o) })
    if (bones.length) this.entries.push({ bones, cb })
    return this
  }

  // Attach a Three.js object to a specific bone name (first match)
  attachObject(namePart, object3D) {
    let bone = null
    const lc = namePart.toLowerCase()
    this.root.traverse(o => { if (!bone && o.isBone && o.name.toLowerCase().includes(lc)) bone = o })
    if (!bone) return null
    bone.add(object3D)
    object3D.position.set(0,0,0)
    return object3D
  }

  update(dt) {
    for (const e of this.entries) {
      if (e.bones && e.cb) {
        for (const b of e.bones) {
          b.updateWorldMatrix(true, false)
          b.matrixWorld.decompose(this._v, this._q, this._s)
          e.cb({ bone: b, worldPos: this._v, worldQuat: this._q, worldScale: this._s, dt })
        }
      }
    }
  }
}

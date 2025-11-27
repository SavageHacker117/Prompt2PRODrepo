// DAWN2/src/weapon/GunRig.ts
import * as THREE from 'three'
import type { ScriptHost } from '../scriptBuilder/core/ScriptHost'
import { ensureEngine } from '../scriptBuilder/core/Engine' // if you want engine access :contentReference[oaicite:10]{index=10}

export type GunRigDef = {
  name: string            // e.g. "ak47.default"
  weaponKind: string      // "Ak47", "Shotgun", etc.
  attachBone?: string     // exact bone name (from ScriptHost.boneMap)
  localPos?: [number, number, number]   // meters, local to attach bone
  localRotDeg?: [number, number, number]// degrees, local rotation
  fireClip?: string       // optional animation clip names
  reloadClip?: string
  aimClip?: string
}

export class GunRigHost {
  private rigs = new Map<string, GunRigDef>()

  list(): string[] {
    return Array.from(this.rigs.keys())
  }

  get(name: string): GunRigDef | undefined {
    return this.rigs.get(name)
  }

  upsert(def: GunRigDef) {
    this.rigs.set(def.name, {
      localPos: [0, 0, 0],
      localRotDeg: [0, 0, 0],
      ...def,
    })
  }

  remove(name: string) {
    this.rigs.delete(name)
  }

  loadFromStorage() {
    const raw = localStorage.getItem('gunRigs.v1')
    if (!raw) return
    try {
      const arr: GunRigDef[] = JSON.parse(raw)
      this.rigs.clear()
      for (const def of arr) this.rigs.set(def.name, def)
    } catch { /* ignore */ }
  }

  saveToStorage() {
    const data = JSON.stringify(Array.from(this.rigs.values()))
    localStorage.setItem('gunRigs.v1', data)
  }

  /** Attach a weapon root to the correct bone using a rig. */
  applyRig(
    rigName: string,
    weaponRoot: THREE.Object3D,
    actorRoot: THREE.Object3D,
    scriptHost?: ScriptHost,
  ): boolean {
    const rig = this.rigs.get(rigName)
    if (!rig) return false

    let attachTo: THREE.Object3D | null = null

    // 1) Prefer ScriptHost.boneMap if provided
    const bm = scriptHost?.boneMap
    if (rig.attachBone && bm?.get(rig.attachBone)) {
      attachTo = bm.get(rig.attachBone) || null
    }

    // 2) Fallback: traverse actor by exact name
    if (!attachTo && rig.attachBone) {
      actorRoot.traverse(o => {
        if (!attachTo && o.name === rig.attachBone) attachTo = o
      })
    }

    // 3) Last resort: any "RightHand" / mixamo pattern (your current behavior). :contentReference[oaicite:11]{index=11}
    if (!attachTo) {
      actorRoot.traverse(n => {
        if (
          !attachTo &&
          /RightHand|hand\.R|mixamorigRightHand/i.test(n.name)
        ) {
          attachTo = n
        }
      })
    }

    if (!attachTo) return false

    attachTo.add(weaponRoot)

    const pos = rig.localPos || [0.06, 0.02, 0.02]
    const rot = rig.localRotDeg || [0, 180, 0]

    weaponRoot.position.set(pos[0], pos[1], pos[2])
    const [rx, ry, rz] = rot.map(THREE.MathUtils.degToRad)
    weaponRoot.rotation.set(rx, ry, rz)

    weaponRoot.updateMatrixWorld(true)
    return true
  }
}

// global singleton, same pattern as ensureEngine() :contentReference[oaicite:12]{index=12}
export function ensureGunRigHost(): GunRigHost {
  const w = window as any
  if (!w.__gunRigHost) {
    const h = new GunRigHost()
    h.loadFromStorage()
    w.__gunRigHost = h
  }
  return w.__gunRigHost as GunRigHost
}

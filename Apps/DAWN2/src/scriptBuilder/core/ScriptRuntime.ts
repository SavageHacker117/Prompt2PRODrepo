import * as THREE from 'three'
import { eulerLerp, findSegment } from './AnimGraph'

export type ScriptFrame = {
  t: number              // seconds (monotonic, ascending)
  rot?: [number, number, number] // radians
  pos?: [number, number, number]
  scl?: [number, number, number]
}

export type ScriptDef = {
  name: string
  target: string         // bone name
  loop: boolean
  mode: 'offset' | 'absolute'
  frames: ScriptFrame[]
}

export class ScriptRuntime {
  private t = 0
  private playing = false
  constructor(public def: ScriptDef, private bone: THREE.Object3D) {}

  start() { this.t = 0; this.playing = true }
  stop() { this.playing = false }

  update(dt: number) {
    if (!this.playing) return
    const frames = this.def.frames
    if (!frames.length) return

    const lastT = frames[frames.length - 1].t
    this.t += dt
    let time = this.t
    if (this.def.loop && lastT > 0) time = this.t % lastT
    if (!this.def.loop && this.t > lastT) { this.stop(); return }

    const [fa, fb, tt] = findSegment(frames, time)

    if (!fa || !fb) return

    // rotation
    if (fa.rot || fb.rot) {
      const ar = new THREE.Euler(...(fa.rot || [0, 0, 0]))
      const br = new THREE.Euler(...(fb.rot || fa.rot || [0, 0, 0]))
      const er = eulerLerp(ar, br, tt)
      if (this.def.mode === 'absolute') {
        this.bone.rotation.set(er.x, er.y, er.z)
      } else {
        this.bone.rotation.x = er.x
        this.bone.rotation.y = er.y
        this.bone.rotation.z = er.z
      }
    }

    // position
    if (fa.pos || fb.pos) {
      const ap = fa.pos || [0, 0, 0]
      const bp = fb.pos || ap
      const x = ap[0] + (bp[0] - ap[0]) * tt
      const y = ap[1] + (bp[1] - ap[1]) * tt
      const z = ap[2] + (bp[2] - ap[2]) * tt
      if (this.def.mode === 'absolute') {
        this.bone.position.set(x, y, z)
      } else {
        this.bone.position.x = x
        this.bone.position.y = y
        this.bone.position.z = z
      }
    }

    if (fa.scl || fb.scl) {
      const as = fa.scl || [1, 1, 1]
      const bs = fb.scl || as
      const x = as[0] + (bs[0] - as[0]) * tt
      const y = as[1] + (bs[1] - as[1]) * tt
      const z = as[2] + (bs[2] - as[2]) * tt
      this.bone.scale.set(x, y, z)
    }
  }
}

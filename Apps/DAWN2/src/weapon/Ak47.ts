// DAWN2/src/weapon/Ak47.ts
import * as THREE from 'three'
import { BulletPool } from './BulletPool'
import { MuzzleFlash } from './MuzzleFlash'
import { ensureGunRigHost } from './GunRig'

export class Ak47 {
  root = new THREE.Object3D()
  muzzle = new MuzzleFlash()
  ammo = { cur: 30, max: 30, reloading: false }

  // optional rig name
  constructor(
    public scene: THREE.Scene,
    public bullets: BulletPool,
    public rigName: string = 'ak47.default',
  ) {}

  /** Generic attach that uses GunRigHost first, then falls back to regex. */
  attach(actor: THREE.Object3D) {
    const host = ensureGunRigHost()

    const rigOk = host.applyRig(
      this.rigName,
      this.root,
      actor,
      (window as any).__scriptHost,
    )

    if (!rigOk) {
      // fallback: your previous behavior
      let hand: THREE.Object3D | null = null
      actor.traverse(n => {
        if (!hand && /RightHand|hand\.R|mixamorigRightHand/i.test(n.name))
          hand = n
      })
      ;(hand || actor).add(this.root)
      this.root.position.set(0.06, 0.02, 0.02)
      this.root.rotation.set(0, Math.PI, 0)
    }

    this.muzzle.attach(this.root)
  }

  // backwards-compatible alias
  attachToRightHand(actor: THREE.Object3D) {
    this.attach(actor)
  }

  update(dt: number) {
    this.muzzle.update(dt)
  }

  fire(from: THREE.Vector3, dir: THREE.Vector3) {
    if (this.ammo.reloading || this.ammo.cur <= 0) return
    this.ammo.cur--
    this.muzzle.trigger()
    const hit = this.bullets.fire(from, dir)
    // TODO: recoil cam kick
  }

  reload() {
    if (this.ammo.reloading || this.ammo.cur === this.ammo.max) return
    this.ammo.reloading = true
    setTimeout(() => {
      this.ammo.cur = this.ammo.max
      this.ammo.reloading = false
    }, 1200)
  }
}

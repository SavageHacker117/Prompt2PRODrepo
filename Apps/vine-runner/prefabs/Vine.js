import * as THREE from 'three'

class Vine {
  constructor(scene, { anchorX, anchorY, anchorZ, length=6, phase=0 }) {
    this.type = 'vine'
    this.anchor = new THREE.Vector3(anchorX, anchorY, anchorZ)
    this.length = length
    this.phase = phase
    this.time = 0

    const ropeMat = new THREE.LineBasicMaterial({ color: 0x8ef6d3 })
    const ropeGeom = new THREE.BufferGeometry().setFromPoints([this.anchor, this.anchor.clone().add(new THREE.Vector3(0,-length,0))])
    this.rope = new THREE.Line(ropeGeom, ropeMat)
    scene.add(this.rope)

    this.handle = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 12), new THREE.MeshStandardMaterial({ color: 0x22d3ee }))
    this.handle.castShadow = true; this.handle.receiveShadow = true
    scene.add(this.handle)

    this.catchRadius = 0.6
    this.playerAttached = false
    this.player = null
  }

  update(dt) {
    this.time += dt
    const swing = Math.sin(this.time*1.2 + this.phase) * 0.6
    const end = new THREE.Vector3(
      this.anchor.x + Math.sin(swing) * this.length,
      this.anchor.y - Math.cos(swing) * this.length,
      this.anchor.z
    )
    this.rope.geometry.setFromPoints([this.anchor, end])
    this.handle.position.copy(end)
    if (this.playerAttached && this.player) {
      this.player.position.copy(end).add({x:0, y:-0.7, z:0})
      this.player.velocity.set(4.5, 0, 0)
    }
  }

  tryAttach(player) {
    if (this.playerAttached) return
    const dist = this.handle.position.distanceTo(player.position)
    if (dist < this.catchRadius) {
      this.playerAttached = true
      this.player = player
    }
  }
  detach() { this.playerAttached = false; this.player = null }

  dispose(){ this.rope.geometry.dispose(); this.rope.material.dispose(); this.rope.removeFromParent(); this.handle.geometry.dispose(); this.handle.material.dispose(); this.handle.removeFromParent() }
}

export const VineFactory = {
  vine(scene, def){ return new Vine(scene, def) }
}

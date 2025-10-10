
import * as THREE from 'three'

export class MagnetField {
  constructor(scene){
    this.scene = scene
    this.enabled = true
    this.center = new THREE.Vector2(0, -18)
    this.strength = 28
  }
  affect(ball, dt){
    if (!this.enabled) return
    if (ball.pos.y < -8){
      const to = new THREE.Vector2(this.center.x - ball.pos.x, this.center.y - ball.pos.y)
      const d = Math.max(2.0, to.length())
      const pull = this.strength/(d*d)
      ball.vel.x += (to.x/d)*pull*dt*30.0
      ball.vel.y += (to.y/d)*pull*dt*30.0
    }
  }
}

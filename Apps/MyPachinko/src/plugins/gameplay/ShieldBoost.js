
export class ShieldBoost {
  constructor(scene){
    this.scene = scene
    this.enabled = true
    this.radius = 1.05
  }
  affect(ball, dt){
    // simple "thicker" balls when shield is active — increases bounce on pegs
    if (!this.enabled) return
    ball.radius = 1.05
  }
}

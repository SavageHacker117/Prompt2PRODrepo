
export class PowerOrb {
  constructor(scene){
    this.scene = scene
    this.multiplier = 1.0
  }
  affect(ball, dt){
    // if ball is fast, grant small extra multiplier on score (applied in scoring logic by scene if extended)
    // kept as placeholder for extended rules
  }
}

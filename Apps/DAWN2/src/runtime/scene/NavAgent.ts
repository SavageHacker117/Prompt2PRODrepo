// NavAgent.ts
import * as THREE from 'three'
export class NavAgent {
  constructor(public root: THREE.Object3D){ }
  setDestination(p: THREE.Vector3){ this.root.userData.navTarget = p.clone() }
  update(dt:number){
    const t = this.root.userData.navTarget as THREE.Vector3 | undefined
    if (!t) return
    const d = t.clone().sub(this.root.position)
    if (d.length() < 0.02) { delete this.root.userData.navTarget; return }
    this.root.position.add(d.normalize().multiplyScalar(dt * 1.5))
  }
}

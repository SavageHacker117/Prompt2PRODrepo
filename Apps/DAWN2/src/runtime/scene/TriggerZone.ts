// TriggerZone.ts
import * as THREE from 'three'
export class TriggerZone {
  mesh: THREE.Mesh
  constructor(center = new THREE.Vector3(), size = new THREE.Vector3(1,1,1)){
    const g = new THREE.BoxGeometry(size.x,size.y,size.z)
    const m = new THREE.MeshBasicMaterial({ color:0xffaa00, wireframe:true })
    this.mesh = new THREE.Mesh(g,m)
    this.mesh.position.copy(center)
    this.mesh.userData.pickRoot = true
  }
  contains(p: THREE.Vector3){ const b = new THREE.Box3().setFromObject(this.mesh); return b.containsPoint(p) }
}

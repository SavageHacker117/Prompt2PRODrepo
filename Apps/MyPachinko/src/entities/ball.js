
import * as THREE from 'three'

export function makeBall(pos){
  const geo = new THREE.SphereGeometry(1.0, 24, 24)
  const mat = new THREE.MeshStandardMaterial({ color: 0x9ad8ff, roughness: 0.25, metalness: 0.35 })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.copy(pos)
  return {
    mesh,
    pos: pos.clone(),
    vel: new THREE.Vector3((Math.random()-0.5)*8, 0, 0),
    radius: 1.0,
    scored: false
  }
}

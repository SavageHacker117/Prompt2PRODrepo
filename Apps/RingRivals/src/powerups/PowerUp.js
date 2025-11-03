import * as THREE from 'three';

export class PowerUp {
  constructor(type, pos){
    this.type = type;
    const color = {SPEED:0x66ffcc, DAMAGE:0xff8a50, GUARD:0x6aa6ff, STAM:0xffff66}[type] ?? 0xffffff;
    const g = new THREE.TorusKnotGeometry(0.25, 0.07, 64, 8);
    const m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .25, metalness:.2, roughness:.4 });
    this.mesh = new THREE.Mesh(g, m);
    this.mesh.position.copy(pos);
    this.mesh.castShadow = true;
    this.t = 0;
  }
  addTo(scene){ scene.add(this.mesh); }
  update(dt){ this.t+=dt; this.mesh.rotation.y += dt*2.2; this.mesh.position.y = 1.3 + Math.sin(this.t*3)*0.12; }
  dispose(scene){ scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}

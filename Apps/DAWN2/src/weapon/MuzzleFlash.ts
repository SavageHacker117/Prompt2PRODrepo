import * as THREE from 'three';

export class MuzzleFlash {
  sprite: THREE.Mesh;
  t = 0;

  constructor() {
    const geo = new THREE.PlaneGeometry(0.3, 0.3);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffee88, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.sprite = new THREE.Mesh(geo, mat);
    this.sprite.renderOrder = 999;
    this.sprite.visible = false;
  }

  attach(bone: THREE.Object3D) { bone.add(this.sprite); }

  trigger() { this.t = 0.06; this.sprite.visible = true; }

  update(dt:number) {
    if (this.t <= 0) return this.sprite.visible = false;
    this.t -= dt;
    (this.sprite.material as THREE.MeshBasicMaterial).opacity = Math.max(0, this.t / 0.06);
    this.sprite.rotation.z += dt * 20;
  }
}

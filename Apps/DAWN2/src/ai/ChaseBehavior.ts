import * as THREE from 'three';

export class ChaseBehavior {
  constructor(public actor: THREE.Object3D, public getTarget: ()=> THREE.Object3D | null, public speed=1.2) {}

  update(dt:number) {
    const t = this.getTarget();
    if (!t) return;
    const pos = this.actor.position;
    const to = t.position.clone().sub(pos);
    to.y = 0;
    const d = to.length();
    if (d < 0.05) return;
    to.normalize().multiplyScalar(this.speed * dt);
    pos.add(to);

    const yaw = Math.atan2(to.x, to.z);
    this.actor.rotation.y += (yaw - this.actor.rotation.y) * Math.min(1, dt * 10);
  }
}

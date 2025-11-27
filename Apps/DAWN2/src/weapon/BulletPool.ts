import * as THREE from 'three';

export type Hit = { point: THREE.Vector3; normal: THREE.Vector3; object: THREE.Object3D | null; };

export class BulletPool {
  ray = new THREE.Raycaster();
  maxDist = 200;
  tmpV = new THREE.Vector3();

  constructor(public scene: THREE.Scene, public impact?: (hit: Hit)=> void) {}

  fire(origin: THREE.Vector3, dir: THREE.Vector3, layers?: number[]) {
    this.ray.set(origin, dir.normalize());
    const hits = this.ray.intersectObjects(this.scene.children, true);
    const hit = hits.find(h =>
      !h.object.userData?.isPlayer && (!layers || layers.includes(h.object.layers.mask))
    );
    if (hit) {
      this.impact?.({ point: hit.point.clone(), normal: hit.face?.normal?.clone() || new THREE.Vector3(), object: hit.object });
      // rudimentary "damage" hook
      (hit.object as any)?.userData?.damage?.(10);
      return hit.point.clone();
    }
    return origin.clone().add(dir.multiplyScalar(this.maxDist));
  }
}

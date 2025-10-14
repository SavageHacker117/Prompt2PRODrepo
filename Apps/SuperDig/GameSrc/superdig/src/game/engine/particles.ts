import * as THREE from "three";

export type ParticleSystem = {
  update(dt: number): void;
  object: THREE.Object3D;
};

export function createDust(scene: THREE.Scene): ParticleSystem {
  const geo = new THREE.BufferGeometry();
  const COUNT = 200;
  const pos = new Float32Array(COUNT * 3);
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ size: 0.08, color: 0x886644 });
  const points = new THREE.Points(geo, mat);
  points.visible = false;
  scene.add(points);

  return {
    object: points,
    update: () => { /* noop for Phase A */ }
  };
}

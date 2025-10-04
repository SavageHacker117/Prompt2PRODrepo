import * as THREE from "three";

let _ball: THREE.Mesh | null = null;

export function loadTestBall(scene: THREE.Scene) {
  if (_ball) return;

  const geo = new THREE.SphereGeometry(0.35, 32, 16);
  const mat = new THREE.MeshStandardMaterial({ metalness: 0.1, roughness: 0.5 });
  _ball = new THREE.Mesh(geo, mat);
  _ball.castShadow = _ball.receiveShadow = true;
  _ball.name = "TestBall";
  _ball.position.set(1.2, 0.35, 0);

  scene.add(_ball);
  console.log("[TestBall] loaded");
}

export function unloadTestBall(scene: THREE.Scene) {
  if (!_ball) return;
  scene.remove(_ball);
  _ball.geometry.dispose();
  (Array.isArray(_ball.material) ? _ball.material : [_ball.material]).forEach((m) => (m as any)?.dispose?.());
  _ball = null;
  console.log("[TestBall] unloaded");
}


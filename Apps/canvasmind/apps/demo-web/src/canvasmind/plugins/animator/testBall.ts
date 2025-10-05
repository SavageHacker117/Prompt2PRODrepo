import * as THREE from "three";

let _ball: THREE.Mesh | null = null;

/**
 * TestBall (discoverable by injectors via name="CM_TestBall")
 * - Safe to call repeatedly (will replace existing node)
 * - PBR material ready for texture injection (albedo/normal/roughness/etc.)
 */
export function loadTestBall(scene: THREE.Scene) {
  // If one already exists, remove it first so we can re-create cleanly.
  if (_ball) unloadTestBall(scene);

  const geo = new THREE.SphereGeometry(0.5, 48, 32);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.05,
    roughness: 0.85,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "CM_TestBall";            // <— important: used by __CM_INJECT.*
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.position.set(1.2, 0.5, 0);

  scene.add(mesh);
  _ball = mesh;

  console.log("[TestBall] loaded as CM_TestBall");
  return { node: mesh };
}

export function unloadTestBall(scene: THREE.Scene) {
  if (!_ball) return;

  try {
    // Dispose geometry
    _ball.geometry?.dispose?.();

    // Dispose any textures that might have been injected later
    const m: any = _ball.material;
    const texKeys = [
      "map", "normalMap", "roughnessMap", "metalnessMap",
      "aoMap", "emissiveMap", "displacementMap", "alphaMap", "bumpMap"
    ];
    for (const k of texKeys) {
      const t = m?.[k];
      if (t && t.isTexture) {
        try { t.dispose?.(); } catch {}
        m[k] = null;
      }
    }
    m?.dispose?.();
  } catch {}

  _ball.parent?.remove(_ball);
  _ball = null;

  console.log("[TestBall] unloaded");
}

import * as THREE from "three";

/**
 * A transparent “shadow-only” ground plane to make meshes look grounded
 * against an image skybox. Move/tilt this to align with the photo’s floor.
 */
export function makeShadowCatcher(size = 40, opacity = 0.35) {
  const geo = new THREE.PlaneGeometry(size, size);
  const mat = new THREE.ShadowMaterial({ opacity });
  const plane = new THREE.Mesh(geo, mat);
  plane.rotation.x = -Math.PI / 2;
  plane.receiveShadow = true;
  return plane;
}

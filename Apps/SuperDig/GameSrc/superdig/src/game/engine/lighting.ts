import * as THREE from "three";

export function createLighting(scene: THREE.Scene) {
  // No lights by design (MeshBasicMaterial everywhere).
  // Return a toggle API so we can add later if needed.
  const group = new THREE.Group();
  scene.add(group);

  return {
    enableAmbient(color = 0x222233) {
      const amb = new THREE.AmbientLight(color, 0.8);
      group.add(amb);
      return amb;
    },
    clear() {
      group.clear();
    }
  };
}

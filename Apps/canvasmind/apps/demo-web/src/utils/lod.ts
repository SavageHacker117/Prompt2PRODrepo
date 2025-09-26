import * as THREE from "three";

export function makeBasicLOD(node: THREE.Object3D) {
  const lod = new THREE.LOD();
  lod.addLevel(node.clone(), 0);

  const mid = node.clone();
  mid.traverse((o: any) => {
    if (o.isMesh) {
      // shave a little work for the mid distance
      o.receiveShadow = false;
      o.castShadow = false;
    }
  });
  lod.addLevel(mid, 15);

  const far = new THREE.Mesh(
    new THREE.SphereGeometry(0.4, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0x666666 })
  );
  lod.addLevel(far, 35);

  return lod;
}

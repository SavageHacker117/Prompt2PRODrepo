// src/engine/perf/LOD.ts
import * as THREE from "three";

export type LODDistances = {
  mid: number;
  far: number;
};

/**
 * Wrap a mesh/group in a simple THREE.LOD:
 * - 0m: full copy
 * - mid: copy without shadows
 * - far: tiny sphere impostor
 */
export function makeBasicLOD(
  node: THREE.Object3D,
  distances: Partial<LODDistances> = {}
): THREE.LOD {
  const midDist = distances.mid ?? 15;
  const farDist = distances.far ?? 35;

  const lod = new THREE.LOD();
  lod.addLevel(node.clone(), 0);

  const mid = node.clone();
  mid.traverse((o: any) => {
    if (o.isMesh) {
      o.castShadow = false;
      o.receiveShadow = false;
    }
  });
  lod.addLevel(mid, midDist);

  const far = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0x666666 })
  );
  lod.addLevel(far, farDist);

  return lod;
}

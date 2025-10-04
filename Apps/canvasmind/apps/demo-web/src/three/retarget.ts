// apps/demo-web/src/three/retarget.ts
import * as THREE from "three";

/** Minimal retarget stub: copies animation from a source skeleton to a target.
 * Replace with a proper solver later (FABRIK/CCDIK). */
export function simpleRetarget(source: THREE.SkinnedMesh, target: THREE.SkinnedMesh, boneMap: Record<string,string>) {
  const sBones = new Map(source.skeleton.bones.map(b => [b.name, b]));
  const tBones = new Map(target.skeleton.bones.map(b => [b.name, b]));
  for (const [srcName, dstName] of Object.entries(boneMap)) {
    const s = sBones.get(srcName); const t = tBones.get(dstName);
    if (!s || !t) continue;
    t.position.copy(s.position);
    t.quaternion.copy(s.quaternion);
    t.updateMatrixWorld(true);
  }
}

/** Quick detector: does a loaded scene have any skinned meshes? */
export function findSkinnedMeshes(root: THREE.Object3D): THREE.SkinnedMesh[] {
  const arr: THREE.SkinnedMesh[] = [];
  root.traverse((o: any) => { if (o.isSkinnedMesh) arr.push(o); });
  return arr;
}

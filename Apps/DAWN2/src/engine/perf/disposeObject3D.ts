// src/engine/perf/disposeObject3D.ts
import * as THREE from "three";

function disposeMaterial(mat: any) {
  if (!mat) return;

  const texKeys = [
    "map",
    "normalMap",
    "roughnessMap",
    "metalnessMap",
    "emissiveMap",
    "aoMap",
    "bumpMap",
    "alphaMap",
    "displacementMap",
    "envMap",
    "specularMap",
  ];

  for (const k of texKeys) {
    const tex = mat[k];
    if (tex && (tex as any).isTexture && typeof tex.dispose === "function") {
      try {
        tex.dispose();
      } catch {
        /* ignore */
      }
    }
  }

  try {
    mat.dispose?.();
  } catch {
    /* ignore */
  }
}

/** Fully dispose a node + its meshes and detach from parent. */
export function disposeObject3D(node: THREE.Object3D) {
  node.traverse((o: any) => {
    if (o.isMesh) {
      try {
        o.geometry?.dispose?.();
      } catch {
        /* ignore */
      }
      disposeMaterial(o.material);
    }
  });

  node.parent?.remove(node);
}

import * as THREE from "three";
import { makeNeRFMaterial } from "./NeRFMaterial.js";

export function makeNeRFVolume(opts) {
  const { gridTex, size = 1 } = opts;
  // a unit cube volume we place in world
  const geo = new THREE.BoxGeometry(size, size, size);
  const mat = makeNeRFMaterial({ gridTex });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  // update camera uniform per frame
  mesh.onBeforeRender = (renderer, scene, camera) => {
    mat.uniforms.uCamPos.value.copy(camera.position);
    mat.uniforms.uInvWorld.value.copy(mesh.matrixWorld).invert();
  };
  return mesh;
}

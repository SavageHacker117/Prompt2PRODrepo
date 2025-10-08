import * as THREE from "three";

/** Load a tiny JSON grid { size: [X,Y,Z], data: Float32Array-like flattened RGBA } */
export async function loadGridJSON(url) {
  const res = await fetch(url);
  const json = await res.json();
  const [sx, sy, sz] = json.size;
  const arr = new Float32Array(json.data); // length = sx*sy*sz*4

  // WebGL2 3D texture (RGBA32F)
  const tex = new THREE.Data3DTexture(arr, sx, sy, sz);
  tex.type = THREE.FloatType;
  tex.format = THREE.RGBAFormat;
  tex.internalFormat = "RGBA32F";
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.unpackAlignment = 1;
  tex.needsUpdate = true;
  return tex;
}

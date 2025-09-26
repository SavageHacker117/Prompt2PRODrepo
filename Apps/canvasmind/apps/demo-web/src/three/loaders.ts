import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export const textureLoader = new THREE.TextureLoader();
export const gltfLoader = new GLTFLoader();

export async function loadSkyboxEquirect(url: string): Promise<THREE.Texture> {
  const tex = await textureLoader.loadAsync(url);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export async function loadMeshGLTF(url: string): Promise<THREE.Group> {
  const gltf = await gltfLoader.loadAsync(url);
  const node = gltf.scene;
  node.traverse((o: any) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return node;
}

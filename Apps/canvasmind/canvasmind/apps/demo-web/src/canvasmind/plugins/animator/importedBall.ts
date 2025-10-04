import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

let _remote: THREE.Object3D | null = null;
const _loader = new GLTFLoader();

export async function loadImportedBall(scene: THREE.Scene, url: string) {
  if (_remote) unloadImportedBall(scene);
  const gltf = await _loader.loadAsync(url);
  _remote = gltf.scene;
  _remote.traverse((o: any) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  _remote.position.set(-1.2, 0, 0);
  scene.add(_remote);
  console.log("[ImportedBall] loaded from", url);
  return _remote;
}

export function unloadImportedBall(scene: THREE.Scene) {
  if (!_remote) return;
  scene.remove(_remote);
  _remote.traverse((o: any) => {
    if ((o as any).isMesh) {
      try { (o as any).geometry?.dispose?.(); } catch {}
      const mat = (o as any).material;
      if (Array.isArray(mat)) mat.forEach(m => { try { (m as any).dispose?.(); } catch {} });
      else if (mat) try { (mat as any).dispose?.(); } catch {}
    }
  });
  _remote = null;
  console.log("[ImportedBall] unloaded");
}

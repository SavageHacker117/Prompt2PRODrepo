import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

const gltfLoader = new GLTFLoader();
const draco = new DRACOLoader();
draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.6/");
gltfLoader.setDRACOLoader(draco);
gltfLoader.setMeshoptDecoder(MeshoptDecoder);

async function headOK(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { method: "HEAD", cache: "no-store" });
    return r.ok;
  } catch {
    return false;
  }
}

export async function tryLoadCar(url: string): Promise<THREE.Group | null> {
  if (!(await headOK(url))) return null;
  const gltf = await gltfLoader.loadAsync(url);
  const node = gltf.scene as THREE.Group;
  node.traverse((o: any) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      if (o.material && "envMapIntensity" in o.material) (o.material as any).envMapIntensity = 0.8;
    }
  });
  node.name = "CM_Car";
  return node;
}

/** Robust loader that tries the right absolute + case-correct paths first. */
export async function loadCar(url = "/assets/carglb/Car.glb"): Promise<THREE.Group> {
  const tries = [
    url,                 // prefer absolute + correct case
    "/assets/carglb/Car.glb",   // absolute, capital C (your file)
    "/assets/carglb/car.glb",   // absolute, lower-case fallback if you rename later

  ];

  for (const u of tries) {
    const g = await tryLoadCar(u);
    if (g) return g;
  }
  throw new Error(`Car.glb not found. Tried: ${tries.join(", ")}`);
}

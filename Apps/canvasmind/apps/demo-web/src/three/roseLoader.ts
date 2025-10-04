import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

let _rose: THREE.Object3D | null = null;
let _mixer: THREE.AnimationMixer | null = null;
let _clips: THREE.AnimationClip[] = [];

const gltfLoader = new GLTFLoader();
const draco = new DRACOLoader();
draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.6/");
gltfLoader.setDRACOLoader(draco);
gltfLoader.setMeshoptDecoder(MeshoptDecoder);

export async function loadRose(scene: THREE.Scene, url: string) {
  if (_rose) unloadRose(scene);

  const gltf = await gltfLoader.loadAsync(url);
  _rose = gltf.scene;
  _clips = gltf.animations || [];
  _mixer = new THREE.AnimationMixer(_rose);

  // default placement
  _rose.position.set(0, 0, 0);
  _rose.traverse((o: any) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });

  scene.add(_rose);
  console.log(`[Rose] loaded. bones=${countBones(_rose)} clips=${_clips.map(c => c.name).join(", ") || "none"}`);

  return { rose: _rose, mixer: _mixer, animations: _clips };
}

export function unloadRose(scene: THREE.Scene) {
  if (!_rose) return;
  scene.remove(_rose);
  disposeObject3D(_rose);
  _rose = null;
  _mixer = null;
  _clips = [];
  console.log("[Rose] unloaded");
}

export function playRoseAction(action: "walk" | "run" | "jump", loops = 2, crossFade = 0.25) {
  if (!_mixer || !_rose) return;

  const find = (name: string) =>
    THREE.AnimationClip.findByName(_clips, name) ||
    _clips.find(c => c.name.toLowerCase().includes(name.toLowerCase()));

  const wanted =
    action === "walk" ? (find("walk") || find("idle")) :
    action === "run"  ? (find("run")  || find("sprint")) :
                        (find("jump") || find("hop"));

  if (!wanted) { console.warn(`[Rose] no clip for "${action}"`); return; }

  // fade from all current actions
  _mixer.stopAllAction();
  const act = _mixer.clipAction(wanted);
  act.setLoop(THREE.LoopRepeat, loops);
  act.reset();
  act.fadeIn(crossFade).play();
}

export function updateRose(deltaSeconds: number) {
  if (_mixer) _mixer.update(deltaSeconds);
}

/* helpers */
function countBones(root: THREE.Object3D) {
  let bones = 0;
  root.traverse(o => { if ((o as any).isBone) bones++; });
  return bones;
}

function disposeObject3D(node: THREE.Object3D) {
  node.traverse((o: any) => {
    if (o.isMesh) {
      try { o.geometry?.dispose?.(); } catch {}
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(m => { try { (m as any).dispose?.(); } catch {} });
      }
    }
  });
}

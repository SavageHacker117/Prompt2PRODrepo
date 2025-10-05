import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { sendTelemetry } from "../canvasmind/telemetry/client";

const CH = "http://localhost:8088";

let _rose: THREE.Object3D | null = null;
let _mixer: THREE.AnimationMixer | null = null;
let _clips: THREE.AnimationClip[] = [];

const gltfLoader = new GLTFLoader();
const draco = new DRACOLoader();
draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.6/");
gltfLoader.setDRACOLoader(draco);
gltfLoader.setMeshoptDecoder(MeshoptDecoder);

export async function loadRose(scene: THREE.Scene, url: string) {
  // Ensure idempotency: if already present, unload the old one.
  await unloadRose(scene);

  const gltf = await gltfLoader.loadAsync(url);
  _rose = gltf.scene;
  _clips = gltf.animations || [];
  _mixer = new THREE.AnimationMixer(_rose);

  // Tag and name for easy discovery & bulk removal later
  _rose.name = "CM_Rose";
  (_rose as any).userData.__isRose = true;

  // default placement
  _rose.position.set(0, 0, 0);
  _rose.traverse((o: any) => {
    if (o.isMesh) {
      o.castShadow = o.receiveShadow = true;
      // Mark children, too (some tools copy nodes)
      o.userData.__isRose = true;
    }
  });

  scene.add(_rose);

  console.log(
    `[Rose] loaded. bones=${countBones(_rose)} clips=${_clips.map(c => c.name).join(", ") || "none"}`
  );

  // Telemetry
  void sendTelemetry(CH, {
    prompt: "rose-character",
    candidate: { type: "character", model: "rose.glb", url },
    chosen: true,
    dwell_time: 0
  });

  return { rose: _rose, mixer: _mixer, animations: _clips };
}

export async function unloadRose(scene: THREE.Scene) {
  // Stop animations first so nothing keeps references alive.
  try { _mixer?.stopAllAction?.(); } catch {}
  _mixer = null;
  _clips = [];

  // Collect all rose nodes (by name or tag) in case there are duplicates.
  const targets: THREE.Object3D[] = [];
  scene.traverse((o: any) => {
    if (o?.name === "CM_Rose" || o?.userData?.__isRose) targets.push(o);
  });

  const before = targets.length;
  for (const node of dedupeParents(targets)) {
    try {
      node.parent?.remove(node);
      deepDispose(node);
    } catch (e) {
      console.warn("[Rose] dispose error:", e);
    }
  }

  _rose = null;

  // Double-check: if anything named CM_Rose lingers, log it.
  const leftovers = [];
  scene.traverse((o) => { if (o.name === "CM_Rose") leftovers.push(o); });

  console.log(`[Rose] unload requested → removed=${before} leftovers=${leftovers.length}`);

  // Telemetry
  void sendTelemetry(CH, {
    prompt: "rose-character",
    candidate: { type: "character", model: "rose.glb" },
    chosen: false,
    dwell_time: 0
  });
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

  _mixer.stopAllAction();
  const act = _mixer.clipAction(wanted);
  act.setLoop(THREE.LoopRepeat, loops);
  act.reset();
  act.fadeIn(crossFade).play();

  // Telemetry
  void sendTelemetry(CH, {
    prompt: "rose-action",
    candidate: { type: "character_action", action, loops },
    chosen: true,
    dwell_time: loops
  });
}

export function updateRose(deltaSeconds: number) {
  if (_mixer) _mixer.update(deltaSeconds);
}

/* ───────── helpers ───────── */

function countBones(root: THREE.Object3D) {
  let bones = 0;
  root.traverse(o => { if ((o as any).isBone) bones++; });
  return bones;
}

/** Dispose geometry/materials/textures/skeletons recursively. */
function deepDispose(node: THREE.Object3D) {
  node.traverse((o: any) => {
    if (o.isMesh) {
      // geometry
      try { o.geometry?.dispose?.(); } catch {}

      // material(s) + bound textures
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (!m) continue;
        const texKeys = [
          "map","normalMap","roughnessMap","metalnessMap",
          "aoMap","emissiveMap","displacementMap","alphaMap","bumpMap","envMap"
        ];
        for (const k of texKeys) {
          const t = (m as any)[k];
          if (t && t.isTexture) {
            try { t.dispose?.(); } catch {}
            (m as any)[k] = null;
          }
        }
        try { (m as any).dispose?.(); } catch {}
      }

      // skinning data
      if (o.skeleton) {
        try { o.skeleton.boneTexture?.dispose?.(); } catch {}
        try { o.skeleton.dispose?.(); } catch {}
      }
    }
  });
}

/** Return only top-most parents from a list, so we don’t dispose the same subtree multiple times. */
function dedupeParents(nodes: THREE.Object3D[]) {
  const set = new Set(nodes);
  for (const n of nodes) {
    let p = n.parent;
    while (p) {
      if (set.has(p)) { set.delete(n); break; }
      p = p.parent;
    }
  }
  return Array.from(set);
}

// src/game/gameplay/digger.ts
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export type Digger = {
  group: THREE.Group;
  vel: THREE.Vector3;
  height: number;
  fuel: number;
  getBounds(out?: THREE.Box3): THREE.Box3;
  consumeMineRequest: () => { key: string } | null;
  refuel: () => void;
  attachTool: (hand: "left" | "right", url: string) => void;
};

export function createDigger(
  scene: THREE.Scene,
  opts?: { model?: "superdigger_rig.glb" | "mech.glb"; scale?: number; start?: THREE.Vector3 }
): Digger {
  const modelFile = opts?.model ?? "superdigger_rig.glb";
  const DIGGER_SCALE = opts?.scale ?? 2.4;

  const group = new THREE.Group();
  const vel = new THREE.Vector3();
  let lastMine: { key: string } | null = null;

  // tool sockets
  const handL = new THREE.Object3D();
  const handR = new THREE.Object3D();
  handL.position.set(-0.8 * DIGGER_SCALE, 0.2 * DIGGER_SCALE, 0.8 * DIGGER_SCALE);
  handR.position.set(0.8 * DIGGER_SCALE, 0.2 * DIGGER_SCALE, 0.8 * DIGGER_SCALE);
  group.add(handL, handR);

  // placeholder hull
  const hull = new THREE.Mesh(
    new THREE.BoxGeometry(2.2 * DIGGER_SCALE, 1.4 * DIGGER_SCALE, 2.2 * DIGGER_SCALE),
    new THREE.MeshBasicMaterial({ color: 0x88aaff })
  );
  group.add(hull);

  const modelUrl = new URL(`../../assets/models/vehicles/${modelFile}`, import.meta.url).href;

  const loader = new GLTFLoader();
  loader.load(
    modelUrl,
    (gltf) => {
      const root = gltf.scene;
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if ((m as any).isMesh) {
          const src: any = (m as any).material;
          (m as any).material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            map: (src && src.map) || null,
          });
          (m as any).castShadow = (m as any).receiveShadow = false;
        }
      });
      group.remove(hull);
      root.scale.setScalar(DIGGER_SCALE);
      group.add(root);
    },
    undefined,
    (err) => {
      console.warn(`[Digger] Failed to load ${modelUrl}`, err);
      // keep hull so gameplay continues
    }
  );

  group.position.copy(opts?.start ?? new THREE.Vector3(0, 0, 0));
  scene.add(group);

  const getBounds = (out?: THREE.Box3) => {
    const box = out ?? new THREE.Box3();
    box.setFromCenterAndSize(
      group.position,
      new THREE.Vector3(2.0 * DIGGER_SCALE, 1.6 * DIGGER_SCALE, 2.0 * DIGGER_SCALE)
    );
    return box;
  };

  // Single-click mine request (works with __terrainPick hook)
  const domEl = (scene as any).__renderer?.domElement || window.document.body;
  domEl?.addEventListener("pointerdown", (e: PointerEvent) => {
    if (e.button !== 0) return;
    const cam = (scene as any).__camera as THREE.Camera;
    if (!cam) return;
    const mouse = new THREE.Vector2(
      (e.clientX / window.innerWidth) * 2 - 1,
      -(e.clientY / window.innerHeight) * 2 + 1
    );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(mouse, cam);
    (scene as any).__terrainPick?.(ray, (key: string) => {
      lastMine = { key };
    });
  });

  function attachTool(hand: "left" | "right", url: string) {
    const sock = hand === "left" ? handL : handR;
    while (sock.children.length) sock.remove(sock.children[0]);
    const full = new URL(url, import.meta.url).href;
    const toolLoader = new GLTFLoader();
    toolLoader.load(
      full,
      (g) => {
        const root = g.scene;
        root.traverse((o) => {
          const m = o as THREE.Mesh;
          if ((m as any).isMesh) {
            const src: any = (m as any).material;
            (m as any).material = new THREE.MeshBasicMaterial({
              color: 0xffffff,
              map: (src && src.map) || null,
            });
          }
        });
        root.scale.setScalar(2.0);
        root.rotation.y = Math.PI;
        sock.add(root);
      },
      undefined,
      (err) => console.warn("tool load fail", err)
    );
  }

  return {
    group,
    vel,
    height: 1.6 * DIGGER_SCALE,
    fuel: 100,
    getBounds,
    consumeMineRequest: () => {
      const r = lastMine;
      lastMine = null;
      return r;
    },
    refuel: () => {},
    attachTool,
  };
}

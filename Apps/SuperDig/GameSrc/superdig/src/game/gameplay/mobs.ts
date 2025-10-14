import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export type DinosController = {
  update(dt: number): void;
};

type Dino = {
  group: THREE.Group;
  dir: number;
  speed: number;
  life: number;         // time left before disappearing
  cooldown: number;     // time before reappearing
  width: number;
  aabb: THREE.Box3;
};

const DINO_FILES = ["dino1.glb", "dino2.glb", "dino3.glb"];

export function createSurfaceDinos(
  scene: THREE.Scene,
  worldWidth: number,
  groundY: number,
  count = 5
): DinosController {
  const rng = (a: number, b: number) => a + Math.random() * (b - a);
  const loader = new GLTFLoader();

  const dinos: Dino[] = [];
  const leftX = -worldWidth * 0.5 + 4;
  const rightX = worldWidth * 0.5 - 4;

  function spawn(d: Dino) {
    d.dir = Math.random() < 0.5 ? -1 : 1;
    d.speed = rng(1.2, 2.4);
    d.life = rng(6, 14);        // will wander for 6–14s then disappear
    d.cooldown = 0;             // already visible
    const x = rng(leftX, rightX);
    d.group.position.set(x, groundY + 0.12, 0);
    d.group.scale.setScalar(rng(1.1, 1.6));
    d.group.visible = true;
    d.aabb.setFromCenterAndSize(d.group.position, new THREE.Vector3(2.4, 1.8, 2.4));
    flipToDir(d);
  }

  function vanish(d: Dino) {
    d.group.visible = false;
    d.cooldown = rng(2, 6);     // reappear later, somewhere else
  }

  function flipToDir(d: Dino) {
    const s = Math.abs(d.group.scale.x);
    d.group.scale.x = d.dir < 0 ? -s : s;
  }

  function makeDino(file: string): Dino {
    const group = new THREE.Group();
    const aabb = new THREE.Box3();
    // fallback hull (visible until model loads)
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 1, 1.2),
      new THREE.MeshBasicMaterial({ color: 0x6bd19c })
    );
    group.add(hull);
    scene.add(group);

    // Vite-safe URL
    const url = new URL(`../../assets/models/actors/dinos/${file}`, import.meta.url).href;
    loader.load(
      url,
      (gltf) => {
        const root = gltf.scene;
        root.traverse((o) => {
          const m = o as THREE.Mesh;
          if ((m as any).isMesh) {
            const src: any = (m as any).material;
            (m as any).material = new THREE.MeshBasicMaterial({
              color: 0xffffff,
              map: (src && src.map) || null
            });
          }
        });
        group.clear();
        group.add(root);
      },
      undefined,
      () => {/* keep hull if load fails */}
    );

    // click to roar + speed burst
    (scene as any).__renderer?.domElement.addEventListener("pointerdown", (e: PointerEvent) => {
      if (!group.visible) return;
      const cam = (scene as any).__camera as THREE.Camera;
      const mouse = new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
      const ray = new THREE.Raycaster();
      ray.setFromCamera(mouse, cam);
      if (ray.intersectObject(group, true).length) {
        d.speed *= 1.8;
        d.life = Math.max(1.5, d.life * 0.5);
      }
    });

    const d: Dino = { group, dir: 1, speed: 1.5, life: 0, cooldown: 0, width: 1, aabb };
    spawn(d);
    return d;
  }

  for (let i = 0; i < count; i++) {
    dinos.push(makeDino(DINO_FILES[i % DINO_FILES.length]));
  }

  return {
    update(dt: number) {
      for (const d of dinos) {
        if (d.group.visible) {
          d.life -= dt;
          const nx = d.group.position.x + d.dir * d.speed * dt;
          if (nx < leftX) { d.dir = +1; flipToDir(d); }
          else if (nx > rightX) { d.dir = -1; flipToDir(d); }
          else d.group.position.x = nx;

          // little hop/bob
          d.group.position.y = groundY + 0.12 + Math.sin(performance.now() * 0.004) * 0.04;

          if (d.life <= 0) vanish(d);
          d.aabb.setFromCenterAndSize(d.group.position, new THREE.Vector3(2.4, 1.8, 2.4));
        } else {
          d.cooldown -= dt;
          if (d.cooldown <= 0) spawn(d);
        }
      }
    }
  };
}

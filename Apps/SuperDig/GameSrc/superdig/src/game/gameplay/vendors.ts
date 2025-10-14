import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export type VendorId = "mage1" | "mage2";
export type VendorInfo = {
  id: VendorId;
  name: string;
  items: { id: string; label: string; price: number; desc?: string }[];
};

export type VendorsController = {
  update(dt: number): void;
  test(bounds: THREE.Box3): VendorInfo | null;
};

const VENDORS: VendorInfo[] = [
  {
    id: "mage1",
    name: "Mage Ichor",
    items: [
      { id: "saturn_rock", label: "Saturn Moon Rock", price: 50, desc: "Sparkly. Probably cursed." },
      { id: "death_smokes", label: "Saturn Death Smokes", price: 120, desc: "Do not inhale near oxygen." },
      { id: "warp_token", label: "Warp Token", price: 250, desc: "Fast-travel once." },
    ],
  },
  {
    id: "mage2",
    name: "Mage Ember",
    items: [
      { id: "jerky", label: "Comet Jerky", price: 25, desc: "Chewy +3 stamina." },
      { id: "nano_rations", label: "Nano Rations", price: 80, desc: "Sustains for a long shift." },
      { id: "relic_map", label: "Relic Fragment Map", price: 300, desc: "Points to hidden cache." },
    ],
  },
];

type Vendor = {
  info: VendorInfo;
  group: THREE.Group;
  aabb: THREE.Box3;
  patrolCenter: number;
  patrolRange: number;
  dir: number;
  speed: number;
};

export function createVendors(
  scene: THREE.Scene,
  worldWidth: number,
  groundY: number
): VendorsController {
  const loader = new GLTFLoader();
  const vendors: Vendor[] = [];

  function makeVendor(info: VendorInfo, x: number): Vendor {
    const group = new THREE.Group();
    const aabb = new THREE.Box3();

    // comfy placeholder while GLB loads
    const cloak = new THREE.Mesh(
      new THREE.ConeGeometry(0.6, 1.4, 6),
      new THREE.MeshBasicMaterial({ color: 0xffb347 })
    );
    cloak.position.y = groundY + 0.7;
    group.add(cloak);
    scene.add(group);

    // Vite-safe URL
    const url = new URL(`../../assets/models/actors/vendors/${info.id}.glb`, import.meta.url).href;
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
        root.scale.setScalar(1.2);
        root.position.y = groundY + 0.0;
        group.add(root);
      },
      undefined,
      () => {/* keep placeholder */}
    );

    group.position.set(x, groundY + 0.0, 0);
    const v: Vendor = {
      info, group, aabb,
      patrolCenter: x,
      patrolRange: 3.0,
      dir: Math.random() < 0.5 ? -1 : 1,
      speed: 0.5 + Math.random() * 0.5
    };
    return v;
  }

  // place the mages left/right of center
  const left = -worldWidth * 0.18;
  const right = worldWidth * 0.18;
  vendors.push(makeVendor(VENDORS[0], left));
  vendors.push(makeVendor(VENDORS[1], right));

  return {
    update(dt: number) {
      for (const v of vendors) {
        // gentle patrol
        const dx = v.dir * v.speed * dt;
        const x = v.group.position.x + dx;
        if (Math.abs(x - v.patrolCenter) > v.patrolRange) {
          v.dir *= -1;
        } else {
          v.group.position.x = x;
        }
        // idle bob
        v.group.position.y = groundY + Math.sin(performance.now() * 0.003) * 0.05;
        v.group.scale.x = Math.sign(v.dir) * Math.abs(v.group.scale.x || 1);
        v.aabb.setFromCenterAndSize(v.group.position, new THREE.Vector3(1.6, 1.8, 1.6));
      }
    },
    test(bounds: THREE.Box3) {
      for (const v of vendors) {
        if (v.aabb.intersectsBox(bounds)) return v.info;
      }
      return null;
    },
  };
}

export { VENDORS }; // export the list for UI/testing if needed

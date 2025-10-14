// src/game/engine/terrain.ts
import * as THREE from "three";

export type TileKind = 0 | 1 | 2; // 0=basalt, 1=ice, 2=metal/bedrock
export type Terrain = {
  blocks: Map<string, { kind: TileKind; hp: number; inst?: { mesh: THREE.InstancedMesh; id: number } }>;
  size: { W: number; H: number; D: number; S: number };
  raycast(ray: THREE.Raycaster): { key: string; p: THREE.Vector3 } | null;
  mine(key: string): number;
  isSolidAt(x: number, y: number, z: number): boolean;
};

const TEX = {
  0: "/src/assets/textures/tiles/basalt.png",
  1: "/src/assets/textures/tiles/ice.png",
  2: "/src/assets/textures/tiles/metal.png",
} as const;

function makeInstanced(geo: THREE.BufferGeometry, mapPath: string, count: number) {
  const map = new THREE.TextureLoader().load(mapPath);
  map.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = true;
  return mesh;
}

// Helper to encode keys
const keyOf = (x: number, y: number, z: number) => `${x},${y},${z}`;

export function createTerrain(scene: THREE.Scene): Terrain {
  // ---- New scale: ~1 block == ~1 player (miner ~3.8–4 units tall) ----
  const S = 4;            // block size (world units)
  // Trim overall count but keep chunky Z depth for the “cabinet wall” feel
  const W = 60;           // width (across)
  const H = 80;           // depth downward (was 160)
  const D = 16;           // front-to-back thickness (a bit thicker than before)

  const geo = new THREE.BoxGeometry(S, S, S);

  // Pre-count by kind to size InstancedMeshes
  const countByKind = { 0: 0, 1: 0, 2: 0 } as Record<TileKind, number>;
  const grid: { key: string; x: number; y: number; z: number; kind: TileKind; hp: number }[] = [];

  // Layers (y is in block units):
  // y: 1..3     -> basalt (surface cap)
  // y: 4..56    -> ice    (crust)
  // y: 57..H-1  -> metal  (deep)
  for (let x = 0; x < W; x++) for (let y = 1; y < H; y++) for (let z = 0; z < D; z++) {
    let kind: TileKind = y < 4 ? 0 : (y < 57 ? 1 : 2);

    // Bedrock walls (sides & front/back) to frame the playfield
    if (x === 0 || x === W - 1 || z === 0 || z === D - 1) kind = 2;

    const hp = kind === 0 ? 2 : (kind === 1 ? 3 : 6);
    const key = keyOf(x, y, z);
    grid.push({ key, x, y, z, kind, hp });
    countByKind[kind] += 1;
  }

  const inst = {
    0: makeInstanced(geo, TEX[0], countByKind[0]),
    1: makeInstanced(geo, TEX[1], countByKind[1]),
    2: makeInstanced(geo, TEX[2], countByKind[2]),
  } as const;

  Object.values(inst).forEach(m => scene.add(m));

  const blocks = new Map<string, { kind: TileKind; hp: number; inst?: { mesh: THREE.InstancedMesh; id: number } }>();
  const cursor = { 0: 0, 1: 0, 2: 0 } as Record<TileKind, number>;

  for (const b of grid) {
    const mesh = inst[b.kind];
    const id = cursor[b.kind]++;
    const m = new THREE.Matrix4().setPosition(
      (b.x - W / 2) * S,
      -b.y * S,
      (b.z - D / 2) * S
    );
    mesh.setMatrixAt(id, m);
    blocks.set(b.key, { kind: b.kind, hp: b.hp, inst: { mesh, id } });
  }
  Object.values(inst).forEach(m => (m.instanceMatrix.needsUpdate = true));

  const raycast = (ray: THREE.Raycaster) => {
    const hits = ray.intersectObjects([inst[0], inst[1], inst[2]], false);
    if (!hits.length) return null;
    const h = hits[0];
    const id = (h as any).instanceId as number;
    const mesh = h.object as THREE.InstancedMesh;
    for (const [k, v] of blocks) {
      if (v.inst && v.inst.mesh === mesh && v.inst.id === id) return { key: k, p: h.point.clone() };
    }
    return null;
  };

  const mine = (key: string) => {
    const b = blocks.get(key);
    if (!b || !b.inst) return 0;
    b.hp -= 1;
    if (b.hp > 0) return 0;
    // hide instance (reveals backdrop)
    const m = new THREE.Matrix4().makeTranslation(99999, -99999, 0);
    b.inst.mesh.setMatrixAt(b.inst.id, m);
    b.inst.mesh.instanceMatrix.needsUpdate = true;
    blocks.delete(key);
    return 10 + b.kind * 10;
  };

  const isSolidAt = (x: number, y: number, z: number) => {
    const gx = Math.round(x / S + W / 2);
    const gy = Math.round(-y / S);
    const gz = Math.round(z / S + D / 2);
    if (gx < 0 || gx >= W || gy < 0 || gy >= H || gz < 0 || gz >= D) return false;
    return blocks.has(keyOf(gx, Math.max(gy, 0), gz));
  };

  return { blocks, size: { W, H, D, S }, raycast, mine, isSolidAt };
}

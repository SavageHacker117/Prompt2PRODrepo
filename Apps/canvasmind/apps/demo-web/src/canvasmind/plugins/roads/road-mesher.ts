import * as THREE from "three";
import type { SplinePath } from "./spline";
import { defaultRoadParams, RoadParams, frameWithBank } from "./road-profile";

// Adjust these if your textures live elsewhere:
const TEX_ALBEDO = "/assets/textures/road_albedo.jpg";
const TEX_NORMAL = "/assets/textures/road_normal.jpg";

async function loadTexture(urls: string[]): Promise<THREE.Texture | null> {
  const loader = new THREE.TextureLoader();
  for (const u of urls) {
    try {
      const tex = await new Promise<THREE.Texture>((res, rej) => {
        loader.load(u, (t) => res(t), undefined, () => rej(u));
      });
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      return tex;
    } catch {}
  }
  return null;
}

export async function buildRoadMesh(
  path: SplinePath,
  params: RoadParams = {}
): Promise<THREE.Mesh> {
  const p = { ...defaultRoadParams(), ...params };
  const steps = 400;

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  let totalLen = 0;
  let prev = path.getPoint(0);

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const pos = path.getPoint(t);
    totalLen += pos.distanceTo(prev);
    prev = pos;

    const tan = path.getTangent(t).normalize();
    const { right, up } = frameWithBank(pos, tan, p.bankAngleDeg);

    const half = p.width * 0.5;
    const L = pos.clone().add(right.clone().multiplyScalar(-half));
    const R = pos.clone().add(right.clone().multiplyScalar(+half));

    positions.push(L.x, L.y, L.z, R.x, R.y, R.z);

    // up normal (banked)
    for (let k = 0; k < 2; k++) {
      normals.push(up.x, up.y, up.z);
      uvs.push(k, totalLen * p.uvTiling);
    }

    if (i > 0) {
      const a = i * 2, b = a + 1, c = a - 2, d = a - 1;
      indices.push(c, d, b, c, b, a);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeBoundingSphere();

  // material
  const [albedo, normal] = await Promise.all([
    loadTexture([TEX_ALBEDO, "/road_albedo.jpg", "road_albedo.jpg"]),
    loadTexture([TEX_NORMAL, "/road_normal.jpg", "road_normal.jpg"]),
  ]);

  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: albedo || undefined,
    normalMap: normal || undefined,
    metalness: 0.0,
    roughness: 0.8,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  return mesh;
}

import * as THREE from "three";
import { poissonDisk } from "./poisson-disk";
import type { SplinePath } from "../roads/spline";

export type ScatterOpts = {
  areaSize?: number;      // square meters around origin
  density?: number;       // points per 100m^2 approx
  roadMargin?: number;    // keep this far from road center
  heightAt: (x: number, z: number) => number;
  path: SplinePath;
};

export function buildTrees(opts: ScatterOpts) {
  const o = { areaSize: 150, density: 0.8, roadMargin: 6, ...opts };
  const count = Math.floor((o.areaSize * o.areaSize) * 0.0001 * o.density * 120);
  const rad = Math.max(2.5, 0.5 * Math.sqrt((o.areaSize * o.areaSize) / (count + 1e-5)));

  const pts = poissonDisk(o.areaSize, o.areaSize, rad);
  const geo = new THREE.ConeGeometry(0.6, 4, 6);
  geo.translate(0, 2, 0);
  const mat = new THREE.MeshStandardMaterial({ color: 0x2c3e1b, roughness: 1 });

  const inst = new THREE.InstancedMesh(geo, mat, pts.length);
  inst.castShadow = true;
  inst.receiveShadow = true;

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);

  for (let i = 0; i < pts.length; i++) {
    const x = pts[i].x - o.areaSize * 0.5;
    const z = pts[i].y - o.areaSize * 0.5;
    // skip near road
    const d = o.path.distanceToPoint(x, z);
    if (Math.abs(d.distance) < o.roadMargin) continue;

    const y = o.heightAt(x, z);
    q.setFromUnitVectors(up, up);
    m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1 + Math.random() * 0.5, 1));
    inst.setMatrixAt(i, m);
  }
  inst.instanceMatrix.needsUpdate = true;

  const group = new THREE.Group();
  group.add(inst);
  return group;
}

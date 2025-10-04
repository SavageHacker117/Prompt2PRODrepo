// apps/demo-web/src/three/splats.ts
import * as THREE from "three";

/** Very small point-based "splat" scaffold.
 * Replace with a proper 3DGS renderer later (e.g., gsplat/webgpu) */
export class SplatCloud extends THREE.Points {
  private _geom: THREE.BufferGeometry;
  private _mat: THREE.PointsMaterial;

  constructor(points: Float32Array, size = 0.02) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(points, 3));
    const m = new THREE.PointsMaterial({ size, sizeAttenuation: true, transparent: true, depthWrite: false });
    super(g, m);
    this._geom = g; this._mat = m;
  }

  setColor(c: THREE.ColorRepresentation) { (this._mat as THREE.PointsMaterial).color = new THREE.Color(c); }
  disposeAll() { this._geom.dispose(); this._mat.dispose(); }
}

/** quick helper to create a disc of splats */
export function makeDiscSplat(count = 10_000, radius = 2): SplatCloud {
  const pts = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = Math.sqrt(Math.random()) * radius;
    const t = Math.random() * Math.PI * 2;
    pts[i * 3 + 0] = Math.cos(t) * r;
    pts[i * 3 + 1] = 0.01 * (Math.random() - 0.5);
    pts[i * 3 + 2] = Math.sin(t) * r;
  }
  const cloud = new SplatCloud(pts, 0.015);
  cloud.setColor(0x6eb6ff);
  cloud.frustumCulled = true;
  return cloud;
}

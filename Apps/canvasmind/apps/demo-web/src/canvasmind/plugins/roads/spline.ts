import * as THREE from "three";

export type SplineOpts = {
  tension?: number;    // for CatmullRom
  closed?: boolean;
};

export class SplinePath {
  private curve: THREE.CatmullRomCurve3;
  private _length: number;

  constructor(points: THREE.Vector3[], opts: SplineOpts = {}) {
    this.curve = new THREE.CatmullRomCurve3(points, !!opts.closed, "catmullrom", opts.tension ?? 0.5);
    this._length = this.curve.getLength();
  }

  get length() { return this._length; }

  getPoint(t01: number) { return this.curve.getPoint(THREE.MathUtils.clamp(t01, 0, 1)); }
  getTangent(t01: number) { return this.curve.getTangent(THREE.MathUtils.clamp(t01, 0, 1)); }

  /** Approximate closest distance to a 2D point (x,z) on XZ plane. */
  distanceToPoint(x: number, z: number) {
    const samples = 256; // ok for prototype
    let bestT = 0, bestD2 = Infinity, best = new THREE.Vector3();
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const p = this.curve.getPoint(t);
      const dx = p.x - x, dz = p.z - z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestD2) { bestD2 = d2; bestT = t; best = p; }
    }
    // signed side using cross of tangent with vector to point
    const tan = this.curve.getTangent(bestT);
    const toP = new THREE.Vector3(x - best.x, 0, z - best.z);
    const crossY = tan.clone().cross(toP).y;
    const signed = Math.sign(crossY) * Math.sqrt(bestD2);
    return { distance: signed, t: bestT, closest: best };
  }

  static generate(
    seed = 7,
    segmentCount = 12,
    segmentLen = 60,
    curvature = 0.7
  ) {
    // random "infinite" feeling snake
    const rnd = (() => {
      let s = seed;
      return () => { s ^= s << 13; s ^= s >> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
    })();
    const pts: THREE.Vector3[] = [];
    let x = 0, z = 0, a = 0;
    pts.push(new THREE.Vector3(x, 0, z));
    for (let i = 0; i < segmentCount; i++) {
      a += (rnd() - 0.5) * curvature;
      x += Math.cos(a) * segmentLen;
      z += Math.sin(a) * segmentLen;
      pts.push(new THREE.Vector3(x, 0, z));
    }
    return new SplinePath(pts, { tension: 0.5 });
  }
}

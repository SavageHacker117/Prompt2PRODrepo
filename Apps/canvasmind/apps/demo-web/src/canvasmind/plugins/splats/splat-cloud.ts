import * as THREE from "three";

export class SplatCloud extends THREE.Points {
  declare geometry: THREE.BufferGeometry;
  declare material: THREE.PointsMaterial;

  constructor(
    points: Float32Array,
    opts: { size?: number; colors?: Uint8Array | Float32Array } = {}
  ) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));

    if (opts.colors) {
      // Support either Float32 RGB[A] or Uint8 RGB[A] (normalized).
      // three.js PointsMaterial only consumes 'color' (RGB). We also
      // keep alpha in a side attribute 'aAlpha' so no data is lost.
      let hasAlpha = false;

      if (opts.colors instanceof Float32Array) {
        const stride = (opts.colors.length % 4 === 0) ? 4 : 3;
        const rgb = new Float32Array((opts.colors.length / stride) * 3);
        let aAttr: Float32Array | null = null;

        if (stride === 4) { hasAlpha = true; aAttr = new Float32Array(rgb.length / 3); }

        for (let i = 0, j = 0, k = 0; i < opts.colors.length; i += stride, j += 3) {
          rgb[j + 0] = opts.colors[i + 0];
          rgb[j + 1] = opts.colors[i + 1];
          rgb[j + 2] = opts.colors[i + 2];
          if (stride === 4 && aAttr) aAttr[k++] = opts.colors[i + 3];
        }
        g.setAttribute("color", new THREE.Float32BufferAttribute(rgb, 3));
        if (hasAlpha && aAttr) g.setAttribute("aAlpha", new THREE.Float32BufferAttribute(aAttr, 1));
      } else {
        // Uint8 RGB[A] → normalized attributes
        const stride = (opts.colors.length % 4 === 0) ? 4 : 3;
        const rgb = new Uint8Array((opts.colors.length / stride) * 3);
        let aAttr: Uint8Array | null = null;

        if (stride === 4) { hasAlpha = true; aAttr = new Uint8Array(rgb.length / 3); }

        for (let i = 0, j = 0, k = 0; i < opts.colors.length; i += stride, j += 3) {
          rgb[j + 0] = opts.colors[i + 0];
          rgb[j + 1] = opts.colors[i + 1];
          rgb[j + 2] = opts.colors[i + 2];
          if (stride === 4 && aAttr) aAttr[k++] = opts.colors[i + 3];
        }
        g.setAttribute("color", new THREE.Uint8BufferAttribute(rgb, 3, true));
        if (hasAlpha && aAttr) g.setAttribute("aAlpha", new THREE.Uint8BufferAttribute(aAttr, 1, true));
      }
    }

    const m = new THREE.PointsMaterial({
      size: opts.size ?? 0.02,
      sizeAttenuation: true,
      transparent: true,
      depthWrite: false,
      vertexColors: !!opts.colors
    });

    super(g, m);
    this.frustumCulled = true;
    g.computeBoundingSphere();
  }

  setColor(c: THREE.ColorRepresentation) {
    if (!this.material.vertexColors) this.material.color.set(c);
  }
  setSize(s: number) { this.material.size = s; }
  setOpacity(a: number) {
    this.material.opacity = Math.max(0, Math.min(1, a));
    this.material.needsUpdate = true;
  }
  disposeAll() {
    this.parent?.remove(this);
    this.geometry.dispose();
    (this.material as any)?.dispose?.();
  }
}

/** quick helper to create a disc of splats */
export function makeDiscSplat(
  count = 10_000,
  radius = 2,
  size = 0.015,
  yJitter = 0.01
): SplatCloud {
  const pts = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = Math.sqrt(Math.random()) * radius;
    const t = Math.random() * Math.PI * 2;
    pts[i * 3 + 0] = Math.cos(t) * r;
    pts[i * 3 + 1] = (Math.random() - 0.5) * yJitter;
    pts[i * 3 + 2] = Math.sin(t) * r;
  }
  const cloud = new SplatCloud(pts, { size });
  (cloud.material as THREE.PointsMaterial).color.set(0x6eb6ff);
  return cloud;
}

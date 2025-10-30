// effects/LiquidParticles.js
import * as THREE from 'three';

export class LiquidParticles {
  /**
   * @param {THREE.Scene} scene
   * @param {Object} opts
   *  - origin: THREE.Vector3 center of the wall plane
   *  - normal: THREE.Vector3 wall normal (normalized)
   *  - size:   THREE.Vector2 width (x) & height (y) of the plane area
   *  - cols, rows: grid resolution
   *  - pointSize: size in world units
   *  - amp: displacement amplitude along normal
   *  - speed: animation speed
   *  - spriteUrl: texture with soft dot(s)
   *  - colorA, colorB: THREE.Color gradient
   */
  constructor(scene, {
    origin = new THREE.Vector3(),
    normal = new THREE.Vector3(0, 0, 1),
    size = new THREE.Vector2(100, 10),
    cols = 160,
    rows = 60,
    pointSize = 1.6,
    amp = 0.3,
    speed = 1.0,
    spriteUrl = './assets/textures/tpk1/sprites/glow_orbs_4x4_512.png',
    colorA = new THREE.Color('#ffffff'),
    colorB = new THREE.Color('#8ab6ff'),
  } = {}) {
    this.origin = origin.clone();
    this.normal = normal.clone().normalize();
    this.cols = cols;
    this.rows = rows;
    this.amp = amp;
    this.speed = speed;
    this.t = 0;

    const total = cols * rows;
    const positions = new Float32Array(total * 3);
    const base = new Float32Array(total * 3);
    const colors = new Float32Array(total * 3);
    const seeds = new Float32Array(total);

    // two tangent axes to the wall normal
    const up = new THREE.Vector3(0, 1, 0);
    const tangent = new THREE.Vector3().crossVectors(up, this.normal).normalize();
    const bitangent = new THREE.Vector3().crossVectors(this.normal, tangent).normalize();

    // grid fill
    let i = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++, i++) {
        const u = (c / (cols - 1) - 0.5) * size.x;
        const v = (r / (rows - 1) - 0.5) * size.y;

        const p = new THREE.Vector3()
          .copy(this.origin)
          .addScaledVector(tangent, u)
          .addScaledVector(bitangent, v);

        base[i * 3 + 0] = p.x;
        base[i * 3 + 1] = p.y;
        base[i * 3 + 2] = p.z;

        positions[i * 3 + 0] = p.x;
        positions[i * 3 + 1] = p.y;
        positions[i * 3 + 2] = p.z;

        const tcol = colorA.clone().lerp(colorB, Math.random());
        colors[i * 3 + 0] = tcol.r;
        colors[i * 3 + 1] = tcol.g;
        colors[i * 3 + 2] = tcol.b;

        seeds[i] = Math.random() * 10.0;
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('base', new THREE.BufferAttribute(base, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geom.setAttribute('seed', new THREE.BufferAttribute(seeds, 1));

    const tex = new THREE.TextureLoader().load(spriteUrl);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;

    const mat = new THREE.PointsMaterial({
      map: tex,
      size: pointSize,
      sizeAttenuation: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
    });

    this.points = new THREE.Points(geom, mat);
    scene.add(this.points);
  }

  update(dt) {
    this.t += dt * this.speed;

    const pos = this.points.geometry.getAttribute('position');
    const base = this.points.geometry.getAttribute('base');
    const seed = this.points.geometry.getAttribute('seed');

    const nx = this.normal.x, ny = this.normal.y, nz = this.normal.z;

    for (let i = 0; i < pos.count; i++) {
      const wobble =
        Math.sin(this.t * 2.1 + seed.array[i]) * 0.6 +
        Math.cos(this.t * 1.3 + seed.array[i] * 1.7) * 0.4;

      const d = wobble * this.amp;

      pos.array[i * 3 + 0] = base.array[i * 3 + 0] + nx * d;
      pos.array[i * 3 + 1] = base.array[i * 3 + 1] + ny * d;
      pos.array[i * 3 + 2] = base.array[i * 3 + 2] + nz * d;
    }
    pos.needsUpdate = true;
  }

  dispose() {
    this.points.geometry.dispose();
    this.points.material.dispose();
    this.points.removeFromParent();
  }
}

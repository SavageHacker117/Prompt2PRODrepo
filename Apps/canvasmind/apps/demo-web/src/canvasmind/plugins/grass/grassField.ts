import * as THREE from "three";

export type GrassOpts = {
  size?: number;
  density?: number;
  bladeHeight?: number;
  windStrength?: number;
  windSpeed?: number;
  seed?: number;
  metalness?: number;
  roughness?: number;
  quality?: "low" | "med" | "high";
};

export class GrassField {
  public group = new THREE.Group();
  private instanced: THREE.InstancedMesh | null = null;
  private uniforms!: {
    uTime: { value: number };
    uWindDir: { value: THREE.Vector2 };
    uWindStrength: { value: number };
    uWindSpeed: { value: number };
    uBladeHeight: { value: number };
    uBaseColor: { value: THREE.Color };
    uTipColor: { value: THREE.Color };
    uMetalness: { value: number };
    uRoughness: { value: number };
  };

  private _time = 0;
  private _count = 0;
  private _opts!: Required<GrassOpts>;
  private _geo!: THREE.InstancedBufferGeometry;
  private _mat!: THREE.ShaderMaterial;

  // cache to know when to rebuild vs live-update
  private _buildSignature = "";

  constructor(opts: GrassOpts = {}) {
    this._opts = {
      size: opts.size ?? 12,
      density: opts.density ?? 700,
      bladeHeight: opts.bladeHeight ?? 0.35,
      windStrength: Math.max(0, opts.windStrength ?? 0.6),
      windSpeed: Math.max(0, opts.windSpeed ?? 1.1),
      seed: opts.seed ?? 1337,
      metalness: opts.metalness ?? 0.04,
      roughness: opts.roughness ?? 0.75,
      quality: opts.quality ?? "med",
    };
  }

  addTo(scene: THREE.Scene) {
    if (this.instanced) return;
    const built = this._build(this._opts);
    this._applyBuild(built);
    this.group.add(this.instanced!);
    scene.add(this.group);
  }

  removeFrom(scene: THREE.Scene) {
    if (!this.instanced) return;
    scene.remove(this.group);
    this.group.remove(this.instanced);
    this.instanced.geometry.dispose();
    (this.instanced.material as THREE.Material).dispose();
    this.instanced = null!;
  }

  update(dt: number) {
    if (!this.instanced) return;
    this._time += dt;
    this.uniforms.uTime.value = this._time;
  }

  stats() { return { blades: this._count, size: this._opts.size }; }

  setWind(strength: number, speed?: number, dir?: THREE.Vector2) {
    this.uniforms.uWindStrength.value = Math.max(0, strength);
    if (typeof speed === "number") this.uniforms.uWindSpeed.value = Math.max(0, speed);
    if (dir) this.uniforms.uWindDir.value.copy(dir).normalize();
  }
  setHeight(h: number) { this.uniforms.uBladeHeight.value = Math.max(0.02, h); }

  /** Live update or rebuild depending on what changed */
  updateOptions(next: Partial<GrassOpts>) {
    const merged = { ...this._opts, ...next };
    const sig = this._sig(merged);
    const needsRebuild = sig !== this._buildSignature;

    if (!this.instanced || needsRebuild) {
      // keep scene placement stable
      const parent = this.group.parent as THREE.Scene | undefined;
      if (this.instanced) this.removeFrom(parent!);
      const built = this._build(merged);
      this._applyBuild(built);
      if (parent) { this.group.add(this.instanced!); parent.add(this.group); }
    } else {
      // cheap live updates
      if (typeof next.bladeHeight === "number") this.setHeight(next.bladeHeight);
      if (typeof next.windStrength === "number" || typeof next.windSpeed === "number") {
        this.setWind(
          next.windStrength ?? this._opts.windStrength,
          next.windSpeed ?? this._opts.windSpeed
        );
      }
    }
    this._opts = merged as Required<GrassOpts>;
  }

  // ──────────────────────────────────────────────────────────────

  private _sig(o: Required<GrassOpts>) {
    // only the costly things trigger rebuild
    return `${o.size}|${o.density}|${o.quality}`;
  }

  private _applyBuild(built: ReturnType<GrassField["_build"]>) {
    this._geo = built.geometry;
    this._mat = built.material;
    this._count = built.count;
    this._buildSignature = this._sig(built.opts);

    this.instanced = new THREE.InstancedMesh(this._geo, this._mat, this._count);
    this.instanced.name = "CM_GrassField";
    this.instanced.frustumCulled = true; // allow view frustum cull for the patch
    // (Per-instance cull would require tiling; this still helps when patch is off-screen)
  }

  private _build(opts: Required<GrassOpts>) {
    const {
      size, density, bladeHeight, windStrength, windSpeed, metalness, roughness, seed, quality
    } = opts;

    // quality presets
    const qSeg = quality === "high" ? 6 : quality === "med" ? 5 : 4;
    const qDensityMul = quality === "high" ? 1.0 : quality === "med" ? 0.8 : 0.55;

    // Base blade geometry (vertical ribbon), 1m tall
    const width = 0.014;
    const baseGeo = new THREE.PlaneGeometry(width, 1, 1, qSeg);
    baseGeo.rotateY(Math.PI / 2);
    baseGeo.translate(0, 0.5, 0);

    const geo = new THREE.InstancedBufferGeometry();
    geo.index = baseGeo.index;
    for (const k in baseGeo.attributes) geo.setAttribute(k, (baseGeo.attributes as any)[k]);

    // Count (density is blades/m^2)
    const totalArea = size * size;
    const count = Math.max(1, Math.floor(density * totalArea * qDensityMul));

    // Per-instance attributes
    const offsets = new Float32Array(count * 2);
    const yaw = new Float32Array(count);
    const rand = new Float32Array(count);

    // Seeded RNG
    let s = seed >>> 0;
    const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0, (s & 0xffff) / 0xffff);

    for (let i = 0; i < count; i++) {
      const x = (rnd() * 2 - 1) * size * 0.5;
      const z = (rnd() * 2 - 1) * size * 0.5;
      offsets[i * 2 + 0] = x;
      offsets[i * 2 + 1] = z;
      yaw[i] = (rnd() * 2 - 1) * Math.PI;
      rand[i] = rnd();
    }

    const iOffset = new THREE.InstancedBufferAttribute(offsets, 2);
    const iYaw    = new THREE.InstancedBufferAttribute(yaw, 1);
    const iRand   = new THREE.InstancedBufferAttribute(rand, 1);
    iOffset.setUsage(THREE.StaticDrawUsage);
    iYaw.setUsage(THREE.StaticDrawUsage);
    iRand.setUsage(THREE.StaticDrawUsage);

    geo.setAttribute("iOffset", iOffset);
    geo.setAttribute("iYaw", iYaw);
    geo.setAttribute("iRand", iRand);

    // Shader + uniforms (lighter noise, fewer ops in vert)
    const uniforms = {
      uTime: { value: 0 },
      uWindDir: { value: new THREE.Vector2(1, 0) },
      uWindStrength: { value: Math.max(0, windStrength) },
      uWindSpeed: { value: Math.max(0, windSpeed) },
      uBladeHeight: { value: Math.max(0.02, bladeHeight) },
      uBaseColor: { value: new THREE.Color(0x284a2b) },
      uTipColor:  { value: new THREE.Color(0x78a85f) },
      uMetalness: { value: metalness },
      uRoughness: { value: roughness },
    };
    this.uniforms = uniforms as any;

    const vert = /* glsl */`
      attribute vec2 iOffset;
      attribute float iYaw;
      attribute float iRand;
      uniform float uTime;
      uniform vec2  uWindDir;
      uniform float uWindStrength;
      uniform float uWindSpeed;
      uniform float uBladeHeight;

      // cheaper value noise
      float n2(vec2 p){
        vec2 i = floor(p), f = fract(p);
        vec2 u = f*f*(3.0-2.0*f);
        float a = fract(sin(dot(i, vec2(127.1,311.7))) * 43758.5453);
        float b = fract(sin(dot(i+vec2(1.0,0.0), vec2(127.1,311.7))) * 43758.5453);
        float c = fract(sin(dot(i+vec2(0.0,1.0), vec2(127.1,311.7))) * 43758.5453);
        float d = fract(sin(dot(i+vec2(1.0,1.0), vec2(127.1,311.7))) * 43758.5453);
        return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
      }

      varying float vY;
      varying float vRand;
      varying vec3  vNormal;

      void main() {
        vec3 pos = position;
        float y = pos.y;
        vY = y;
        vRand = iRand;

        float cy = cos(iYaw), sy = sin(iYaw);
        mat3 yawRot = mat3(
          cy, 0.0, -sy,
          0.0, 1.0, 0.0,
          sy, 0.0,  cy
        );
        pos = yawRot * pos;

        float t = uTime * uWindSpeed;
        vec2 sp = iOffset + uWindDir * (t * 0.25 + iRand * 1.7);
        float gust = n2(sp * 0.9);
        float bend = (y*y) * uWindStrength * (gust * 2.0 - 1.0);
        pos.x += bend * (0.075 + 0.02 * iRand);

        pos.y *= uBladeHeight * (0.8 + 0.4 * iRand);
        pos.xz += iOffset;

        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mv;

        vNormal = normalize((modelViewMatrix * vec4(0.0, 1.0, 0.1, 0.0)).xyz);
      }
    `;

    const frag = /* glsl */`
      precision highp float;
      varying float vY;
      varying float vRand;
      varying vec3  vNormal;
      uniform vec3 uBaseColor;
      uniform vec3 uTipColor;
      uniform float uMetalness;
      uniform float uRoughness;

      void main(){
        vec3 col = mix(uBaseColor, uTipColor, smoothstep(0.0,1.0,vY) * (0.85 + 0.15*vRand));
        vec3 N = normalize(vNormal);
        vec3 L = normalize(vec3(0.4, 0.9, 0.2));
        float ndl = max(dot(N,L), 0.0);
        float fres = pow(1.0 - max(dot(N, vec3(0.0,0.0,1.0)), 0.0), 3.0);
        vec3 color = col * (0.25 + 0.75*ndl) + fres * 0.18;
        color = mix(color, vec3(dot(color, vec3(0.2126,0.7152,0.0722))), uMetalness*0.5);
        color *= (1.0 - 0.15 * uRoughness);
        gl_FragColor = vec4(color, 1.0);
      }
    `;

    const mat = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms,
      side: THREE.DoubleSide,
    });

    return { geometry: geo, material: mat, count, opts };
  }
}


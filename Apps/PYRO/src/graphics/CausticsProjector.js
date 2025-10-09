import * as THREE from "three";

// Lightweight caustic projector for Three.js
export class CausticsProjector {
  constructor({
    scene,
    getSourceMatrixWorld, // () => Matrix4 of the emitter (ball/torch)
    size = 8,             // projection square size (world units)
    intensity = 0.55,
    speed = 0.4,          // uv scroll speed
    textures = [],        // array of THREE.Texture
  }){
    this.scene = scene;
    this.getSourceMatrixWorld = getSourceMatrixWorld;
    this.size = size;
    this.intensity = intensity;
    this.speed = speed;
    this.textures = textures;
    this.t = 0;

    const geo = new THREE.PlaneGeometry(size, size, 1, 1);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        map1: { value: textures[0] || null },
        map2: { value: textures[1] || null },
        blend: { value: 0 },
        intensity: { value: intensity },
        time: { value: 0 },
        fadeNear: { value: 0.0 },
        fadeFar: { value: 2.0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main(){
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D map1, map2;
        uniform float blend, intensity, time;
        uniform float fadeNear, fadeFar;
        void main(){
          vec2 uv = vUv + vec2(time, -time) * 0.05;
          vec3 c1 = texture2D(map1, uv).rgb;
          vec3 c2 = texture2D(map2, uv * 1.07 + vec2(-time*0.06, time*0.04)).rgb;
          vec3 ca = mix(c1, c2, blend);
          float r = length(vUv - 0.5) * 2.0;
          float edge = smoothstep(1.0, 0.6, r);
          float fadeZ = smoothstep(fadeFar, fadeNear, gl_FragCoord.z / gl_FragCoord.w);
          gl_FragColor = vec4(ca * intensity * edge * fadeZ, edge * 0.9 * fadeZ);
        }
      `
    });

    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.rotation.x = -Math.PI/2;
    this.mesh.renderOrder = 2;
    this.scene.add(this.mesh);
  }

  update(dt){
    if (!this.mesh) return;
    this.t += dt * this.speed;
    if (this.textures.length >= 2) {
      const i1 = Math.floor(this.t) % this.textures.length;
      const i2 = (i1 + 1) % this.textures.length;
      const f = this.t - Math.floor(this.t);
      this.mesh.material.uniforms.map1.value = this.textures[i1];
      this.mesh.material.uniforms.map2.value = this.textures[i2];
      this.mesh.material.uniforms.blend.value = f;
    }
    this.mesh.material.uniforms.time.value = this.t;

    const m = this.getSourceMatrixWorld?.();
    if (m) {
      const pos = new THREE.Vector3().setFromMatrixPosition(m);
      this.mesh.position.set(pos.x, 0.02, pos.z);
      const h = Math.max(0.5, pos.y);
      this.mesh.material.uniforms.fadeNear.value = h * 0.2;
      this.mesh.material.uniforms.fadeFar.value  = h * 1.1;
      this.mesh.material.uniforms.intensity.value = this.intensity;
    }
  }

  dispose(){
    if (!this.mesh) return;
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.mesh = null;
  }
}

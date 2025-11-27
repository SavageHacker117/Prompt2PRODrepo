import * as THREE from 'three';

// GLSL imports
// @ts-ignore
import causticsVert from '../shaders/caustics.vert.glsl?raw';
// @ts-ignore
import causticsFrag from '../shaders/caustics.frag.glsl?raw';

export interface CausticsPassOptions {
  renderer: THREE.WebGLRenderer;
  size?: number;           // 256..1024
  worldSizeMeters?: number;
}

export interface CausticsUpdateParams {
  time: number;
  centerXZ: THREE.Vector2;
  sunDir: THREE.Vector3;
  uniformsFromOcean: {
    uWaveCount: number;
    uWaveDirs: Float32Array;
    uWaveAmplitudes: Float32Array;
    uWaveWavelengths: Float32Array;
  };
}

export class CausticsPass {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private quad: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  public readonly target: THREE.WebGLRenderTarget;
  public readonly worldSizeMeters: number;

  constructor(opts: CausticsPassOptions) {
    this.renderer = opts.renderer;
    const size = opts.size ?? 512;
    this.worldSizeMeters = opts.worldSizeMeters ?? 200;

    this.target = new THREE.WebGLRenderTarget(size, size, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      depthBuffer: false,
      stencilBuffer: false
    });

    this.quad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        vertexShader: causticsVert || '',
        fragmentShader: causticsFrag || '',
        depthTest: false,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uCenterXZ: { value: new THREE.Vector2() },
          uWorldSize: { value: this.worldSizeMeters },

          uSunDir: { value: new THREE.Vector3(0.0, 1.0, 0.0) },
          uDepthAtten: { value: 0.08 }, // attenuation factor with depth
          uSunSharpness: { value: 8.0 }, // higher -> sharper streaks

          // waves (copied from ocean material each frame)
          uWaveCount: { value: 0 },
          uWaveDirs: { value: new Float32Array(16 * 2) },
          uWaveAmplitudes: { value: new Float32Array(16) },
          uWaveWavelengths: { value: new Float32Array(16) }
        }
      })
    );
    this.scene.add(this.quad);
  }

  update(p: CausticsUpdateParams): void {
    const u: any = this.quad.material.uniforms;
    u.uTime.value = p.time;
    u.uCenterXZ.value.copy(p.centerXZ);
    u.uSunDir.value.copy(p.sunDir);

    u.uWaveCount.value = p.uniformsFromOcean.uWaveCount;

    // Copy uniform arrays (lengths already 16 in both)
    (u.uWaveDirs.value as Float32Array).set(p.uniformsFromOcean.uWaveDirs);
    (u.uWaveAmplitudes.value as Float32Array).set(p.uniformsFromOcean.uWaveAmplitudes);
    (u.uWaveWavelengths.value as Float32Array).set(p.uniformsFromOcean.uWaveWavelengths);

    this.renderer.setRenderTarget(this.target);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
  }

  get texture(): THREE.Texture {
    return this.target.texture;
  }
}

import * as THREE from 'three';
import type { IWaveLayer, WaveSample } from '../WaveSystem';

export interface SpectrumParams {
  size: number;
  windSpeed: number;
  windDirectionDeg: number;
  time: number;
}

export class SpectralWaveField implements IWaveLayer {
  readonly id = 'spectral';

  private params: SpectrumParams;

  constructor(params: SpectrumParams) {
    this.params = { ...params };
  }

  update(dt: number): void {
    this.params.time += dt;
  }

  bindMaterial(material: THREE.ShaderMaterial): void {
    if (!material.uniforms) {
      (material as any).uniforms = {};
    }
    const uniforms: any = material.uniforms;
    uniforms.uUseSpectral ??= { value: 0 }; // off until we wire textures
  }

  sampleCPU(
    posXZ: THREE.Vector2,
    time: number,
    out: WaveSample = { height: 0, normal: new THREE.Vector3(0, 1, 0) }
  ): WaveSample {
    void posXZ;
    void time;
    out.height = 0;
    out.normal.set(0, 1, 0);
    return out;
  }
}

import * as THREE from 'three';
import type { IWaveLayer, WaveSample } from '../WaveSystem';

export interface GerstnerWave {
  direction: THREE.Vector2; // normalized (x,z)
  amplitude: number;        // meters
  wavelength: number;       // meters
  steepness: number;        // 0..1
}

export interface GerstnerWaveFieldOptions {
  waves: GerstnerWave[];
  maxWaves?: number;
}

const GRAVITY = 9.81;

export class GerstnerWaveField implements IWaveLayer {
  readonly id = 'gerstner';

  private waves: GerstnerWave[];
  private maxWaves: number;

  constructor(options: GerstnerWaveFieldOptions) {
    this.waves = options.waves;
    this.maxWaves = options.maxWaves ?? 16;
  }

  update(dt: number): void {
    void dt; // analytic, nothing to integrate (for now)
  }

  bindMaterial(material: THREE.ShaderMaterial): void {
    const max = this.maxWaves;
    const waveCount = Math.min(this.waves.length, max);

    if (!material.uniforms) {
      (material as any).uniforms = {};
    }

    const uniforms: any = material.uniforms;

    uniforms.uWaveCount ??= { value: 0 };
    uniforms.uWaveDirs ??= { value: new Float32Array(max * 2) };
    uniforms.uWaveAmplitudes ??= { value: new Float32Array(max) };
    uniforms.uWaveWavelengths ??= { value: new Float32Array(max) };
    uniforms.uWaveSteepness ??= { value: new Float32Array(max) };

    const dirs = uniforms.uWaveDirs.value as Float32Array;
    const amps = uniforms.uWaveAmplitudes.value as Float32Array;
    const wavelengths = uniforms.uWaveWavelengths.value as Float32Array;
    const steepnesses = uniforms.uWaveSteepness.value as Float32Array;

    for (let i = 0; i < waveCount; i++) {
      const w = this.waves[i];
      dirs[i * 2 + 0] = w.direction.x;
      dirs[i * 2 + 1] = w.direction.y;
      amps[i] = w.amplitude;
      wavelengths[i] = w.wavelength;
      steepnesses[i] = w.steepness;
    }

    uniforms.uWaveCount.value = waveCount;
  }

  sampleCPU(
    posXZ: THREE.Vector2,
    time: number,
    out: WaveSample = { height: 0, normal: new THREE.Vector3(0, 1, 0) }
  ): WaveSample {
    const eps = 0.1;

    const h = (p: THREE.Vector2) => this.heightAt(p, time);

    const y = h(posXZ);
    const hx = h(new THREE.Vector2(posXZ.x + eps, posXZ.y));
    const hz = h(new THREE.Vector2(posXZ.x, posXZ.y + eps));

    const dx = hx - y;
    const dz = hz - y;

    out.height = y;
    out.normal.set(-dx, 1, -dz).normalize();
    return out;
  }

  private heightAt(posXZ: THREE.Vector2, time: number): number {
    let height = 0;

    for (const w of this.waves) {
      const k = (2 * Math.PI) / w.wavelength;
      const d = w.direction;
      const dot = d.x * posXZ.x + d.y * posXZ.y;
      const omega = Math.sqrt(GRAVITY * k);
      const phase = k * dot - omega * time;

      height += w.amplitude * Math.sin(phase);
    }

    return height;
  }
}

// Simple default config so we can see something quickly
export function createDefaultGerstnerField(): GerstnerWaveField {
  const waves: GerstnerWave[] = [
    {
      direction: new THREE.Vector2(1, 0).normalize(),
      amplitude: 0.8,
      wavelength: 12,
      steepness: 0.6
    },
    {
      direction: new THREE.Vector2(0.5, 0.5).normalize(),
      amplitude: 0.4,
      wavelength: 7,
      steepness: 0.7
    },
    {
      direction: new THREE.Vector2(-0.3, 0.7).normalize(),
      amplitude: 0.3,
      wavelength: 4,
      steepness: 0.5
    }
  ];

  return new GerstnerWaveField({ waves, maxWaves: 16 });
}

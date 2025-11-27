import * as THREE from 'three';
import type { WaterAppearanceProfile } from './OceanConfig';

export interface WaveSample {
  height: number;
  normal: THREE.Vector3;
}

export interface WaveQuery {
  sample(positionXZ: THREE.Vector2, time: number, out?: WaveSample): WaveSample;
}

export interface IWaveLayer {
  readonly id: string;

  update(dt: number): void;

  bindMaterial(material: THREE.ShaderMaterial): void;

  sampleCPU(posXZ: THREE.Vector2, time: number, out?: WaveSample): WaveSample;
}

export interface WaveSystemOptions {
  appearance: WaterAppearanceProfile;
  layers: IWaveLayer[];
}

export class WaveSystem implements WaveQuery {
  public appearance: WaterAppearanceProfile;
  private layers: IWaveLayer[];

  constructor(options: WaveSystemOptions) {
    this.appearance = options.appearance;
    this.layers = options.layers.slice();
  }

  update(dt: number): void {
    for (const layer of this.layers) {
      layer.update(dt);
    }
  }

  bindMaterial(material: THREE.ShaderMaterial): void {
    for (const layer of this.layers) {
      layer.bindMaterial(material);
    }
  }

  setAppearance(appearance: WaterAppearanceProfile): void {
    this.appearance = appearance;
  }

  // Placeholder – later we’ll propagate to layers that care about wind
  setWind(speed: number, directionDeg: number): void {
    void speed;
    void directionDeg;
  }

  sample(
    positionXZ: THREE.Vector2,
    time: number,
    out: WaveSample = { height: 0, normal: new THREE.Vector3(0, 1, 0) }
  ): WaveSample {
    if (this.layers.length === 0) {
      out.height = 0;
      out.normal.set(0, 1, 0);
      return out;
    }

    let heightAcc = 0;
    const normalAcc = new THREE.Vector3();
    const tmp: WaveSample = { height: 0, normal: new THREE.Vector3() };

    for (const layer of this.layers) {
      layer.sampleCPU(positionXZ, time, tmp);
      heightAcc += tmp.height;
      normalAcc.add(tmp.normal);
    }

    out.height = heightAcc / this.layers.length;
    out.normal.copy(normalAcc.normalize());
    return out;
  }
}

// CPU height function (stub for future GPU). Keeps a single source of truth.
import { makeFBM2D, Noise2D } from "./noise";

export type HeightParams = {
  scale?: number;        // world units per noise unit
  amplitude?: number;    // max height
  seed?: number;
  octaves?: number;
  lacunarity?: number;
  gain?: number;
};

export class Heightfield {
  private noise: Noise2D;
  private params: Required<HeightParams>;

  constructor(p: HeightParams = {}) {
    this.params = {
      scale: p.scale ?? 24,
      amplitude: p.amplitude ?? 18,
      seed: p.seed ?? 1337,
      octaves: p.octaves ?? 5,
      lacunarity: p.lacunarity ?? 2.0,
      gain: p.gain ?? 0.5,
    };
    this.noise = makeFBM2D(this.params.seed, this.params.octaves, this.params.lacunarity, this.params.gain);
  }

  setParams(p: Partial<HeightParams>) {
    this.params = { ...this.params, ...p };
    this.noise = makeFBM2D(this.params.seed, this.params.octaves, this.params.lacunarity, this.params.gain);
  }

  heightAt(x: number, z: number): number {
    const n = this.noise(x / this.params.scale, z / this.params.scale); // [-1,1]
    return n * this.params.amplitude;
  }
}

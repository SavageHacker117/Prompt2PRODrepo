import * as THREE from 'three';
import type { WaveSystem, WaveSample } from '../WaveSystem';

export function sampleHeightAt(
  system: WaveSystem,
  x: number,
  z: number,
  time: number,
  out?: WaveSample
): WaveSample {
  const pos = new THREE.Vector2(x, z);
  return system.sample(pos, time, out);
}

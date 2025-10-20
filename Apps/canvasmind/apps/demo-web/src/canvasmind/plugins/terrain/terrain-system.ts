import * as THREE from "three";
import { Heightfield, HeightParams } from "./heightfield-compute";
import { TerrainChunk, TerrainChunkOpts } from "./terrain-chunk";
import type { SplinePath } from "../roads/spline";

// Simple 3x3 tile manager around a moving focus.
export type TerrainSystemOpts = {
  tileSize?: number;
  tileSegments?: number;
  material?: THREE.Material;
  height?: HeightParams;
  carve?: { path: SplinePath; width: number; falloff?: number; bankAngleDeg?: number } | null;
};

export class TerrainSystem {
  public group = new THREE.Group();
  private tiles: TerrainChunk[] = [];
  private indices: [number, number][] = [];
  private hf: Heightfield;
  private opts: Required<TerrainSystemOpts>;
  private originX = 0;
  private originZ = 0;

  constructor(opts: TerrainSystemOpts = {}) {
    this.opts = {
      tileSize: opts.tileSize ?? 200,
      tileSegments: opts.tileSegments ?? 120,
      material: opts.material ?? new THREE.MeshStandardMaterial({ color: 0x6f8b52 }),
      height: opts.height ?? {},
      carve: opts.carve ?? null,
    };
    this.hf = new Heightfield(this.opts.height);

    const half = this.opts.tileSize * 0.5;
    const offsets = [-1, 0, 1];
    for (let dz of offsets) for (let dx of offsets) {
      const chunk = new TerrainChunk(this.hf, {
        size: this.opts.tileSize,
        segments: this.opts.tileSegments,
        material: this.opts.material,
        carveRoad: this.opts.carve,
      });
      chunk.mesh.position.set(dx * this.opts.tileSize, 0, dz * this.opts.tileSize);
      this.group.add(chunk.mesh);
      this.tiles.push(chunk);
      this.indices.push([dx, dz]);
    }
    this.rebuildAll(0, 0);
  }

  setCarve(path: SplinePath, width = 7, falloff = 6, bankAngleDeg = 0) {
    this.opts.carve = { path, width, falloff, bankAngleDeg };
    for (const t of this.tiles) (t as any).opts.carveRoad = this.opts.carve;
    this.rebuildAll(this.originX, this.originZ);
  }

  setHeightParams(p: Partial<HeightParams>) {
    this.hf.setParams(p);
    this.rebuildAll(this.originX, this.originZ);
  }

  updateFocus(x: number, z: number) {
    const s = this.opts.tileSize;
    const baseX = Math.floor(x / s) * s;
    const baseZ = Math.floor(z / s) * s;
    if (baseX === this.originX && baseZ === this.originZ) return;
    this.originX = baseX; this.originZ = baseZ;

    // move tiles into new 3x3 grid around base
    const offsets = [-1, 0, 1];
    let idx = 0;
    for (let dz of offsets) for (let dx of offsets) {
      const mesh = this.tiles[idx++].mesh;
      mesh.position.set(baseX + dx * s, 0, baseZ + dz * s);
    }
    this.rebuildAll(baseX, baseZ);
  }

  private rebuildAll(baseX: number, baseZ: number) {
    const s = this.opts.tileSize;
    let i = 0;
    const offsets = [-1, 0, 1];
    for (let dz of offsets) for (let dx of offsets) {
      this.tiles[i++].rebuild(baseX + dx * s, baseZ + dz * s);
    }
  }
}

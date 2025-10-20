import * as THREE from "three";
import { SplinePath } from "./spline";
import { buildRoadMesh } from "./road-mesher";
import { TerrainSystem } from "../terrain/terrain-system";

export type RoadInfiniteOpts = {
  seed?: number;
  segmentCount?: number;
  segmentLen?: number;
  curvature?: number;
  width?: number;
  bankAngleDeg?: number;
  terrain?: TerrainSystem | null;
};

export class RoadInfinite {
  public group = new THREE.Group();
  public path: SplinePath;
  public road?: THREE.Mesh;
  private opts: Required<RoadInfiniteOpts>;

  constructor(opts: RoadInfiniteOpts = {}) {
    this.opts = {
      seed: opts.seed ?? 7,
      segmentCount: opts.segmentCount ?? 18,
      segmentLen: opts.segmentLen ?? 80,
      curvature: opts.curvature ?? 0.7,
      width: opts.width ?? 7,
      bankAngleDeg: opts.bankAngleDeg ?? 5,
      terrain: opts.terrain ?? null,
    };
    this.path = SplinePath.generate(
      this.opts.seed,
      this.opts.segmentCount,
      this.opts.segmentLen,
      this.opts.curvature
    );
  }

  async build() {
    if (this.road) {
      this.group.remove(this.road);
      this.road.geometry.dispose();
      (this.road.material as THREE.Material).dispose?.();
    }
    this.road = await buildRoadMesh(this.path, { width: this.opts.width, bankAngleDeg: this.opts.bankAngleDeg });
    this.group.add(this.road);
    if (this.opts.terrain) {
      this.opts.terrain.setCarve(this.path, this.opts.width, 8, this.opts.bankAngleDeg);
    }
  }

  /** call per frame with the player's world position */
  tick(playerX: number, playerZ: number) {
    if (this.opts.terrain) this.opts.terrain.updateFocus(playerX, playerZ);
  }
}

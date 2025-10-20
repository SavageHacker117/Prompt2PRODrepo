import * as THREE from "three";
import type { Heightfield } from "./heightfield-compute";
import type { SplinePath } from "../roads/spline";

export type TerrainChunkOpts = {
  size?: number;        // world units (square chunk)
  segments?: number;    // grid resolution per side
  material?: THREE.Material;
  carveRoad?: {
    path: SplinePath;
    width: number;      // meters
    falloff?: number;   // meters from road to blend back to terrain
    bankAngleDeg?: number;
  } | null;
};

export class TerrainChunk {
  public readonly mesh: THREE.Mesh;
  private readonly geo: THREE.PlaneGeometry;
  private opts: Required<TerrainChunkOpts>;
  private hf: Heightfield;

  constructor(hf: Heightfield, opts: TerrainChunkOpts = {}) {
    this.hf = hf;
    this.opts = {
      size: opts.size ?? 200,
      segments: Math.max(2, opts.segments ?? 100),
      material: opts.material ?? new THREE.MeshStandardMaterial({ color: 0x6f8b52, roughness: 1, metalness: 0 }),
      carveRoad: opts.carveRoad ?? null,
    };

    this.geo = new THREE.PlaneGeometry(this.opts.size, this.opts.size, this.opts.segments, this.opts.segments);
    this.geo.rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(this.geo, this.opts.material);
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = true;
  }

  /** Rebuild heights around a new center point in world space. */
  rebuild(centerX: number, centerZ: number) {
    const pos = this.geo.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    const half = this.opts.size * 0.5;

    const carve = this.opts.carveRoad;

    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const wx = v.x + centerX;
      const wz = v.z + centerZ;

      // base terrain height
      let h = this.hf.heightAt(wx, wz);

      // carve road: flatten near spline center with smooth falloff
      if (carve) {
        const distInfo = carve.path.distanceToPoint(wx, wz); // approx lateral distance + signed side
        const d = Math.abs(distInfo.distance);
        const side = Math.sign(distInfo.distance) || 1;
        const halfW = carve.width * 0.5;
        const blend = THREE.MathUtils.clamp((d - halfW) / (carve.falloff ?? 6), 0, 1);
        const roadHeight = this.hf.heightAt(distInfo.closest.x, distInfo.closest.z);
        // optional banking: tilt road a bit using side
        const bankRad = THREE.MathUtils.degToRad(carve.bankAngleDeg ?? 0) * side;
        const bankDelta = Math.sin(bankRad) * Math.max(0, halfW - d);

        h = THREE.MathUtils.lerp(roadHeight + bankDelta, h, blend);
      }

      pos.setY(i, h);
    }
    pos.needsUpdate = true;
    this.geo.computeVertexNormals();
  }
}

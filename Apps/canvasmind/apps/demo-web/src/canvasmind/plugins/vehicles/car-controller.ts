import * as THREE from "three";
import type { SplinePath } from "../roads/spline";
import type { TerrainSystem } from "../terrain/terrain-system";

export type CarControllerOpts = {
  speed?: number;           // m/s nominal
  acceleration?: number;    // m/s^2
  maxSpeed?: number;
  path: SplinePath;
  terrain: TerrainSystem | null;
};

export class CarController {
  private node: THREE.Object3D;
  private t = 0; // param on spline [0,1]
  private s = 0; // world distance along curve (approx)
  private speed: number;
  private accel: number;
  private maxSpeed: number;
  private opts: CarControllerOpts;

  constructor(node: THREE.Object3D, opts: CarControllerOpts) {
    this.node = node;
    this.opts = opts;
    this.speed = opts.speed ?? 18;
    this.accel = opts.acceleration ?? 8;
    this.maxSpeed = opts.maxSpeed ?? 40;
  }

  /** basic WASD steering: A/D yaw input affects spline t */
  update(dt: number, input: { throttle: number; steer: number }) {
    // speed integrate
    const target = THREE.MathUtils.clamp(this.speed + input.throttle * this.accel * dt, 0, this.maxSpeed);
    this.speed = THREE.MathUtils.damp(this.speed, target, 5, dt);

    // steering nudges "t" forward while offsetting lateral orientation
    this.t += (this.speed * dt) /  (this.opts.path.length || 1) * 0.35;
    if (this.t > 1) this.t -= 1;

    const p = this.opts.path.getPoint(this.t);
    const tangent = this.opts.path.getTangent(this.t).normalize();

    // orient to forward with a little roll from steer
    const up = new THREE.Vector3(0, 1, 0);
    const right = up.clone().cross(tangent).normalize();
    const banking = input.steer * 0.15; // roll
    const finalUp = tangent.clone().cross(right).normalize();
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(
      p.clone().add(tangent), p, finalUp
    ));
    this.node.quaternion.slerp(q, 1.0);

    // height from terrain if available
    let y = p.y;
    if (this.opts.terrain) {
      // sample center tile (approximate using its height function)
      const hf = (this.opts.terrain as any).hf as { heightAt(x:number,z:number): number } | undefined;
      if (hf) y = hf.heightAt(p.x, p.z) + 0.5;
    }

    this.node.position.set(p.x, y, p.z);

    // nudge the terrain focus
    this.opts.terrain?.updateFocus(p.x, p.z);
  }
}

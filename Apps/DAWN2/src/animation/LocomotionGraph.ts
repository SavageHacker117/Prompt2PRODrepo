// Blend 2D locomotion (forward/back + strafe) + run modifier.
// Uses weights rather than repeated crossfades so we can layer Aim on top.
import { ClipLibrary } from './ClipLibrary';

export type LocomotionParams = {
  run: boolean;
  dirX: number; // -1..+1 (left..right)
  dirZ: number; // -1..+1 (back..forward)
  speedScale: number; // 0..1
};

export class LocomotionGraph {
  lib: ClipLibrary;
  names = {
    idle: 'Idle',
    forward: 'Walk',
    back: 'WalkBack',
    left: 'StrafeLeft',
    right: 'StrafeRight',
    run: 'Run'
  };

  constructor(lib: ClipLibrary) { this.lib = lib; }

  update(p: LocomotionParams) {
    const ax = Math.max(0,  p.dirX);
    const bx = Math.max(0, -p.dirX);
    const fz = Math.max(0,  p.dirZ);
    const bz = Math.max(0, -p.dirZ);

    const moving = (ax + bx + fz + bz) > 0.001;
    const runW   = p.run && fz > 0.3 ? 1 : 0;

    // Base idle
    this.lib.weight(this.names.idle, moving ? 0 : 1);

    // 4-way blend
    this.lib.weight(this.names.forward, fz * (1 - runW));
    this.lib.weight(this.names.back,    bz);
    this.lib.weight(this.names.left,    bx);
    this.lib.weight(this.names.right,   ax);

    // Run overrides fwd when active
    this.lib.weight(this.names.run, runW);

    // Optional overall timescale
    for (const a of Object.values(this.lib.actions)) a.timeScale = 0.25 + p.speedScale * 1.75;
  }
}

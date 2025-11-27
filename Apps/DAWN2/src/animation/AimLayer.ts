// Simple upper-body layer: aim pose + fire/reload pulses on top of locomotion.
import * as THREE from 'three';
import { ClipLibrary } from './ClipLibrary';

export class AimLayer {
  lib: ClipLibrary;
  cfg = { aim: 'Aim', fire: 'Fire', reload: 'Reload' };
  private additive: THREE.AnimationAction | null = null;

  constructor(lib: ClipLibrary) { this.lib = lib; }

  enableAdditive() {
    const a = this.lib.get(this.cfg.aim);
    if (!a) return;
    // mark as additive by subtracting the rest pose (approx) – author aim as additive for best results
    // See AnimationAction docs for weight & blend usage. 
    a.setEffectiveWeight(0).play();
    this.additive = a;
  }

  setAim(weight: number) {
    if (!this.additive) this.enableAdditive();
    this.additive?.setEffectiveWeight(weight).play();
  }

  fire()  { this.pulse(this.cfg.fire,   0.15); }
  reload(){ this.pulse(this.cfg.reload, 0.8);  }

  private pulse(name: string, dur: number) {
    const a = this.lib.get(name);
    if (!a) return;
    a.reset().setLoop(THREE.LoopOnce, 1).setEffectiveWeight(1).play();
    a.clampWhenFinished = true;
    a.paused = false;
    // Let locomotion continue underneath; mixer blending will handle it. 
  }
}

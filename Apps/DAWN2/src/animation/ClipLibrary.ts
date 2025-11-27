// Manages named AnimationActions for the active actor
import * as THREE from 'three';

export type ClipDict = Record<string, THREE.AnimationAction>;

export class ClipLibrary {
  mixer: THREE.AnimationMixer;
  actions: ClipDict = {};
  root: THREE.Object3D;

  constructor(root: THREE.Object3D, clips: THREE.AnimationClip[]) {
    this.root = root;
    this.mixer = new THREE.AnimationMixer(root);
    for (const c of clips) {
      const a = this.mixer.clipAction(c);
      a.clampWhenFinished = false;
      a.enable = true;
      this.actions[c.name] = a;
    }
  }

  has(name: string) { return !!this.actions[name]; }
  get(name: string) { return this.actions[name]; }

  // play/fade helpers (AnimationMixer/Action per three.js docs)
  // https://threejs.org/docs/#api/en/animation/AnimationAction
  fadeTo(name: string, t = 0.2, weight = 1) {
    const next = this.get(name);
    if (!next) return;
    next.reset().setEffectiveWeight(weight).setLoop(THREE.LoopRepeat, Infinity).play();
    for (const [n, a] of Object.entries(this.actions)) {
      if (n !== name) a.crossFadeTo(next, t, false);
    }
  }

  weight(name: string, w: number) {
    const a = this.get(name);
    if (a) a.enabled = true, a.setEffectiveWeight(w).play();
  }

  step(dt: number) { this.mixer.update(dt); }
}

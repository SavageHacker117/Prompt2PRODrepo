import * as THREE from 'three';

export class CameraDebugger {
  constructor({ scene, camera }) {
    this.camera = camera;
    this.helper = new THREE.CameraHelper(camera);
    this.axes   = new THREE.AxesHelper(1.5);
    this.on = false;
    this.scene = scene;
  }
  enable() { if (this.on) return; this.on = true; this.scene.add(this.helper, this.axes); }
  disable(){ if (!this.on) return; this.on = false; this.scene.remove(this.helper, this.axes); }
  toggle(){ this.on ? this.disable() : this.enable(); }
  update(){ if (this.on) this.helper.update(); }
}

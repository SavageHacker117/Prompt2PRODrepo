// src/game/CameraRig.js
import * as THREE from 'three';

export class CameraRig {
  constructor(camera, renderer, {
    boardCenter = new THREE.Vector3(0, 0, 0),
    dist = 56
  } = {}) {
    this.cam = camera;
    this.renderer = renderer;
    this.center = boardCenter.clone();
    this.baseDist = dist;

    this.mode = 'front'; // 'front' | 'tilt' | 'side' | 'free'
    this.orbit = { phi: THREE.MathUtils.degToRad(18), theta: 0, r: dist };

    // simple free-cam input
    this._drag = false;
    this._last = new THREE.Vector2();
    const dom = renderer.domElement;
    dom.addEventListener('pointerdown', e => { this._drag = true; this._last.set(e.clientX, e.clientY); });
    dom.addEventListener('pointerup',   () => { this._drag = false; });
    dom.addEventListener('pointerleave',() => { this._drag = false; });
    dom.addEventListener('pointermove', e => {
      if (!this._drag || this.mode!=='free') return;
      const dx = (e.clientX - this._last.x) / dom.clientWidth;
      const dy = (e.clientY - this._last.y) / dom.clientHeight;
      this._last.set(e.clientX, e.clientY);
      this.orbit.theta -= dx * Math.PI * 2.0;
      this.orbit.phi   = THREE.MathUtils.clamp(this.orbit.phi - dy * Math.PI, 0.05, Math.PI - 0.05);
    });
    dom.addEventListener('wheel', e => {
      if (this.mode!=='free') return;
      this.orbit.r = THREE.MathUtils.clamp(this.orbit.r + Math.sign(e.deltaY) * 2.0, 24, 120);
    });
    this._applyPreset('front');
  }

  setMode(mode){
    this.mode = mode;
    if (mode !== 'free') this._applyPreset(mode);
  }

  _applyPreset(mode){
    if (mode === 'front'){
      this.orbit = { phi: THREE.MathUtils.degToRad(18), theta: 0, r: this.baseDist };
    } else if (mode === 'tilt'){
      this.orbit = { phi: THREE.MathUtils.degToRad(32), theta: THREE.MathUtils.degToRad(-6), r: this.baseDist * 0.95 };
    } else if (mode === 'side'){
      this.orbit = { phi: THREE.MathUtils.degToRad(22), theta: THREE.MathUtils.degToRad(40), r: this.baseDist * 1.02 };
    }
  }

  // smooth update each frame
  update(dt){
    const target = this._sphericalToCartesian(this.orbit.r, this.orbit.phi, this.orbit.theta).add(this.center);
    // soft follow
    this.cam.position.lerp(target, 1 - Math.pow(0.0001, dt)); // critically damped-ish
    this.cam.lookAt(this.center);
  }

  _sphericalToCartesian(r, phi, theta){
    const s = Math.sin(phi);
    return new THREE.Vector3(
      r * s * Math.cos(theta),
      r * Math.cos(phi),
      r * s * Math.sin(theta)
    );
  }
}

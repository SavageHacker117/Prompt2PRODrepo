// core/CameraController.js
// Lightweight camera controller with proper wheel-zoom (dolly), drag-rotate, and pan.
// Ignores input when over UI panels/console.

import * as THREE from 'three';

export class CameraController {
  constructor(camera, domEl = document.body) {
    this.camera = camera;
    this.domEl  = domEl;

    // mode: 'orbit' (default) | 'fly' (basic WASD optional later)
    this.mode = 'orbit';
    // zoomStyle: 'dolly' (change distance) | 'fov' (change FOV)
    this.zoomStyle = 'dolly';

    // orbit state
    this.target = new THREE.Vector3(0, 1.2, 0);
    this.spherical = new THREE.Spherical(6.0, Math.PI * 0.5, Math.PI); // r, phi (down from Y), theta (around Y)
    this.rotateSpeed = 0.0028;
    this.panSpeed = 0.0018;
    this.dollySpeed = 1.08;   // multiplicative
    this.minDistance = 1.2;
    this.maxDistance = 50;

    this._dragging = false;
    this._btn = 0;
    this._px = 0; this._py = 0;

    // bind
    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerUp   = this._onPointerUp.bind(this);
    this._onWheel       = this._onWheel.bind(this);

    domEl.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('pointermove', this._onPointerMove);
    window.addEventListener('pointerup',   this._onPointerUp);
    domEl.addEventListener('wheel', this._onWheel, { passive: false });

    this._apply();
  }

  dispose() {
    this.domEl.removeEventListener('pointerdown', this._onPointerDown);
    window.removeEventListener('pointermove', this._onPointerMove);
    window.removeEventListener('pointerup',   this._onPointerUp);
    this.domEl.removeEventListener('wheel', this._onWheel);
  }

  setMode(m) { this.mode = m; }
  setZoomStyle(z) { this.zoomStyle = z; }

  _overUI(ev) {
    const el = ev.target;
    return !!(el.closest?.('.anim-panel, .script-panel, #dbg, .panel'));
  }

  _onPointerDown(ev) {
    if (this._overUI(ev)) return;
    this._dragging = true;
    this._btn = ev.button;
    this._px = ev.clientX;
    this._py = ev.clientY;
    this.domEl.setPointerCapture?.(ev.pointerId);
  }

  _onPointerMove(ev) {
    if (!this._dragging) return;
    const dx = ev.clientX - this._px;
    const dy = ev.clientY - this._py;
    this._px = ev.clientX;
    this._py = ev.clientY;

    if (this.mode !== 'orbit') return;

    if (this._btn === 0) { // LMB rotate
      this.spherical.theta -= dx * this.rotateSpeed;
      this.spherical.phi   -= dy * this.rotateSpeed;
      const EPS = 1e-3;
      this.spherical.phi = Math.max(EPS, Math.min(Math.PI - EPS, this.spherical.phi));
    } else { // MMB/RMB pan
      // Pan in screen space -> world offset at target depth
      const pan = new THREE.Vector3();
      const m = new THREE.Matrix3().setFromMatrix4(this.camera.matrix);
      const right = new THREE.Vector3(m.elements[0], m.elements[1], m.elements[2]).normalize();
      const up    = new THREE.Vector3(m.elements[3], m.elements[4], m.elements[5]).normalize();
      pan.copy(right).multiplyScalar(-dx * this.panSpeed * this.spherical.radius);
      pan.addScaledVector(up, dy * this.panSpeed * this.spherical.radius);
      this.target.add(pan);
    }
    this._apply();
  }

  _onPointerUp(_ev) {
    this._dragging = false;
  }

  _onWheel(ev) {
    if (this._overUI(ev)) return;
    ev.preventDefault();

    const delta = Math.sign(ev.deltaY);
    if (this.zoomStyle === 'fov') {
      this.camera.fov = THREE.MathUtils.clamp(this.camera.fov + delta * 1.5, 20, 90);
      this.camera.updateProjectionMatrix();
    } else {
      const mult = delta > 0 ? this.dollySpeed : (1 / this.dollySpeed);
      this.spherical.radius = THREE.MathUtils.clamp(
        this.spherical.radius * mult,
        this.minDistance, this.maxDistance
      );
      this._apply();
    }
  }

  _apply() {
    const pos = new THREE.Vector3().setFromSpherical(this.spherical).add(this.target);
    this.camera.position.copy(pos);
    this.camera.lookAt(this.target);
  }
}

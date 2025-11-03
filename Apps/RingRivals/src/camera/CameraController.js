import * as THREE from 'three';

export class CameraController {
  constructor({ camera, ring, crowd }) {
    this.camera = camera;
    this.ring = ring; this.crowd = crowd;

    this._intent = 'sweep'; // 'sweep' | 'corners' | 'fight'
    this._t = 0;

    // follow-cam bits
    this._followTarget = null;          // set with lockTo(boxer)
    this._yawBias = 0.22;               // fixed small shoulder peek (prevents drift)
    this._stepPhase = 0;
    this._shake = 0;

    // optional footstep callback
    this.onStep = null;
  }

  crowdSweep()   { this._intent = 'sweep';   this._t = 0; }
  focusCorners() { this._intent = 'corners'; this._t = 0; }
  setFightMode() { this._intent = 'fight';   this._t = 0; }

  bigHitShake(a=0.6) { this._shake = Math.min(1, this._shake + a); }
  lockTo(boxer)      { this._followTarget = boxer || null; }

  _updateFollow(dt) {
    if (!this._followTarget) return;

    // offsets relative to the boxer
    const back  = new THREE.Vector3(0, 2.0, 4.0);   // behind & up
    const focus = new THREE.Vector3(0, 1.35, 0.0);  // center mass

    // world space
    const root = this._followTarget.root;
    const worldBack  = root.localToWorld(back.clone());
    const worldFocus = root.localToWorld(focus.clone());

    // tiny yaw bias so we're not perfectly centered
    const rotY = new THREE.Matrix4().makeRotationY(this._yawBias);
    worldBack.sub(root.position).applyMatrix4(rotY).add(root.position);

    // step bob (based on desired velocity)
    const speed = this._followTarget.vel?.length?.() ?? 0;
    this._stepPhase = (this._stepPhase + speed * dt * 6.0) % (Math.PI*2);
    const bobY = Math.sin(this._stepPhase*2)   * 0.05 * Math.min(1, speed);
    const bobX = Math.sin(this._stepPhase*3.1) * 0.03 * Math.min(1, speed);

    // hit shake decay
    this._shake *= Math.exp(-dt*3.0);

    worldBack.x += bobX + (Math.random()-0.5)*0.02*this._shake;
    worldBack.y += bobY + this._shake*0.06;

    // smooth follow (stable even on big dt spikes)
    const s = 1 - Math.exp(-Math.min(dt, 1/30) * 8);
    this.camera.position.lerp(worldBack, s);
    this.camera.lookAt(worldFocus);
  }

  update(dt, intent='idle') {
    if (intent !== this._intent && intent !== 'idle') { this._intent = intent; this._t = 0; }
    this._t += dt;

    if (this._intent === 'fight') { this._updateFollow(dt); return; }

    // cinematic orbits only when not fighting
    if (this._intent === 'sweep') {
      const r = 17, h = 7.2, a = this._t * 0.35;
      this.camera.position.set(Math.cos(a)*r, h, Math.sin(a)*r);
      this.camera.lookAt(0,1.3,0);
      return;
    }
    if (this._intent === 'corners') {
      const r = 8.8, h = 4.8, a = Math.PI/4 + Math.sin(this._t*0.5)*0.2;
      this.camera.position.set(Math.cos(a)*r, h, Math.sin(a)*r);
      this.camera.lookAt(0,1.2,0);
      return;
    }
  }
}

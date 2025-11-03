import * as THREE from 'three';

export class BoxerAI {
  constructor({ boxer, opponent }) {
    this.me = boxer;
    this.opp = opponent;

    this._jabCd = 0;
    this._crossCd = 0;
    this._repath = 0;
    this._desire = new THREE.Vector2(); // desired movement dir
  }

  // robust 2D pos helper (never depends on a method on Boxer)
  _p2(b) {
    if (!b) return new THREE.Vector2();
    // prefer method if present, fall back to root
    if (typeof b.getPosition2 === 'function') return b.getPosition2();
    const p = b.root?.position;
    return new THREE.Vector2(p?.x || 0, p?.z || 0);
  }

  // face opponent a bit (purely cosmetic; boxer model is simple)
  _face(target) {
    const me = this.me.root.position;
    const t = target.clone();
    this.me.root.lookAt(t.x, this.me.root.position.y, t.y);
  }

  update(dt) {
    const meP  = this._p2(this.me);
    const oppP = this._p2(this.opp);

    // movement spacing
    const toOpp = oppP.clone().sub(meP);
    const dist  = toOpp.length();            // 2D distance
    const want  = toOpp.normalize();

    // simple spacing rules
    const IDEAL_MIN = 1.25;
    const IDEAL_MAX = 2.25;

    this._repath -= dt;
    if (this._repath <= 0) {
      this._repath = 0.15 + Math.random() * 0.1;

      if (dist > IDEAL_MAX) {
        // close in
        this._desire.copy(want);
      } else if (dist < IDEAL_MIN) {
        // back off
        this._desire.copy(want).multiplyScalar(-1);
      } else {
        // circle-strafe a bit
        const side = Math.random() < 0.5 ? 1 : -1;
        this._desire.set(-want.y * side, want.x * side).multiplyScalar(0.6);
      }
    }

    // write desired movement to boxer vel
    this.me.vel.copy(this._desire);

    // basic attack cadence
    this._jabCd   = Math.max(0, this._jabCd - dt);
    this._crossCd = Math.max(0, this._crossCd - dt);

    const inRange = dist <= 1.6;

    if (inRange && this._jabCd <= 0) {
      this.me.punch('L');
      this._jabCd = 0.50 + Math.random() * 0.25;
    }
    if (inRange && this._crossCd <= 0.05) {
      this.me.punch('R');
      this._crossCd = 0.85 + Math.random() * 0.35;
    }

    // occasionally block / weave when too close
    this.me.anim.block = dist < 1.1 ? 1 : 0;
    this.me.anim.weave = (Math.random() < 0.02) ? 1 : Math.max(0, this.me.anim.weave - dt * 2.0);

    // face opponent
    this._face(oppP);
  }
}

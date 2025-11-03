import * as THREE from 'three';

export class FightLogic {
  constructor({ scene, player, opponent, opponentAI, ui, audio, ring, crowd, camera, state }) {
    this.scene = scene;
    this.player = player; this.opp = opponent; this.ai = opponentAI;
    this.ui = ui; this.audio = audio; this.ring = ring; this.crowd = crowd; this.camera = camera; this.state = state;

    this.round = 1;
    this.roundTime = 180;
    this.running = false;
    this._pre = 0;

    this._intensity = 0;
    this._replay = false;
    this.lastHitTime = 0;

    this._cd = { pL:0, pR:0, oL:0, oR:0 };
  }

  _resetFighters() {
    // positions near center, facing each other, restore health/stamina
    this.player.root.position.set(-2.0, 1.22,  1.4);
    this.opp.root.position.set(   2.0, 1.22, -1.4);
    this.player.health = 100; this.player.stamina = 100;
    this.opp.health    = 100; this.opp.stamina    = 100;
    this._cd = { pL:0, pR:0, oL:0, oR:0 };
  }

  startBout() {
    this.round = 1;
    this.roundTime = 180;
    this.running = false;
    this._pre = 3;
    this._resetFighters();
    this.ui.setCenterText?.('3');
    this.camera.crowdSweep?.();
    this.ui.flashIntro('Round 1');
  }

  hudState() {
    const mm = (s)=> `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`;
    const display = this.running ? this.roundTime : 180;
    return {
      pName: this.player.name,
      oName: this.opp.name,
      clock: mm(Math.max(0, Math.floor(display))),
      pHealth: this.player.health/100,
      oHealth: this.opp.health/100,
      round: this.round
    };
  }

  cameraIntent() { return this.running ? 'fight' : 'sweep'; }
  getIntensity() { return this._intensity; }
  isDoingReplay() { return this._replay; }

  _clampToRing(p) {
    const B = 5.6;
    p.x = Math.max(-B, Math.min(B, p.x));
    p.z = Math.max(-B, Math.min(B, p.z));
  }
  _separate(pA, pB, minDist=1.28) {
    const dx = pB.x - pA.x, dz = pB.z - pA.z;
    const d2 = dx*dx + dz*dz;
    if (d2 === 0) { pA.x -= 0.01; pB.x += 0.01; return; }
    const d = Math.sqrt(d2);
    if (d < minDist) {
      const push = (minDist - d) * 0.5;
      const nx = dx / d, nz = dz / d;
      pA.x -= nx * push; pA.z -= nz * push;
      pB.x += nx * push; pB.z += nz * push;
    }
  }

  update(dt) {
    // ----- pre-countdown -----
    if (this._pre > 0) {
      this._pre -= dt;
      const n = Math.ceil(Math.max(0, this._pre));
      this.ui.setCenterText?.(n > 0 ? String(n) : '');
      if (this._pre <= 0) {
        this.running = true;
        this.ui.setCenterText?.('');
        this.audio.onBell?.();
        this.camera.setFightMode?.();
      }
      return;
    }
    if (!this.running) return;

    // ----- round timer -----
    this.roundTime -= dt;
    if (this.roundTime <= 0) {
      this.round++;
      this.roundTime = 180;
      this._pre = 3;
      this.running = false;
      this._resetFighters();                 // reset HP + recenter each round
      this.ui.flashIntro(`Round ${this.round}`);
      this.camera.focusCorners?.();
      return;
    }

    // cooldowns
    this._cd.pL = Math.max(0, this._cd.pL - dt);
    this._cd.pR = Math.max(0, this._cd.pR - dt);
    this._cd.oL = Math.max(0, this._cd.oL - dt);
    this._cd.oR = Math.max(0, this._cd.oR - dt);

    // ----- hit detection -----
    const SPHERE = 0.55, FIST_R = 0.18, RANGE = 1.25;
    const DMG = { min: 6, max: 10 };
    const ACTIVE_T = 0.35, COOLDOWN = 0.12;

    const glovePos = (boxer, L) =>
      (L ? boxer.parts.gloveL : boxer.parts.gloveR).getWorldPosition(new THREE.Vector3());
    const chestPos = (boxer) => boxer.root.getWorldPosition(new THREE.Vector3());

    const tryHit = (attacker, defender, L, cdKey) => {
      const active = L ? attacker.anim.punchL > ACTIVE_T : attacker.anim.punchR > ACTIVE_T;
      if (!active || this._cd[cdKey] > 0) return;

      const f = glovePos(attacker, L);
      const c = chestPos(defender);
      const centerDist = f.distanceTo(c);

      if (centerDist < RANGE && centerDist < (FIST_R + SPHERE)) {
        const dmg = DMG.min + Math.random() * (DMG.max - DMG.min);
        defender.wasHit(dmg);

        this.camera.bigHitShake?.();
        this.audio.onBigHit?.();
        this.ring.spawnImpactFX?.(c, L ? 0x66ccff : 0xff6666);

        this._replay = Math.random() < 0.25;
        setTimeout(()=> this._replay=false, 1200);

        this._cd[cdKey] = COOLDOWN;
        this.lastHitTime = performance.now();
        this._intensity = Math.min(1, this._intensity + 0.22);
      }
    };

    tryHit(this.player, this.opp, true,  'pL');
    tryHit(this.player, this.opp, false, 'pR');
    tryHit(this.opp,    this.player, true,  'oL');
    tryHit(this.opp,    this.player, false, 'oR');

    // intensity
    const since = (performance.now() - this.lastHitTime) / 1000;
    const base = 0.2 + (1 - (this.player.health + this.opp.health)/200) * 0.5;
    this._intensity += (base - this._intensity) * dt * 0.35;
    if (since > 5) this._intensity *= 0.996;
    this.audio.setIntensity?.(this._intensity);

    // keep apart & inside ropes every frame
    this._separate(this.player.root.position, this.opp.root.position, 1.28);
    this._clampToRing(this.player.root.position);
    this._clampToRing(this.opp.root.position);

    // KO
    if (this.player.health <= 0 || this.opp.health <= 0) {
      const playerWon = this.opp.health <= 0;
      this.running = false;
      this.state.record?.(playerWon);
      this.ui.flashIntro(playerWon ? 'KO! You Win' : 'KO! CPU Wins');
      this.camera.crowdSweep?.();
      this.audio.onKnockDown?.();
    }
  }
}

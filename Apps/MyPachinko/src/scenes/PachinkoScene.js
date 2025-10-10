// src/scenes/PachinkoScene.js
import * as THREE from 'three';
import { createBoard } from '../game/board.js';
import { makeBall } from '../entities/ball.js';
import { BonusAmarion } from '../plugins/gameplay/BonusAmarion.js';
import { MagnetField } from '../plugins/gameplay/MagnetField.js';
import { ShieldBoost } from '../plugins/gameplay/ShieldBoost.js';
import { PowerOrb } from '../plugins/gameplay/PowerOrb.js';
import { EffectsManager, AssetMonitor } from '../game/anim.js';
import { EFFECTS } from '../game/effects.js';

export class PachinkoScene {
  constructor(engine){
    this.engine = engine;
    this.scene  = engine.scene;
    this.camera = engine.camera;
    this.renderer = engine.renderer;

    // Gameplay objects
    this.objects  = [];
    this.balls    = [];
    this._ballTrails = new Map();

    // Economy
    this.money = 5.00;
    this.score = 0;
    this.ballCost = 0.10;

    // Bounds (match board.js)
    this.bounds = { left: -24, right: 24, top: 24, bottom: -24 };

    // UI
    this.hudMoney = document.getElementById('hudMoney');
    this.hudScore = document.getElementById('hudScore');
    this.toastEl  = document.getElementById('toast');
    this.debugEl  = document.getElementById('debugHud');
    this.assetListEl = document.getElementById('assetList');
    this._syncHUD();

    // Scene bits
    this._makeLights();
    this.board = createBoard(this.scene);
    this._makeVideoBackdrop();       // <<< MP4 as board background (front/back)

    // Plugins
    this.bonus  = new BonusAmarion(this); // top-spawn + HP handled in file
    this.magnet = new MagnetField(this);
    this.shield = new ShieldBoost(this);
    this.orb    = new PowerOrb(this);

    // FX
    this.fx = new EffectsManager(this.scene);

    // Input / UI
    this._wireUI();

    // Camera rig + smart compass
    this._makeRig();
    this.setCameraMode('tilt');

    // Asset monitor -> right rail list
    AssetMonitor.listeners.add(() => this._refreshAssetList());

    // Device orientation (if available)
    this._initGyro();
  }

  // ---------- SCENE SETUP ----------
  _makeLights(){
    const hemi = new THREE.HemisphereLight(0x8899aa, 0x111122, 0.9);
    const dir  = new THREE.DirectionalLight(0xffffff, 0.85);
    dir.position.set(20, 40, 20);
    this.scene.add(hemi, dir);
  }

  _makeVideoBackdrop(){
    // Reuse <video id="bgVideo"> as a texture but restrict to board area
    const videoEl = document.getElementById('bgVideo');
    if (!videoEl) return;
    const tex = new THREE.VideoTexture(videoEl);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;

    const w = (this.bounds.right - this.bounds.left) * 0.96; // slight inset
    const h = (this.bounds.top - this.bounds.bottom) * 0.96;

    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      side: THREE.DoubleSide,      // see through “TV removed” look
      transparent: true,
      opacity: 0.95
    });
    const geo = new THREE.PlaneGeometry(w, h);
    const plane = new THREE.Mesh(geo, mat);
    plane.position.set(0, -0.5, -0.6); // behind pegs/floor, inside frame
    plane.renderOrder = -5;            // always under gameplay
    this.scene.add(plane);
    this._videoMesh = plane;

    // Keep video looping cleanly
    videoEl.addEventListener('ended', () => {
      videoEl.currentTime = 0;
      videoEl.play();
    }, { passive: true });
  }

  _wireUI(){
    const byId = id => document.getElementById(id);

    byId('btnDrop').onclick = () => this.spawnBall();
    byId('btnSpawnAmarion').onclick = () => this.spawnRandomAmarion();
    byId('btnAdd$5').onclick = () => { this.money += 5; this._syncHUD(); };
    byId('btnClear').onclick = () => this._clearBalls();

    const camSel = byId('camMode');
    if (camSel) camSel.onchange = () => this.setCameraMode(camSel.value);

    const freeBtn = byId('btnFreeCam');
    if (freeBtn) freeBtn.onclick = () => this.setCameraMode('free');

    const gfx = byId('gfxQuality');
    if (gfx){
      gfx.onchange = () => {
        // We just display what loads via AssetMonitor (no hot-swap path changes here)
        this._toast(`Graphics: ${gfx.options[gfx.selectedIndex].text}`);
      };
    }
  }

  _makeRig(){
    // Camera rig for modes
    this.rig = new THREE.Object3D();
    this.pivot = new THREE.Object3D();
    this.rig.add(this.pivot);
    this.pivot.add(this.camera);
    this.scene.add(this.rig);

    // Axes + compass arrow
    const axes = new THREE.AxesHelper(8);
    axes.renderOrder = 50;
    this.scene.add(axes);
    this._axes = axes;

    // Free-cam dragging
    this._free = { enabled:false, mx:0, my:0, yaw:0, pitch:0, dist:72 };
    const onDown = e => { if (this._camMode!=='free') return; this._free.enabled = true; this._free.mx=e.clientX; this._free.my=e.clientY; };
    const onUp   = () => { this._free.enabled=false; };
    const onMove = e => {
      if (!this._free.enabled) return;
      const dx = e.clientX - this._free.mx;
      const dy = e.clientY - this._free.my;
      this._free.mx = e.clientX; this._free.my = e.clientY;
      this._free.yaw   -= dx * 0.003;
      this._free.pitch -= dy * 0.003;
      this._free.pitch = Math.max(-1.2, Math.min(1.2, this._free.pitch));
    };
    const onWheel = e => {
      if (this._camMode!=='free') return;
      this._free.dist = Math.max(30, Math.min(140, this._free.dist + e.deltaY*0.04));
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('wheel', onWheel, { passive:true });
  }

  setCameraMode(mode){
    this._camMode = mode;
    if (mode === 'front'){
      this.rig.position.set(0, 2, 60);
      this.pivot.rotation.set(0, 0, 0);
      this.camera.lookAt(0, 0, 0);
    } else if (mode === 'tilt'){
      this.rig.position.set(0, 26, 84);
      this.pivot.rotation.set(-0.64, 0, 0);
      this.camera.lookAt(0, -2, 0);
    } else if (mode === 'side'){
      this.rig.position.set(70, 12, 24);
      this.pivot.rotation.set(0, Math.PI*0.9, 0.08);
    } else { // free
      this._free.yaw = 0.0;
      this._free.pitch = -0.55;
      this._free.dist = 84;
      this.rig.position.set(0,0,0);
    }
  }

  // ---------- UI helpers ----------
  _syncHUD(){
    if (this.hudMoney) this.hudMoney.textContent = `$${this.money.toFixed(2)}`;
    if (this.hudScore) this.hudScore.textContent = `$${this.score.toFixed(0)}`;
  }
  _toast(msg){
    if (!this.toastEl) return;
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(()=> this.toastEl.classList.remove('show'), 1300);
  }
  _refreshAssetList(){
    if (!this.assetListEl) return;
    const arr = Array.from(AssetMonitor.loaded).slice(-10);
    this.assetListEl.innerHTML = arr.map(u=>`<li>${u.replace(location.origin,'').replace(/^\//,'')}</li>`).join('');
  }

  // ---------- Gameplay ----------
  addScore(v){ this.score += v; this._syncHUD(); }

  _spawnBallAt(x,y,z=0){
    const ball = makeBall(new THREE.Vector3(x,y,z));
    ball.vel.x += (Math.random()-0.5)*4;
    ball._hitCooldown = 0;
    ball._age = 0;
    ball._maxAge = 20;
    ball._scoredAt = -1;

    this.scene.add(ball.mesh);
    ball._trail = EFFECTS.trail(this.fx, ball.mesh.position.clone(), 0.9);
    this._ballTrails.set(ball, ball._trail);
    this.balls.push(ball);
    return ball;
  }

  spawnBall(){
    if (this.money < this.ballCost){ this._toast('Not enough money'); return; }
    this.money = Math.max(0, this.money - this.ballCost);
    this._syncHUD();
    this._spawnBallAt(0, 22, 0);
  }

  spawnRandomAmarion(){
    const types = ['red','blue','gold','shadow'];
    const t = types[Math.floor(Math.random()*types.length)];
    this.bonus.spawn(t);    // spawns at top, falls with HP; see file
  }

  _onPegHit(ball){
    if (ball._hitCooldown > 0) return;
    const pos = ball.mesh.position.clone();
    EFFECTS.impactSmall(this.fx, pos, 0.9);
    EFFECTS.sparks(this.fx, pos, 0.8);
    ball._hitCooldown = 0.06;
  }

  _onScored(ball, bucketIndex){
    const segW = (this.bounds.right - this.bounds.left) / 8;
    const x = this.bounds.left + (bucketIndex + 0.5) * segW;
    const pos = new THREE.Vector3(x, this.bounds.bottom + 1.0, 0);

    EFFECTS.shockwave(this.fx, pos, 1.3);
    EFFECTS.ripple(this.fx, pos, 1.1);
    EFFECTS.ringPulse(this.fx, pos, 1.0);
    if (Math.random() < 0.25) EFFECTS.powerOrb(this.fx, pos, 0.8);

    const trail = this._ballTrails.get(ball);
    if (trail) { trail.finish(); this._ballTrails.delete(ball); }

    ball._scoredAt = performance.now()/1000;
  }

  _clearBalls(){
    this.balls.forEach(b=>{
      const t = this._ballTrails.get(b); if (t) t.finish();
      if (b.mesh && b.mesh.parent) this.scene.remove(b.mesh);
    });
    this._ballTrails.clear();
    this.balls.length = 0;
  }

  // ---------- Sensors ----------
  _initGyro(){
    this._gyro = { alpha:0, beta:0, gamma:0 };
    if ('DeviceOrientationEvent' in window){
      window.addEventListener('deviceorientation', (e) => {
        this._gyro.alpha = e.alpha||0; // yaw
        this._gyro.beta  = e.beta||0;  // pitch
        this._gyro.gamma = e.gamma||0; // roll
      }, { passive:true });
    }
  }

  // ---------- Main update ----------
  update(dt){
    // Camera rig update (free)
    if (this._camMode === 'free'){
      const d = this._free.dist;
      const yaw = this._free.yaw, pitch = this._free.pitch;
      const cx = Math.cos(yaw)*Math.cos(pitch)*d;
      const cy = Math.sin(-pitch)*d*0.9 + 10;
      const cz = Math.sin(yaw)*Math.cos(pitch)*d;
      this.camera.position.set(cx, cy, cz);
      this.camera.lookAt(0, 0, 0);
    }

    // Plugins & FX
    this.bonus.update(dt);
    this.fx.update(dt);
    this.objects.forEach(o=>o.update?.(dt));

    // Physics
    const g = -32;
    const segW = (this.bounds.right - this.bounds.left) / 8;
    const multipliers = [0,0.5,3.5,2.5,2.5,3.5,0.5,0];
    const base = 100;

    for (const b of this.balls){
      b._age += dt;
      if (b._hitCooldown > 0) b._hitCooldown -= dt;

      b.vel.y += g*dt;
      b.pos.addScaledVector(b.vel, dt);

      // Peg collisions
      for (const peg of this.board.pegs){
        const delta = b.pos.clone().sub(peg.position);
        const dist = delta.length();
        const min  = peg.radius + b.radius;
        if (dist < min){
          const n = delta.normalize();
          const vn = b.vel.dot(n);
          b.vel.addScaledVector(n, -1.9*vn);
          b.vel.multiplyScalar(0.986);
          b.pos.addScaledVector(n, (min - dist) + 0.001);
          this._onPegHit(b);
        }
      }

      // Boundaries
      if (b.pos.x < this.bounds.left + b.radius){
        b.pos.x = this.bounds.left + b.radius; b.vel.x *= -0.82; this._onPegHit(b);
      }
      if (b.pos.x > this.bounds.right - b.radius){
        b.pos.x = this.bounds.right - b.radius; b.vel.x *= -0.82; this._onPegHit(b);
      }
      if (b.pos.y < this.bounds.bottom + b.radius){
        b.pos.y = this.bounds.bottom + b.radius; b.vel.y *= -0.42;
      }

      // Scoring
      if (!b.scored && b.pos.y < -20){
        const idx = Math.max(0, Math.min(7, Math.floor((b.pos.x - this.bounds.left)/segW)));
        const prize = Math.max(0, base * multipliers[idx]);
        if (prize > 0) this.addScore(prize);
        b.scored = true;
        this._onScored(b, idx);
      }

      // Gameplay forces
      this.magnet.affect(b, dt);
      this.shield.affect(b, dt);
      this.orb.affect(b, dt);

      // Visuals
      b.mesh.position.copy(b.pos);
      const trail = this._ballTrails.get(b);
      if (trail) trail.setPosition(b.pos.x, b.pos.y, b.pos.z);
    }

    // Cleanup
    const now = performance.now()/1000;
    this.balls = this.balls.filter(b=>{
      const tooOld = b._age > b._maxAge;
      const tooLow = b.pos.y < (this.bounds.bottom - 4);
      const scoredDone = (b._scoredAt > 0) && (now - b._scoredAt > 0.45);
      const remove = tooOld || tooLow || scoredDone;
      if (remove){
        const t = this._ballTrails.get(b); if (t) t.finish();
        this._ballTrails.delete(b);
        if (b.mesh && b.mesh.parent) this.scene.remove(b.mesh);
      }
      return !remove;
    });

    // Debug HUD (Smart Compass)
    if (this.debugEl){
      const p = this.camera.position;
      const r = this.camera.rotation;
      const yaw   = (r.y*180/Math.PI)|0;
      const pitch = (r.x*180/Math.PI)|0;
      const roll  = (r.z*180/Math.PI)|0;
      const g = this._gyro;
      this.debugEl.textContent =
        `Balls: ${this.balls.length} | Amarions: ${this.bonus.items.length} | FX: ${this.fx.effects.size}\n` +
        `Cam: (${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}) ` +
        `Yaw:${yaw}° Pitch:${pitch}° Roll:${roll}°\n` +
        `Smart Compass → Forward = +Z toward player\n` +
        `Gyro: α:${g.alpha.toFixed(0)} β:${g.beta.toFixed(0)} γ:${g.gamma.toFixed(0)}`;
    }
  }
}

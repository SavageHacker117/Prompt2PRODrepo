import * as THREE from 'three';

export class Boxer {
  constructor({ name='Boxer', isPlayer=false, color=0x55aaff }) {
    this.name = name; this.isPlayer = isPlayer;

    this.root = new THREE.Group();
    this.root.position.set(isPlayer ? -1.7 : 1.7, 1.22, isPlayer ? 0.8 : -0.8);

    const mat = new THREE.MeshStandardMaterial({ color, roughness:.6, metalness:.05 });

    // Body
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.9, 6, 12), mat);
    body.castShadow = true; body.position.y = 1.0;

    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 16), mat);
    head.position.y = 1.84; head.castShadow = true;

    // Legs (visual only)
    const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.8, 12), mat);
    const legR = legL.clone();
    legL.position.set(-0.16, 0.4, 0); legR.position.set(0.16, 0.4, 0);
    legL.castShadow = legR.castShadow = true;

    // ======= Arm rigs (upper arm + forearm + glove) =======
    const mkArm = (side)=> {
      const sgn = side==='L' ? -1 : +1; // left is negative x
      const shoulder = new THREE.Group();
      shoulder.position.set(0.35*sgn, 1.28, 0.05);

      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.36, 12), mat);
      upper.castShadow = true;
      // pivot at shoulder top -> move mesh down by half
      upper.position.y = -0.18;

      const elbow = new THREE.Group();
      elbow.position.y = -0.36; // end of upper arm

      const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.34, 12), mat);
      fore.castShadow = true;
      fore.position.y = -0.17;

      const glove = new THREE.Mesh(
        new THREE.SphereGeometry(0.16,16,16),
        new THREE.MeshStandardMaterial({ color: 0xff4444, roughness:.35, metalness: .1, emissive: 0x000000 })
      );
      glove.castShadow = true;
      glove.position.set(0, -0.34, 0.10); // small forward offset

      shoulder.add(upper, elbow);
      elbow.add(fore, glove);
      return { shoulder, elbow, upper, fore, glove };
    };

    const L = mkArm('L');
    const R = mkArm('R');

    this.root.add(body, head, legL, legR, L.shoulder, R.shoulder);

    // public parts
    this.parts = {
      body, head, legL, legR,
      // convenience handles:
      armL: L.shoulder, armR: R.shoulder,
      elbowL: L.elbow, elbowR: R.elbow,
      upperL: L.upper, upperR: R.upper,
      foreL: L.fore, foreR: R.fore,
      gloveL: L.glove, gloveR: R.glove,
    };

    this.vel = new THREE.Vector2();
    this.stance = isPlayer ? 1 : -1;
    this.anim = { punchL:0, punchR:0, block:0, weave:0 };
    this.health = 100;
    this.stamina = 100;
    this.radius = 0.55;
    this.xp = 0;

    // Hit/impact rag wobble
    this.hurt = { t:0, wobble:0 };

    // Blocking timers
    this.blockState = { active:false, t:0, cooldown:0 };

    // temp vecs
    this._tmp = { a:new THREE.Vector3(), b:new THREE.Vector3() };
  }

  controls({ forward, back, left, right, jab, cross, block, weave }) {
    this.vel.set(0,0);
    const f = 1.0;
    if (forward) this.vel.y += f;
    if (back)    this.vel.y -= f*0.7;
    if (left)    this.vel.x -= f;
    if (right)   this.vel.x += f;

    if (jab)   this.punch('L');
    if (cross) this.punch('R');

    this.anim.block = block ? 1 : 0;
    this.anim.weave = weave ? 1 : 0;
  }

  // world helpers
  getFistWorldPos(which){
    const t = which==='L' ? this.parts.gloveL : this.parts.gloveR;
    return t.getWorldPosition(new THREE.Vector3());
  }
  // Use body world position so torso capsule tracks correctly
  getChestWorldPos(){ return this.parts.body.getWorldPosition(new THREE.Vector3()); }
  getHeadWorldPos(){ return this.parts.head.getWorldPosition(new THREE.Vector3()); }

  // Only torso + head are hittable; gloves are hitters
  getHitVolumes(){
    const A = this._tmp.a, B = this._tmp.b;
    const chest = this.getChestWorldPos();

    // taller & wider torso capsule for clear contacts
    A.set(chest.x, chest.y + 0.65, chest.z);   // top
    B.set(chest.x, chest.y - 0.45, chest.z);   // bottom
    const rTorso = 0.44;

    return {
      torso: { type:'capsule', a:A.clone(), b:B.clone(), r:rTorso },
      head:  { type:'sphere',  p:this.getHeadWorldPos(), r:0.28 },
      fistL: { type:'sphere',  p:this.getFistWorldPos('L'), r:0.19 },
      fistR: { type:'sphere',  p:this.getFistWorldPos('R'), r:0.19 },
    };
  }

  punch(side='L') {
    if (side==='L') this.anim.punchL = 1.0; else this.anim.punchR = 1.0;
    this.stamina = Math.max(0, this.stamina - 3.5);
  }

  wasHit(power=8) {
    if (this.isBlockingActive()) return;
    this.health = Math.max(0, this.health - power);
    // reactive wobble + tiny knock
    this.hurt.t = 0.25 + Math.min(0.35, power*0.03);
    this.hurt.wobble = 1.0;
    this.root.position.z += 0.06 * (Math.random() > 0.5 ? 1 : -1);
  }

  isBlockingActive(){
    return this.blockState.active && this.blockState.cooldown <= 0;
  }

  update(dt) {
    this.stamina = Math.min(100, this.stamina + dt*6);

    // movement
    const speed = 1.8;
    this.root.position.x += this.vel.x * speed * dt;
    this.root.position.z += this.vel.y * speed * dt;
    const clamp = 5.2;
    this.root.position.x = Math.max(-clamp, Math.min(clamp, this.root.position.x));
    this.root.position.z = Math.max(-clamp, Math.min(clamp, this.root.position.z));

    // idle bob
    const t = performance.now()*0.001;
    const bob = Math.sin(t*3.2)*0.018;
    this.parts.head.position.y = 1.84 + bob;

    // ----- BLOCK WINDOW (<=5s) + 2s COOLDOWN -----
    const bs = this.blockState;
    bs.cooldown = Math.max(0, bs.cooldown - dt);
    if (this.anim.block > 0 && bs.cooldown <= 0) {
      bs.active = true; bs.t += dt;
      if (bs.t >= 5.0) { bs.active = false; bs.t = 0; bs.cooldown = 2.0; }
    } else {
      if (bs.active && bs.t>0) bs.cooldown = 2.0;
      bs.active = false; bs.t = 0;
    }

    // block visual guard
    const guard = this.anim.block ? 1 : 0;
    const setGuard = (shoulder, elbow, sgn)=>{
      shoulder.rotation.z = (sgn>0? +0.6 : -0.6) * guard;
      elbow.rotation.x = 0.15 * guard;
    };
    setGuard(this.parts.armL, this.parts.elbowL, -1);
    setGuard(this.parts.armR, this.parts.elbowR, +1);

    // weave lowers head a bit
    this.parts.head.position.y -= 0.12 * this.anim.weave;

    // === Punch animation (exaggerated jab with elbow extension) ===
    const decay = (v)=> Math.max(0, v - dt*3.4);
    this.anim.punchL = decay(this.anim.punchL);
    this.anim.punchR = decay(this.anim.punchR);

    const easeOutCubic = (x)=> 1 - Math.pow(1-x, 3);

    const driveArm = (side, punchV)=>{
      const ext = easeOutCubic(1 - punchV); // 0..1 (extended)
      const sh  = side==='L' ? this.parts.armL : this.parts.armR;
      const el  = side==='L' ? this.parts.elbowL : this.parts.elbowR;
      const gl  = side==='L' ? this.parts.gloveL : this.parts.gloveR;

      // swing shoulder a bit forward and rotate elbow to extend
      sh.rotation.x = 0.35*ext;
      el.rotation.x = -1.25*ext;

      // exaggerated forward reach
      gl.position.z = 0.10 + 0.42*ext + 0.12*guard;
    };

    driveArm('L', this.anim.punchL);
    driveArm('R', this.anim.punchR);

    // ===== impact wobble =====
    if (this.hurt.t > 0) {
      this.hurt.t = Math.max(0, this.hurt.t - dt);
      const k = this.hurt.t * this.hurt.wobble;
      this.parts.body.rotation.z = Math.sin(t*18) * 0.05 * k;
      this.parts.head.rotation.z = Math.sin(t*22) * 0.08 * k;
    } else {
      this.parts.body.rotation.z = THREE.MathUtils.damp(this.parts.body.rotation.z, 0, 8, dt);
      this.parts.head.rotation.z = THREE.MathUtils.damp(this.parts.head.rotation.z, 0, 8, dt);
    }
  }
}

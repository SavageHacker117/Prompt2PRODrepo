// prefabs/Player.js
import * as THREE from 'three';
import { ParticleBurst } from '../core/ParticleBurst.js';

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.position.set(0, 1.2, 0);
    this.group.castShadow = true;
    this.scene.add(this.group);

    // movement & physics
    this.baseSpeedX = 0.0; // idle by default
    this.velocity = new THREE.Vector3(this.baseSpeedX, 0, 0);
    this.onGround = true;
    this.jumpCooldown = 0;
    this._jumping = false; // used to gate jump animation

    // bounds
    this.bounds = new THREE.Box3();
    this._aabbSize = new THREE.Vector3(0.6, 1.8, 0.6);
    this.position = this.group.position;

    // model/animation
    this.mixer = null;
    this.actions = {};
    this._currentAction = null;
    this.model = null;
    this.clips = []; // keep a reference to loaded clips (useful for editors/tools)

    // particles
    const loader = new THREE.TextureLoader();
    this.particleTex = loader.load('./assets/textures/particle.png');
    this.particles = new ParticleBurst(this.scene, this.particleTex);
    this.activeBursts = new Set();
  }

  async ensureLoaded(gltfLoader) {
    if (this.model) return;
    const tryLoad = async (p) => {
      try { return await gltfLoader.loadAsync(p); } catch { return null; }
    };
    let gltf = await tryLoad('./assets/models/rose.glb');
    if (!gltf) gltf = await tryLoad('./assets/models/humanoid.glb');

    if (gltf && gltf.scene) {
      this.model = gltf.scene;
      this.model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      this.model.scale.setScalar(1.0);
      this.model.rotation.y = -Math.PI * 0.5; // face +X; flip sign if needed
      this.group.add(this.model);

      const clips = gltf.animations || [];
      this.clips = clips;

      if (clips.length) {
        this.mixer = new THREE.AnimationMixer(this.model);
        const find = (needle, fallback) => {
          const lc = needle.toLowerCase();
          return clips.find(c => c.name.toLowerCase().includes(lc)) || fallback || null;
        };

        const idle = find('idle', clips[0]);
        const walk = find('walk');
        const run  = find('run', walk || idle);
        const jump = find('jump');

        if (idle) this.actions.idle = this.mixer.clipAction(idle);
        if (walk) this.actions.walk = this.mixer.clipAction(walk);
        if (run)  this.actions.run  = this.mixer.clipAction(run);
        if (jump) {
          this.actions.jump = this.mixer.clipAction(jump);
          this.actions.jump.setLoop(THREE.LoopOnce, 1);
          this.actions.jump.clampWhenFinished = false;
          this.actions.jump.enabled = true;
        }

        // enable all actions
        Object.values(this.actions).forEach(a => { if (a) a.enabled = true; });

        // start in idle when available
        if (this.actions.idle) this._play(this.actions.idle, 0);
        else if (this.actions.run) this._play(this.actions.run, 0);
      }
    } else {
      // simple fallback figure
      const body = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: 0x90cdf4, roughness: 0.5, metalness: 0.1 });
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 24, 24), mat); head.position.y = 1.0;
      const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.8, 8, 16), mat); torso.position.y = 0.3;
      body.add(head, torso);
      body.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      this.model = body;
      this.group.add(body);
    }
  }

  reset(start) {
    this.group.position.set(start.x, start.y, start.z);
    this.velocity.set(this.baseSpeedX, 0, 0);
    this.onGround = true;
    this._jumping = false;
    this.jumpCooldown = 0;
  }

  // Utility: shape analog with deadzone and soft curve
  _shapeAnalog(v, dz = 0.18) {
    const s = Math.sign(v);
    const a = Math.abs(v);
    if (a < dz) return 0;
    const t = (a - dz) / (1 - dz);       // 0..1
    const curved = t * t;                // ease-in
    return s * Math.min(1, Math.max(0, curved));
  }

  update(dt, input) {
    if (this.mixer) this.mixer.update(dt);

    // ---------- STRAFE on Z (left/right) ----------
    // Digital intent
    const digZ = (input.left ? -1 : 0) + (input.right ? 1 : 0);
    // Analog intent from stick (Input.applyGamepad should set analogZ)
    const anaZ = this._shapeAnalog(input.analogZ || 0);
    // Prefer the stronger of digital vs analog
    const strafeIntent = Math.abs(anaZ) > Math.abs(digZ) ? anaZ : digZ;
    const strafeSpeed = 6.5; // units/sec
    this.position.z += strafeIntent * strafeSpeed * dt;
    this.position.z = Math.max(-6, Math.min(6, this.position.z));

    // ---------- FORWARD/BACK on X (up/down) ----------
    // Digital intent: up = forward (1), down = back (-1 * backScale)
    let forwardIntent = 0;
    if (input.up)   forwardIntent = Math.max(forwardIntent, 1);
    if (input.down) forwardIntent = Math.min(forwardIntent, -0.6); // keep your -3 back cap

    // Analog intent overrides if stronger
    const anaF = this._shapeAnalog(input.analogForward || 0);
    if (Math.abs(anaF) > Math.abs(forwardIntent)) forwardIntent = anaF;

    // Map intent (-1..1) to your speed range (-3..+9)
    const maxFwd = 9;
    const maxBack = -3;
    const speedTarget = forwardIntent >= 0
      ? forwardIntent * maxFwd
      : (-forwardIntent) * maxBack; // forwardIntent negative → moves toward -3

    // Smooth accel toward target
    const accel = 1 - Math.pow(0.001, dt);
    this.velocity.x += (speedTarget - this.velocity.x) * accel;
    this.velocity.x = Math.max(-3, Math.min(this.velocity.x, 9));
    this.position.x += this.velocity.x * dt;

    // ---------- JUMP ----------
    this.jumpCooldown -= dt;
    if (input.jump && this.onGround && this.jumpCooldown <= 0) {
      this.velocity.y = 6.8;
      this.onGround = false;
      this._jumping = true;
      this.jumpCooldown = 0.2;

      if (this.actions.jump) {
        this.actions.jump.reset();
        this._play(this.actions.jump, 0.05);
      } else if (this.actions.run) {
        this.actions.run.fadeOut(0.1);
      }

      this.activeBursts.add(
        this.particles.spawn(
          this.position.clone().add(new THREE.Vector3(0, -0.9, 0)),
          0x88e0ff,
          20
        )
      );
    }

    // ---------- gravity + ground clamp ----------
    this.velocity.y -= 20 * dt;
    this.position.y += this.velocity.y * dt;
    if (this.position.y <= 1.2) {
      if (!this.onGround) {
        this.activeBursts.add(
          this.particles.spawn(
            this.position.clone().add(new THREE.Vector3(0, -0.9, 0)),
            0x9bf6a9,
            28
          )
        );
      }
      this.position.y = 1.2;
      this.velocity.y = 0;
      this.onGround = true;
      this._jumping = false;
    }

    // ---------- locomotion animation ----------
    this._updateLocomotion();

    // ---------- particle lifecycle ----------
    for (const b of this.activeBursts) {
      if (b.parent && b.userData && typeof b.userData.update === 'function') b.userData.update(dt);
      else this.activeBursts.delete(b);
    }

    // ---------- update AABB ----------
    this.bounds.setFromCenterAndSize(
      new THREE.Vector3(this.position.x, this.position.y + 0.9, this.position.z),
      this._aabbSize
    );
  }

  _updateLocomotion() {
    if (!this.mixer || this._jumping) return;
    const speed = Math.abs(this.velocity.x);

    let next = null;
    if (speed > 3.2 && this.actions.run) next = this.actions.run;
    else if (speed > 0.2 && this.actions.walk) next = this.actions.walk;
    else next = this.actions.idle || this.actions.walk || this.actions.run || null;

    if (next) this._play(next, 0.15);
  }

  _play(action, fade = 0.15) {
    if (this._currentAction === action) return;
    const prev = this._currentAction;
    if (prev) prev.crossFadeTo(action, fade, false);
    action.enabled = true;
    action.play();
    this._currentAction = action;
  }

  resolveBlockCollision(block) {
    const b = block.bounds;
    if (this.bounds.intersectsBox(b)) {
      this.position.x = Math.min(this.position.x, b.min.x - this._aabbSize.x * 0.5);
      this.velocity.x = 0;
    }
  }
}

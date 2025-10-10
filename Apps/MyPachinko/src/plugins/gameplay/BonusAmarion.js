// src/plugins/gameplay/BonusAmarion.js
import * as THREE from 'three';

export class BonusAmarion {
  constructor(scene){
    this.scene = scene;
    this.items = [];
  }

  spawn(type='red'){
    const colors = { red:0xff4d6d, blue:0x5dd3ff, gold:0xffd166, shadow:0x8892b0 };
    const mat = new THREE.MeshStandardMaterial({
      color: colors[type]||0xffffff,
      emissive: 0x121212,
      metalness: 0.85,
      roughness: 0.25
    });
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1.25,1), mat);

    // TOP spawn across board width
    const b = this.scene.bounds, m = 3.0;
    mesh.position.set(
      THREE.MathUtils.randFloat(b.left+m, b.right-m),
      b.top - 1.2,
      0
    );

    const item = {
      mesh,
      type,
      vel: new THREE.Vector3((Math.random()-0.5)*3.2, -2.0, 0),
      radius: 1.25,
      hp: type==='gold' ? 5 : 3,
      cooldown: 0
    };

    this.scene.scene.add(mesh);
    this.items.push(item);
  }

  update(dt){
    if (!this.items.length) return;

    const g = -22;
    const { pegs } = this.scene.board;
    const bd = this.scene.bounds;

    for (const it of this.items){
      // lifetime dynamics
      if (it.cooldown > 0) it.cooldown -= dt;

      it.vel.y += g * dt;
      it.mesh.position.addScaledVector(it.vel, dt);

      // peg collisions (simple sphere–cylinder approx)
      for (const peg of pegs){
        const delta = it.mesh.position.clone().sub(peg.position);
        const dist = delta.length();
        const min  = (peg.radius||0.78) + it.radius;
        if (dist < min){
          const n = delta.normalize();
          const vn = it.vel.dot(n);
          it.vel.addScaledVector(n, -1.6*vn);
          it.vel.multiplyScalar(0.985);
          it.mesh.position.addScaledVector(n, (min - dist) + 0.002);
        }
      }

      // walls
      if (it.mesh.position.x < bd.left + it.radius){
        it.mesh.position.x = bd.left + it.radius; it.vel.x *= -0.85;
      }
      if (it.mesh.position.x > bd.right - it.radius){
        it.mesh.position.x = bd.right - it.radius; it.vel.x *= -0.85;
      }
      if (it.mesh.position.y < bd.bottom + it.radius){
        it.mesh.position.y = bd.bottom + it.radius; it.vel.y *= -0.45;
      }

      // interact with balls (impact + damage)
      for (const b of this.scene.balls){
        const d = it.mesh.position.distanceTo(b.pos);
        if (d < (it.radius + b.radius)){
          // push both ways
          const n = b.pos.clone().sub(it.mesh.position).normalize();
          const rel = b.vel.dot(n);
          b.vel.addScaledVector(n, Math.max(6, 10 - rel));
          it.vel.addScaledVector(n, -4);

          if (it.cooldown <= 0){
            it.hp -= 1;
            it.cooldown = 0.08;
            // small hit FX on amarion
            const p = it.mesh.position.clone();
            this.scene._onPegHit(b, {position:p});
          }
        }
      }
    }

    // destroy & reward
    this.items = this.items.filter(it => {
      if (it.hp <= 0){
        const p = it.mesh.position.clone();
        this.scene.addScore(250);
        // celebratory FX
        this.scene.fx.clear?.(); // optional burst sync
        this.scene.engine && void 0;
        // pop
        this.scene.scene.remove(it.mesh);
        // bonus: spawn a couple extra balls sometimes
        if (Math.random() < 0.4){
          for (let i=0;i<2;i++){
            const nb = this.scene._spawnBallAt(p.x + (Math.random()-0.5)*0.6, p.y+0.4, 0);
            if (nb){ nb.vel.x += (Math.random()-0.5)*6; nb.vel.y += 6+Math.random()*4; }
          }
        }
        return false;
      }
      // cull way below
      if (it.mesh.position.y < this.scene.bounds.bottom - 6){
        this.scene.scene.remove(it.mesh);
        return false;
      }
      return true;
    });
  }
}

// src/plugins/gameplay/Popups.js
import * as THREE from 'three';
import { EFFECTS } from '../../game/effects.js';

export class PopupManager {
  constructor(scene){
    this.scene = scene;
    this.items = new Set();
  }

  spawn(type='bonus', pos = new THREE.Vector3(0,10,0)){
    const sprite = EFFECTS.powerOrb(this.scene.fx, pos.clone(), 1.0); // looping orb
    const it = { type, sprite, pos: pos.clone(), t: 0, radius: 1.4, dead:false };
    this.items.add(it);
    return it;
  }

  update(dt){
    for (const it of Array.from(this.items)){
      it.t += dt;
      // bob up/down
      const bob = Math.sin(it.t*3.2)*0.2;
      it.sprite.setPosition(it.pos.x, it.pos.y + bob, it.pos.z);

      // collect check
      for (const b of this.scene.balls){
        if (b.pos.distanceTo(it.pos) < (b.radius + it.radius)){
          this._apply(it, b);
          it.dead = true;
          break;
        }
      }

      if (it.dead){
        it.sprite.finish();
        this.items.delete(it);
      }
    }
  }

  _apply(it, ball){
    const p = it.pos.clone();
    if (it.type === 'bonus'){
      this.scene.addScore(200);
      EFFECTS.shockwave(this.scene.fx, p, 1.4);
      EFFECTS.ringPulse(this.scene.fx, p, 1.2);
    } else if (it.type === 'multiball'){
      // spawn two new balls at pickup
      for (let i=0; i<2; i++){
        const nb = this.scene._spawnBallAt(p.x + (Math.random()-0.5)*0.6, p.y + 0.3, 0);
        nb.vel.x += (Math.random()-0.5)*6;
        nb.vel.y += 4 + Math.random()*4;
      }
      EFFECTS.ripple(this.scene.fx, p, 1.3);
    }
  }
}

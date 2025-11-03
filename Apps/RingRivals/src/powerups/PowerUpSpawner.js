import * as THREE from 'three';
import { PowerUp } from './PowerUp.js';

export class PowerUpSpawner {
  constructor(scene){
    this.scene = scene;
    this.items = [];
    this.cool = 0;
    this.bounds = 5.2; // inside ropes
  }
  spawnRandom(){
    const types = ['SPEED','DAMAGE','GUARD','STAM'];
    const t = types[Math.floor(Math.random()*types.length)];
    const pos = new THREE.Vector3(
      (Math.random()*2-1)*this.bounds,
      1.3,
      (Math.random()*2-1)*this.bounds
    );
    const p = new PowerUp(t, pos); p.addTo(this.scene); this.items.push(p);
  }
  update(dt, player, cpu, onPickup){
    this.cool -= dt;
    if (this.cool <= 0 && this.items.length < 3){ this.spawnRandom(); this.cool = 8 + Math.random()*5; }
    this.items.forEach(i=>i.update(dt));

    const tryGrab = (who)=>{
      for (let k=0;k<this.items.length;k++){
        const it = this.items[k];
        if (it.mesh.position.distanceTo(who.root.position) < 0.8){
          onPickup?.(who, it.type, it.mesh.position);
          it.dispose(this.scene); this.items.splice(k,1); return;
        }
      }
    };
    tryGrab(player); tryGrab(cpu);
  }
}

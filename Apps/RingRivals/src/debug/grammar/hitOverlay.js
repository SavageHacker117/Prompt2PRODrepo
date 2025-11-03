import * as THREE from 'three';

export class HitOverlay {
  constructor({ scene, player, cpu }) {
    this.scene = scene; this.player = player; this.cpu = cpu;
    this.on = false;

    const mk = (c,r=0.55)=> new THREE.Mesh(
      new THREE.SphereGeometry(r, 16, 12),
      new THREE.MeshBasicMaterial({ color:c, wireframe:true, transparent:true, opacity:.7 })
    );
    this.pChest = mk(0x66ccff);
    this.oChest = mk(0xff8888);
    this.pLFist = mk(0x66ccff, 0.18);
    this.pRFist = mk(0x66ccff, 0.18);
    this.oLFist = mk(0xff8888, 0.18);
    this.oRFist = mk(0xff8888, 0.18);

    this.group = new THREE.Group();
    this.group.add(this.pChest,this.oChest,this.pLFist,this.pRFist,this.oLFist,this.oRFist);
  }
  enable(){ if (this.on) return; this.on=true; this.scene.add(this.group); }
  disable(){ if (!this.on) return; this.on=false; this.scene.remove(this.group); }
  toggle(){ this.on?this.disable():this.enable(); }
  update(){
    if (!this.on) return;
    this.pChest.position.copy(this.player.getChestWorldPos());
    this.oChest.position.copy(this.cpu.getChestWorldPos());
    this.pLFist.position.copy(this.player.getFistWorldPos('L'));
    this.pRFist.position.copy(this.player.getFistWorldPos('R'));
    this.oLFist.position.copy(this.cpu.getFistWorldPos('L'));
    this.oRFist.position.copy(this.cpu.getFistWorldPos('R'));
  }
}

import * as THREE from 'three';
export class ImpactFX {
  constructor(scene){
    this.scene = scene;
    const geo = new THREE.PlaneGeometry(0.35,0.35);
    const tex = new THREE.TextureLoader().load('/textures/flare.png'); // optional
    const mat = new THREE.MeshBasicMaterial({ map: tex ?? null, color: 0xffffff, transparent:true, depthWrite:false });
    this.pool = Array.from({length:24}, ()=>{ const m=new THREE.Mesh(geo,mat.clone()); m.visible=false; m.rotation.x=-Math.PI/2; scene.add(m); return m; });
    this.active = [];
  }
  spawn(pos, color=0xffffff){
    const m = this.pool.pop() ?? this.active.shift(); // recycle oldest
    m.position.copy(pos); m.material.color.setHex(color);
    m.material.opacity=1; m.scale.set(0.3,0.3,0.3); m.visible=true;
    this.active.push({m,t:0});
  }
  update(dt, camera){
    for (const o of this.active){
      o.t += dt;
      o.m.lookAt(camera.position);
      o.m.scale.multiplyScalar(1+dt*8);
      o.m.material.opacity = Math.max(0, 1 - o.t*3);
    }
    // return dead to pool
    this.active = this.active.filter(o=>{
      if (o.m.material.opacity<=0.02){ o.m.visible=false; this.pool.push(o.m); return false; }
      return true;
    });
  }
}

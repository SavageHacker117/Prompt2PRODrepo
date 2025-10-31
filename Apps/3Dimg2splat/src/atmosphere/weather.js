import * as THREE from 'three';
let sys=null, current='clear';

export function initWeather(scene){
  sys = new THREE.Group(); scene.add(sys);
}

export function setWeather(kind='clear'){
  current = kind;
  [...sys.children].forEach(c=>c.removeFromParent());
  if (kind==='clear') return;

  const COUNT = kind==='snow'? 2000 : 1600;
  const geom = new THREE.BufferGeometry();
  const p = new Float32Array(COUNT*3);
  for(let i=0;i<COUNT;i++){
    p[i*3+0]=(Math.random()-0.5)*200;
    p[i*3+1]=Math.random()*80+30;
    p[i*3+2]=(Math.random()-0.5)*200;
  }
  geom.setAttribute('position', new THREE.BufferAttribute(p,3));
  const mat = new THREE.PointsMaterial({ size: kind==='snow'? 0.6:0.35, color: kind==='snow'?0xffffff:0x66aaff, transparent:true, opacity:0.8 });
  sys.add(new THREE.Points(geom,mat));
}

export function tickWeather(dt){
  if (current==='clear') return;
  const pts = sys.children[0]; if (!pts) return;
  const pos = pts.geometry.attributes.position;
  for (let i=0;i<pos.count;i++){
    pos.array[i*3+1] -= (current==='snow'? 8: 25) * dt;
    if (pos.array[i*3+1] < 0) pos.array[i*3+1] = Math.random()*80+60;
  }
  pos.needsUpdate = true;
}

import * as THREE from 'three';
let sun, hemi, clockMin = 12*60; // noon

export function initDayNight(scene){
  hemi = new THREE.HemisphereLight(0xaad1ff, 0x223344, 0.35);
  sun  = new THREE.DirectionalLight(0xffffff, 1.0);
  sun.position.set(50,100,0);
  scene.add(hemi, sun);
}

export function tickDayNight(dt){
  clockMin = (clockMin + dt*6) % (24*60); // ~6 min per real sec
  const t = clockMin/(24*60);
  const ang = (t*2*Math.PI) - Math.PI/2;
  sun.position.set(Math.cos(ang)*120, Math.sin(ang)*120, 0);
  const night = Math.max(0, 0.4 - Math.sin(ang)*0.4);
  hemi.intensity = 0.35 + 0.3*Math.sin(ang);
  sun.intensity  = 0.9 - night;
}

export function setClock(hhmm='12:00'){
  const [h,m]=hhmm.split(':').map(n=>parseInt(n,10)||0);
  clockMin = (h*60+m)%(24*60);
}

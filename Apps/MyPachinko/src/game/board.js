// src/game/board.js
import * as THREE from 'three';

export function createBoard(scene, opts = {}){
  const group = new THREE.Group();
  scene.add(group);
  const pegs = [];

  // Optional video inlay (double-sided). NOTE: currently unused by scene.
  if (opts.videoURL){
    const video = document.createElement('video');
    video.src = opts.videoURL;
    video.muted = true; video.loop = true; video.playsInline = true; video.autoplay = true;
    video.addEventListener('canplay', ()=> video.play().catch(()=>{}));
    const tex = new THREE.VideoTexture(video);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter;
    const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent:false, opacity:0.95 });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(50, 46), mat);
    plane.position.set(0, 0.5, -0.6);
    group.add(plane);
    group._video = { video, tex, plane };
  }

  const material = new THREE.MeshStandardMaterial({ color: 0x7aa2ff, metalness: 0.25, roughness: 0.35 });
  const geo = new THREE.CylinderGeometry(0.4,0.4,1.2,12);

  // Looser grid
  const rows = 11, cols = 13, spacingX = 3.9, spacingY = 3.45;
  for (let r=0; r<rows; r++){
    for (let c=0; c<cols; c++){
      const peg = new THREE.Mesh(geo, material);
      peg.position.set((c-(cols-1)/2)*spacingX + (r%2?spacingX*0.5:0), 16.8 - r*spacingY, 0);
      peg.castShadow = peg.receiveShadow = false;
      group.add(peg);
      peg.radius = 0.78;
      pegs.push(peg);
    }
  }

  // buckets
  const bucketGeo = new THREE.BoxGeometry((cols-1)*spacingX/8 - 0.6, 2, 1);
  const multipliers = [1,0.5,3.5,2.5,2.5,3.5,0.5,1];
  for (let i=0;i<8;i++){
    const mat = new THREE.MeshStandardMaterial({ color: i in {2:1,5:1} ? 0xffd44f : 0x334055, emissive: i in {2:1,5:1} ? 0x553300 : 0x000000 });
    const bucket = new THREE.Mesh(bucketGeo, mat);
    bucket.position.set(-24 + (i+0.5)*(48/8), -22, 0);
    group.add(bucket);
    const sprite = makeTextSprite(`${multipliers[i]}x`);
    sprite.position.set(bucket.position.x, -20.5, 0);
    group.add(sprite);
  }

  // frame
  const frame = new THREE.Mesh(new THREE.BoxGeometry(50, 1, 2), new THREE.MeshStandardMaterial({ color:0x262a38 }));
  frame.position.set(0, 24, 0); group.add(frame);
  const barL = frame.clone(); barL.rotation.z = Math.PI/2; barL.scale.set(1,1.05,1); barL.position.set(-25,2,0); group.add(barL);
  const barR = frame.clone(); barR.rotation.z = Math.PI/2; barR.scale.set(1,1.05,1); barR.position.set(25,2,0); group.add(barR);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(50, 1.2, 2), new THREE.MeshStandardMaterial({ color:0x1b1f2b }));
  floor.position.set(0, -24, 0); group.add(floor);

  return { group, pegs };
}

function makeTextSprite(text){
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0b0d12'; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = '#e6e9ff'; ctx.font = 'bold 64px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width/2, canvas.height/2);
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
  const spr = new THREE.Sprite(mat);
  spr.scale.set(6,3,1);
  return spr;
}

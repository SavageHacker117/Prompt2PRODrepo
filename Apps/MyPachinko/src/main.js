// src/main.js
import * as THREE from 'three';
import { GameEngine } from './game/GameEngine.js';
import { PachinkoScene } from './scenes/PachinkoScene.js';
import { CameraRig } from './game/CameraRig.js';

const app = document.getElementById('app');

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
// ensure UI stays clickable
renderer.domElement.style.position = 'fixed';
renderer.domElement.style.inset = '0';
renderer.domElement.style.zIndex = '1';
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0d12);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, 32, 56);
camera.lookAt(0, 0, 0);

// Lights
const hemi = new THREE.HemisphereLight(0x8899aa, 0x111122, 0.9);
scene.add(hemi);
const dir = new THREE.DirectionalLight(0xffffff, 0.8);
dir.position.set(20, 40, 20);
scene.add(dir);

// Engine + scene
const engine = new GameEngine({ renderer, scene, camera });
const game = new PachinkoScene(engine);
if (typeof engine.setScene === 'function') engine.setScene(game);

// Camera Rig
const rig = new CameraRig(camera, renderer, { boardCenter: new THREE.Vector3(0, 0, 0), dist: 56 });
const cameraSelect = document.getElementById('camMode');
if (cameraSelect) cameraSelect.onchange = () => rig.setMode(cameraSelect.value);
document.getElementById('btnFreeCam')?.addEventListener('click', () => {
  rig.setMode('free');
  if (cameraSelect) cameraSelect.value = 'free';
});

// Resize
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

// Stable loop (fixed microsteps for physics, smoothed render)
let last = performance.now();
let acc = 0;
const dtFixed = 1 / 120;
const maxSteps = 5;

function loop(t) {
  const dt = Math.min(0.05, (t - last) / 1000);
  last = t;
  acc += dt;
  let steps = 0;
  while (acc >= dtFixed && steps < maxSteps) {
    engine.update?.(dtFixed); // safe call
    acc -= dtFixed;
    steps++;
  }
  rig.update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// MP4 stability: guarantee clean loop without flash on some browsers
const vid = document.getElementById('bgVideo');
if (vid) {
  vid.addEventListener('ended', () => { vid.currentTime = 0.05; vid.play(); }, { passive: true });
  vid.play().catch(() => {/* ignored */});
}

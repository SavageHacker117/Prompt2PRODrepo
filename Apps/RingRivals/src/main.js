import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass }     from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

import { StateManager } from './core/StateManager.js';
import { RingScene } from './scene/RingScene.js';
import { CrowdManager } from './scene/CrowdManager.js';
import { ArenaAudio } from './audio/ArenaAudio.js';
import { CameraController } from './camera/CameraController.js';
import { Boxer } from './fighters/Boxer.js';
import { BoxerAI } from './fighters/BoxerAI.js';
import { FightLogic } from './fight/FightLogic.js';
import { UIManager } from './ui/UIManager.js';
import { PlayerID } from './ui/PlayerID.js';
import { Referee } from './fighters/Referee.js';

// hit detection
import { applyHitDetection } from './fight/hitmath.js';

// debug grammar tools
import { setupDebugConsole } from './debug/grammar/console.js';
import { CameraProbe } from './debug/grammar/debugCamera.js';
import { FDebug } from './debug/grammar/debugFighters.js';
import { SceneDebug } from './debug/grammar/debugScene.js';

const appEl = document.getElementById('app');

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.physicallyCorrectLights = true;

appEl.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0d16);
scene.fog = new THREE.Fog(0x0b0d16, 60, 140);

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 1800);
camera.position.set(-6.5, 6.2, 9.5);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.45, 0.85, 0.5);
bloom.enabled = true;
composer.addPass(bloom);

const clock = new THREE.Clock();

const state = new StateManager();
const ui = new UIManager();
const audio = new ArenaAudio(camera);
scene.add(audio.listener);

const ring = new RingScene({ scene, renderer });
const crowd = new CrowdManager({ scene, camera });

const player = new Boxer({ name: 'Player', isPlayer: true, color: 0x52a1ff });
const cpu    = new Boxer({ name: 'CPU', isPlayer: false, color: 0xff5a6d });
const cpuAI  = new BoxerAI({ boxer: cpu, opponent: player });
scene.add(player.root, cpu.root);

// POP HEADS UP MORE (initial tweak)
[player, cpu].forEach(b => { if (b.parts?.head) b.parts.head.position.y += 0.22; });

// referee
const ref = new Referee();
scene.add(ref.root);

/* sane initial positions & facing */
function placeFighters() {
  player.root.position.set(-2.0, 1.22, 0.0);
  cpu.root.position.set( 2.0, 1.22, 0.0);
  player.root.lookAt(cpu.root.position.x, 1.22, cpu.root.position.z);
  cpu.root.lookAt(player.root.position.x, 1.22, player.root.position.z);
}
placeFighters();

const camCtrl = new CameraController({ camera, ring, crowd });
camCtrl.lockTo(player);

const fight = new FightLogic({
  scene, player, opponent: cpu, opponentAI: cpuAI, ui, audio, ring, crowd, camera, state
});

// simple progress cache (localStorage-backed)
const progress = (() => {
  const key = 'rr_progress_v1';
  const init = { lvl:1, hits:0, kos:0, rounds:0 };
  const db = JSON.parse(localStorage.getItem(key) || '{}');
  const get = (name) => (db[name] ||= { ...init });
  const save = () => localStorage.setItem(key, JSON.stringify(db));
  return { get, save };
})();

// player ID cards
const pids = new PlayerID({ playerName: player.name, cpuName: cpu.name, progress });

ui.wireMenus({ start: () => fight.startBout(), pickArena: (a)=> ring.setArena(a) });

(async function init() {
  ring.build('stadium');
  crowd.spawnLayers();
  await audio.loadDefaultClips();
  ui.showIntro('Big Fight Night');
  camCtrl.crowdSweep();
})();

window.addEventListener('resize', ()=>{
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  bloom.setSize(innerWidth, innerHeight);
});

const replayTag = document.getElementById('replayTag');
let slowMo = 1.0;

/* ---------- HP bars ---------- */
const $ = id => document.getElementById(id);
const hpDom = {
  pBar: $('pBar'), oBar: $('oBar'),
  pFill: $('pFill'), oFill: $('oFill'),
  pLoss: $('pLoss'), oLoss: $('oLoss'),
  pShield: $('pShield'), oShield: $('oShield'),
  pLabel: $('pLabel'), oLabel: $('oLabel'),
};
const hpState = { p:{v:1,loss:1}, o:{v:1,loss:1} };
function updateHPBars(dt, hud) {
  hpDom.pLabel.textContent = (hud.pName||'PLAYER').toUpperCase();
  hpDom.oLabel.textContent = (hud.oName||'CPU').toUpperCase();
  hpState.p.v = Math.max(0, Math.min(1, hud.pHealth));
  hpState.o.v = Math.max(0, Math.min(1, hud.oHealth));
  hpDom.pFill.style.width = `${hpState.p.v*100}%`;
  hpDom.oFill.style.width = `${hpState.o.v*100}%`;
  const speed = 0.25; const shrink = (c,t)=> (c>t) ? Math.max(t, c-speed*dt) : t;
  hpState.p.loss = shrink(hpState.p.loss, hpState.p.v);
  hpState.o.loss = shrink(hpState.o.loss, hpState.o.v);
  hpDom.pLoss.style.width = `${hpState.p.loss*100}%`;
  hpDom.oLoss.style.width = `${hpState.o.loss*100}%`;
  hpDom.pShield.style.width = '0%'; hpDom.pShield.style.opacity = '0';
  hpDom.oShield.style.width = '0%'; hpDom.oShield.style.opacity = '0';
  hpDom.pBar.classList.toggle('low', hpState.p.v < 0.25);
  hpDom.oBar.classList.toggle('low', hpState.o.v < 0.25);
}

/* ---------- Hitbox overlay (wireframes) ---------- */
const overlay = {
  on:false, group:new THREE.Group(),
  toggle(){ this.set(!this.on); },
  set(v){ this.on = !!v; this.group.visible = this.on; },
  updateVolumes(atk, def){
    const setCapsule = (obj, cap) => {
      obj.position.copy(cap.a).add(cap.b).multiplyScalar(0.5);
      const up = new THREE.Vector3().subVectors(cap.b, cap.a);
      const len = Math.max(0.0001, up.length());
      obj.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), up.clone().normalize());
      // cylinder height is 2 with radius 1 in our primitive
      obj.scale.set(cap.r, len/2, cap.r);
    };
    setCapsule(this.nodes.pTorso, atk.torso); setCapsule(this.nodes.oTorso, def.torso);
    this.nodes.pHead.position.copy(atk.head.p); this.nodes.pHead.scale.setScalar(atk.head.r);
    this.nodes.oHead.position.copy(def.head.p); this.nodes.oHead.scale.setScalar(def.head.r);
    this.nodes.pL.position.copy(atk.fistL.p);  this.nodes.pR.position.copy(atk.fistR.p);
    this.nodes.oL.position.copy(def.fistL.p);  this.nodes.oR.position.copy(def.fistR.p);
  }
};
{
  const mkSphere = (c)=> new THREE.Mesh(new THREE.SphereGeometry(1,16,16), new THREE.MeshBasicMaterial({ color:c, wireframe:true, toneMapped:false }));
  const mkCapsule = (c)=>{
    const g = new THREE.Group();
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(1,1,2,12,1,true), new THREE.MeshBasicMaterial({ color:c, wireframe:true, toneMapped:false }));
    const a = new THREE.Mesh(new THREE.SphereGeometry(1,12,12), cyl.material);
    const b = a.clone(); a.position.y = 1; b.position.y = -1;
    g.add(cyl, a, b); return g;
  };
  overlay.nodes = {
    pTorso: mkCapsule(0x22aaff), oTorso: mkCapsule(0xff8844),
    pHead: mkSphere(0x22aaff),   oHead: mkSphere(0xff8844),
    pL: mkSphere(0x22aaff), pR: mkSphere(0x22aaff),
    oL: mkSphere(0xff8844), oR: mkSphere(0xff8844),
  };
  Object.values(overlay.nodes).forEach(n=> overlay.group.add(n));
  overlay.group.visible = false; scene.add(overlay.group);
}

/* ---------- Hit Lab lightweight panel ---------- */
const hitLab = (() => {
  const el = document.createElement('div');
  el.id = 'hitLab';
  el.style.cssText = 'position:fixed; right:18px; bottom:18px; width:260px; background:rgba(10,12,18,.88); color:#cde; font:12px/1.4 system-ui,Segoe UI,Arial; padding:10px 12px; border-radius:10px; box-shadow:0 8px 32px rgba(0,0,0,.4); display:none; z-index:10000';
  el.innerHTML = `
    <div style="font-weight:700; margin-bottom:6px">Hit Lab</div>
    <div id="hlLines" style="max-height:140px; overflow:auto; font-family:monospace;"></div>
    <div id="hlTotals" style="margin-top:6px; opacity:.85"></div>
  `;
  document.body.appendChild(el);

  const lines = el.querySelector('#hlLines');
  const totalsEl = el.querySelector('#hlTotals');
  const totals = { pHits:0, pBlocked:0, cpuHits:0, cpuBlocked:0 };

  function renderTotals() {
    totalsEl.innerHTML =
      `PLAYER: ${totals.pHits} hits, ${totals.pBlocked} blocked<br/>CPU: ${totals.cpuHits} hits, ${totals.cpuBlocked} blocked`;
  }
  renderTotals();

  return {
    show(v){ el.style.display = v ? 'block' : 'none'; },
    toggle(){ this.show(el.style.display==='none'); },
    clear(){ lines.innerHTML = ''; totals.pHits=totals.pBlocked=totals.cpuHits=totals.cpuBlocked=0; renderTotals(); },
    log(evt){
      const who = evt.aIsPlayer ? 'P' : 'C'; // attribution is explicit now
      const line = document.createElement('div');
      line.textContent = `${who} ${evt.side}→${evt.part} ${evt.blocked?'[BLOCK]':''}  aXP:${evt.aXP}  dHP:${evt.dHP}`;
      lines.appendChild(line);
      lines.scrollTop = lines.scrollHeight;

      if (who==='P') evt.blocked ? totals.pBlocked++ : totals.pHits++;
      else evt.blocked ? totals.cpuBlocked++ : totals.cpuHits++;
      renderTotals();
    }
  };
})();

/* ---------- simulation ---------- */
function separateFighters() {
  const a = player.root.position, b = cpu.root.position;
  const dx = a.x - b.x, dz = a.z - b.z;
  const dist = Math.hypot(dx, dz);
  const min = (player.radius || 0.55) + (cpu.radius || 0.55);
  if (dist > 0 && dist < min) {
    const nx = dx / dist, nz = dz / dist;
    const push = (min - dist) * 0.5;
    a.x += nx * push; a.z += nz * push;
    b.x -= nx * push; b.z -= nz * push;
  }
}

function animate() {
  const tscale = (window.__timescale || 1);
  const dt = clock.getDelta() * slowMo * tscale;

  fight.update(dt);
  ring.update(dt);
  player.update(dt);
  cpuAI.update(dt);
  cpu.update(dt);
  separateFighters();
  ref.update(dt, player, cpu);

  // hit detection both ways (respects block/cooldown)
  applyHitDetection({ attacker: player, defender: cpu, overlay, hitLab });
  applyHitDetection({ attacker: cpu, defender: player, overlay, hitLab });

  // KO → brief cinematic → next round (fallback)
  if (!window.__nextRound && (player.health <= 0 || cpu.health <= 0)) {
    window.__nextRound = setTimeout(() => {
      player.health = cpu.health = 100;
      player.stamina = cpu.stamina = 100;
      player.xp = cpu.xp = 0;
      placeFighters();
      camCtrl.lockTo(player);
      fight?.startBout?.();
      window.__nextRound = null;
    }, 2500);
  }

  crowd.update(dt, fight.getIntensity());
  camCtrl.update(dt, fight.cameraIntent());

  const hud = fight.hudState();
  ui.update(hud);
  updateHPBars(dt, hud);
  pids.update({ playerName: player.name, cpuName: cpu.name });

  composer.render();

  const wantsReplay = fight.isDoingReplay?.();
  slowMo = wantsReplay ? 0.45 : 1.0;
  replayTag.style.display = wantsReplay ? 'block' : 'none';

  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

// Simple keyboard controls (REMAPPED: A→S, D→W, W→D, S→A)
const keys = new Set();
addEventListener('keydown', e=>keys.add(e.code));
addEventListener('keyup',   e=>keys.delete(e.code));
function handleControls() {
  player.controls({
    forward: keys.has('KeyD'), // W -> D
    back:    keys.has('KeyA'), // S -> A
    left:    keys.has('KeyS'), // A -> S
    right:   keys.has('KeyW'), // D -> W
    jab:     keys.has('KeyJ'),
    cross:   keys.has('KeyK'),
    block:   keys.has('KeyL'),
    weave:   keys.has('KeyI')
  });
  requestAnimationFrame(handleControls);
}
handleControls();

// Dev hotkeys
addEventListener('keydown', (e)=>{
  if (e.code === 'KeyB') renderer.toneMappingExposure = (renderer.toneMappingExposure < 1.5) ? 1.6 : 1.2;
  if (e.code === 'KeyN') bloom.enabled = !bloom.enabled;
});

// ---------- grammar-based debug console ----------
setupDebugConsole({
  scene, camera, renderer, composer, bloom,
  ring, crowd, camCtrl, fight, player, cpu, audio, state, placeFighters,
  tools: {
    camProbe: new CameraProbe({ scene, camera }),
    fighters: new FDebug({ player, cpu }),
    sdebug:   new SceneDebug({ scene, ring, crowd, bloom }),
    overlay,
    hitLab,
  }
});

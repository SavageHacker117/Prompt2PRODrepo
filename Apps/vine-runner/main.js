import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { Engine } from './core/Engine.js';
import { LevelManager } from './core/LevelManager.js';
import { Input } from './core/Input.js';
import { HUD } from './core/HUD.js';
import { DebugConsole } from './core/DebugConsole.js';
import { GamepadInput } from './core/GamepadInput.js';

import { AnimPanel } from './core/AnimPanel.js';
import { ScriptRuntime } from './core/ScriptRuntime.js';
import { ScriptPanel } from './core/ScriptPanel.js';
import { CameraController } from './core/CameraController.js';
import { installVideoWalls } from './core/VideoSkins.js';
import { ControllerOverlay } from './core/ControllerOverlay.js';

// ---- FIX: import the grammar module as a namespace and pick the right export
import * as GrammarMod from './grammar/index.js';
const registerGrammars =
  GrammarMod.registerGrammars || GrammarMod.registerGrammar || (() => {});
// ---------------------------------------------------------------------------

// Canvas + UI
const canvas = document.getElementById('c');
const ui = {
  mainMenu: document.getElementById('mainMenu'),
  pauseMenu: document.getElementById('pauseMenu'),
  levelComplete: document.getElementById('levelComplete'),
  gameOver: document.getElementById('gameOver'),
  hud: document.getElementById('hud'),
  hudLevel: document.getElementById('hudLevel'),
  hudScore: document.getElementById('hudScore'),
  btnStart: document.getElementById('btnStart'),
  btnResume: document.getElementById('btnResume'),
  btnQuit: document.getElementById('btnQuit'),
  btnNext: document.getElementById('btnNext'),
  btnRetry: document.getElementById('btnRetry'),
};

// ---------- Intro overlay wiring ----------
const intro       = document.getElementById('intro');
const introVideo  = document.getElementById('introVideo');
const tapToPlay   = document.getElementById('tapToPlay');
const btnAudio    = document.getElementById('btnAudio');
const volSlider   = document.getElementById('volSlider');

function setMuted(muted) {
  if (introVideo) introVideo.muted = !!muted;
  if (btnAudio)   btnAudio.textContent = muted ? 'Unmute' : 'Mute';
}
function revealUI() {
  document.body.classList.remove('intro-active');
  if (intro) intro.style.display = 'none';
  try { introVideo?.pause?.(); } catch {}
  ui.mainMenu?.classList.add('show');
}
function userGesturePlay(video) {
  try { video?.play?.(); } catch {}
}
const tapHandler = (e) => {
  e.preventDefault(); e.stopPropagation();
  userGesturePlay(introVideo);
  revealUI();
};
tapToPlay?.addEventListener('click', tapHandler);
tapToPlay?.addEventListener('touchend', tapHandler, { passive: true });

btnAudio?.addEventListener('click', (e) => {
  e.preventDefault(); e.stopPropagation();
  setMuted(!(introVideo && introVideo.muted === false));
  userGesturePlay(introVideo);
});
volSlider?.addEventListener('input', (e) => {
  const v = Math.max(0, Math.min(1, Number(e.target.value || 0.6)));
  if (introVideo) {
    introVideo.volume = v;
    if (introVideo.muted && v > 0) setMuted(false);
  }
});
window.addEventListener('keydown', (e) => {
  if (!document.body.classList.contains('intro-active')) return;
  if (e.code === 'Enter' || e.code === 'Space') { userGesturePlay(introVideo); revealUI(); }
  if (e.code === 'KeyM') setMuted(!(introVideo && introVideo.muted === false));
});

// ---------- Core singletons ----------
const input  = new Input();
const engine = new Engine(canvas, input);
const levels = new LevelManager(engine);
const hud    = new HUD(ui.hud);
const dbg    = new DebugConsole(engine, levels);

// Expose engine + camera to ScriptRuntime procedural ctx
engine.scene.userData.__engine     = engine;
engine.scene.userData.__mainCamera = engine.camera;

// Camera & wheel zoom (dolly-by-default)
const camCtl = new CameraController(engine.camera, canvas);
camCtl.setZoomStyle('dolly');

// Tools
const animPanel   = new AnimPanel(engine);
const scripts     = new ScriptRuntime(engine.scene);
const scriptPanel = new ScriptPanel(scripts, { animPanel });

// Controller mapper overlay (click-to-bind)
const padOverlay  = new ControllerOverlay({
  imageUrl: 'assets/ui/xbox_controller.png',
  input,
});

// Console grammars (inject helpers)
registerGrammars(dbg, engine, levels, {
  animPanel,
  scriptHost: scripts,
  puppetPanel: scriptPanel,
  padOverlay,
  getActiveGamepad: () => {
    const pads = navigator.getGamepads?.() || [];
    const idx = gamepad.activeIndex ?? null;
    return { index: idx, gamepad: (idx != null) ? pads[idx] : null };
  },
});

// Keep motion/procedural scripts ticking with real dt
const scriptClock = new THREE.Clock();
(function scriptTick(){
  const dt = scriptClock.getDelta();
  scripts.update(dt);
  requestAnimationFrame(scriptTick);
})();

// Dev handles
window.anim        = animPanel;
window.motion      = { runtime: scripts, panel: scriptPanel };
window.scripts     = scripts;
window.scriptPanel = scriptPanel;
window.cam         = camCtl;

let videoSkins = null;

// ---------- helpers ----------
function show(panel){
  [ui.mainMenu, ui.pauseMenu, ui.levelComplete, ui.gameOver]
    .forEach(p => p?.classList.remove('show'));
  if (panel) panel.classList.add('show');
}
function showHUD(v){ hud.setVisible(!!v); }
function on(btn, fn){ btn && btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); fn(); }); }

async function attachAKToRightHand(){
  const skinned = [];
  engine.scene.traverse(o => { if (o.isSkinnedMesh) skinned.push(o); });
  const mesh = skinned[0];
  if (!mesh?.skeleton) return false;

  const names = mesh.skeleton.bones.map(b => b.name);
  const pick  = names.find(n => /r.*hand/i.test(n)) || names.find(n=>/Right.*Hand/i.test(n));
  if (!pick) return false;

  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync('assets/models/tools/Ak47.glb');
  const gun = gltf.scene || gltf.scenes?.[0];
  if (!gun) return false;

  gun.scale.set(0.01,0.01,0.01);
  gun.rotation.set(0, Math.PI/2, 0);
  gun.position.set(0,0,0);

  mesh.skeleton.bones.find(b=>b.name===pick)?.add(gun);
  return true;
}

async function setupVideoWalls(){
  try{
    if (videoSkins) { videoSkins.dispose(); videoSkins = null; }

    const anchor = engine.player?.group || engine.camera;

    videoSkins = await installVideoWalls(
      engine.scene,
      {
        left:  'assets/textures/tpk1/textures/videoWalls/LHwall.mp4',
        right: 'assets/textures/tpk1/textures/videoWalls/RHwall.mp4',
        floor: 'assets/textures/tpk1/textures/videoWalls/1Floor.mp4',
        sky:   'assets/textures/tpk1/textures/videoWalls/1Sky.mp4',
      },
      {
        anchor,
        nameHints: {
          left:  ['LHwall', 'LeftWall', 'Left', 'Wall_L', 'WallLeft'],
          right: ['RHwall', 'RightWall', 'Right', 'Wall_R', 'WallRight'],
          floor: ['1Floor', 'Floor', 'Ground'],
          sky:   ['1Sky', 'Sky', 'Ceiling', 'Ceil'],
        }
      }
    );

    await videoSkins.playAll();
  } catch (e) {
    console.warn('Video skins setup failed:', e);
  }
}

async function afterLevelReady(){
  animPanel.player = engine.player;
  animPanel.refresh();
  scripts.scanForSkeleton();
  await setupVideoWalls();
  try{ await attachAKToRightHand(); }catch{}
}

// ---------- Click-pick debug ----------
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
canvas.addEventListener('pointerdown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const overIntro = document.body.classList.contains('intro-active');
  if (overIntro) return; // don't pick while intro overlay is up

  ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(ndc, engine.camera);
  const hits = raycaster.intersectObjects(engine.scene.children, true);
  const hit = hits.find(h => h.object?.isMesh);
  if (hit) {
    const o = hit.object;
    console.log('Picked:', o.name || o.uuid, o);
    dbg?.print?.(`Picked: ${o.name || o.uuid}`);
  }
});

// ---------- Hotkeys ----------
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyI') { videoSkins?.toggleDebugIDs?.(); }
  if (e.code === 'KeyK') { animPanel?.toggle?.(); }
  if (e.code === 'KeyJ') { scriptPanel?.toggle?.(); } // toggle Scripts IDE
});

// ---------- Game flow ----------
function showMainHUDAndStart() {
  show(null); showHUD(true);
  engine.start();
}
on(ui.btnStart, async () => {
  scripts.clear();                  // ensure clean (stops procs/motion)
  await levels.loadLevel(0);
  requestAnimationFrame(() => { afterLevelReady(); });
  showMainHUDAndStart();
});
on(ui.btnResume, () => { show(null); engine.resume(); });
on(ui.btnQuit, async () => {
  engine.stop();
  scripts.clear();                  // stop running scripts when quitting
  videoSkins?.dispose?.();
  videoSkins = null;
  await levels.reset();
  show(ui.mainMenu);
  showHUD(false);
});
on(ui.btnNext, async () => {
  scripts.clear();
  await levels.nextLevel();
  requestAnimationFrame(() => { afterLevelReady(); });
  show(null); engine.start();
});
on(ui.btnRetry, async () => {
  scripts.clear();
  await levels.retryLevel();
  requestAnimationFrame(() => { afterLevelReady(); });
  show(null); engine.start();
});

engine.onLevelComplete = () => { show(ui.levelComplete); };
engine.onGameOver      = () => { show(ui.gameOver); };
engine.onHUD           = (data) => { hud.update(data); };

// Pause (keyboard)
input.onPause = () => { if (engine.isRunning) { engine.pause(); show(ui.pauseMenu); } };

// Gamepad loop -> HUD + overlay
const gamepad = new GamepadInput();
(function gpTick(){
  const state = gamepad.update();

  const pads = navigator.getGamepads?.() || [];
  const idx = gamepad.activeIndex ?? null;
  const gp  = (idx != null) ? pads[idx] : null;

  if (typeof hud.setPadStatus === 'function') {
    hud.setPadStatus({ connected: !!gp, index: gp ? idx : null, name: gp?.id || '' });
  }
  if (typeof padOverlay.update === 'function') padOverlay.update(gp);
  if (state) input.applyGamepad(state);

  requestAnimationFrame(gpTick);
})();

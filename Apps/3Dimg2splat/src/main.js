// src/main.js
import * as THREE from 'three';
import { UIManager } from './ui/UIManager.js';
import { WorldGenerator } from './world/WorldGenerator.js';
import { MaterialLibrary } from './world/MaterialLibrary.js';
import { BlockBuilder } from './builder/BlockBuilder.js';
import { CameraController } from './camera/CameraController.js';
import { MiniMap } from './builder/MiniMap.js';
import { WorldState } from './world/WorldState.js';

// Optional runtime goodies (ok if exports are missing)
import { attachDevConsole } from './grammar/console.js';
import { initDayNight, tickDayNight } from './atmosphere/dayNnite.js';
import { initWeather, tickWeather } from './atmosphere/weather.js';

const canvas = document.getElementById('three-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1020);

// Day/Night & Weather systems (guarded)
const _dayNight = (typeof initDayNight === 'function') ? initDayNight(scene) : null;
const _weather  = (typeof initWeather  === 'function') ? initWeather(scene)  : null;

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(12, 14, 12);

const materials  = new MaterialLibrary(renderer, { useSplatTextures: true, splatQuality: 'medium' });
const worldState = new WorldState();
const worldGen   = new WorldGenerator(materials, worldState);
const builder    = new BlockBuilder(scene, worldGen, materials, worldState, camera, renderer);
const cameraController = new CameraController(camera, renderer.domElement);
const minimap    = new MiniMap(worldGen, worldState);
const ui         = new UIManager({ worldGen, materials, builder, cameraController, minimap, worldState });

scene.add(worldGen.getWorldGroup());

// Expose debug context for console/commands
window.__s2w = { worldGen, materials, cameraController, dayNite: _dayNight, weather: _weather };

// -------------------------------
// Optional modules bootstrapping
// -------------------------------
const _opt = { pad: null, input: null, overlay: null, hud: null, prevY: false };
const _modes = { edit: null, play: null, current: 'edit' };

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
function animate() {
  const dt = clock.getDelta();

  cameraController.update?.(dt);
  builder.update?.(dt);
  worldGen.update(dt, camera.position);
  minimap.update?.();

  if (typeof tickDayNight === 'function') tickDayNight(dt, _dayNight);
  if (typeof tickWeather  === 'function') tickWeather(dt,  _weather);

  if (_opt.pad && _opt.input) {
    const padState = _opt.pad.update();
    _opt.input.setGamepadState?.(padState);
    _opt.input.beginFrame?.();

    const gp = (navigator.getGamepads && navigator.getGamepads()[_opt.pad.activeIndex || 0]) || null;
    const yPressed = !!(gp?.buttons?.[3]?.pressed);
    if (yPressed && !_opt.prevY && typeof cameraController.cycleMode === 'function') cameraController.cycleMode();
    _opt.prevY = yPressed;

    // keep HUD/overlay in sync
    const info = _opt.pad.info();
    _opt.hud?.setGamepadInfo?.(info);
    _opt.overlay?.setGamepadInfo?.(info);
  }

  _modes.play?.update?.(dt);

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

// Dev console (toggle with backtick) — guarded
if (typeof attachDevConsole === 'function') attachDevConsole();

(async () => {
  // Grammar Panel (seed/LOD/time) – optional
  try {
    const { GrammarPanel } = await import(/* @vite-ignore */ './grammar/GrammarPanel.js');
    const { parsePrompt }  = await import(/* @vite-ignore */ './grammar/userPromptsLang.js');
    const { buildPipelineField } = await import(/* @vite-ignore */ './terrain/pipeline/TerrainPipeline.js');

    const panel = new GrammarPanel({
      onSeed: async (text) => {
        const spec  = parsePrompt?.(text || '') ?? null;
        if (spec) {
          const field = buildPipelineField(worldGen.seed, spec, null);
          worldGen.splatField = field;
          worldGen.invalidateAll();
        } else {
          await worldGen.seedFromPrompt(text);
        }
      },
      onLOD: (lod) => materials.setSplatQuality?.(lod),
      onTime: (hours) => _dayNight?.setTime?.(hours),
    });
    panel.setPrompt?.('steep mountains NE-SW with 2 rivers, west coast');
  } catch {}

  // Gamepad + input overlay – optional
  try {
    const [{ Input }, { GamepadInput }, { ControllerOverlay }] = await Promise.all([
      import(/* @vite-ignore */ './controls/Input.js'),
      import(/* @vite-ignore */ './controls/GamepadInput.js'),
      import(/* @vite-ignore */ './controls/ControllerOverlay.js'),
    ]);
    _opt.input = new Input();
    _opt.pad   = new GamepadInput();
    _opt.overlay = new ControllerOverlay({ imageUrl: '/ui/xbox_controller.png' });

    window.addEventListener('keydown', (e) => { if (e.code === 'KeyM') _opt.overlay.toggle(); });

    try {
      const { PlayHUD } = await import(/* @vite-ignore */ './ui/PlayHUD.js');
      _opt.hud = new PlayHUD(); _opt.hud.show();
    } catch {}
  } catch {}

  // Optional InputManager (mouse build/remove + hotbar)
  try {
    const { InputManager } = await import(/* @vite-ignore */ './controls/InputManager.js');
    // eslint-disable-next-line no-new
    new InputManager({ scene, canvas: renderer.domElement, camera, renderer, worldGen, worldState });  } catch {}

  // Optional Edit/Play modes
  try {
    const [{ EditMode }, { PlayMode }] = await Promise.all([
      import(/* @vite-ignore */ './modes/EditMode.js'),
      import(/* @vite-ignore */ './modes/PlayMode.js'),
    ]);
    _modes.edit = new EditMode({ scene, builder });
    _modes.play = new PlayMode({ input: _opt.input, cameraController });

    // O = Edit, P = Play
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyO') {
        _modes.play?.disable?.();
        _modes.edit?.enable?.();
        _modes.current = 'edit';
        _opt.hud?.setMode?.('Edit');
      } else if (e.code === 'KeyP') {
        _modes.edit?.disable?.();
        _modes.play?.enable?.();
        _modes.current = 'Play';
        _opt.hud?.setMode?.('Play');
      }
    });
    _opt.hud?.setMode?.('Edit');
  } catch {}

  // Tiny WorldPanel for Sea/Height tweaks
  try {
    const { WorldPanel } = await import(/* @vite-ignore */ './ui/WorldPanel.js');
    // eslint-disable-next-line no-new
    new WorldPanel({ worldGen });
  } catch {}
})();

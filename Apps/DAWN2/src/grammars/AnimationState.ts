// DAWN2/src/grammars/AnimationState.ts
import * as THREE from 'three';

type KeyState = { [k: string]: boolean };
const keys: KeyState = {};

// camera modes
type CameraMode = 'free' | 'third' | 'first';
let camMode: CameraMode = 'free';
let thirdPersonIndex = 0;

// third-person presets (relative to player local space)
const TP_OFFSETS = [
  new THREE.Vector3(0, 1.7, -3.0), // close shoulders
  new THREE.Vector3(0, 2.0, -4.5), // mid
  new THREE.Vector3(0, 2.5, -6.0), // pulled back
];

// first-person offset (slightly in front of eyes)
const FP_OFFSET = new THREE.Vector3(0, 1.65, 0.12);

// head anchor (where camera looks)
const HEAD_OFFSET = new THREE.Vector3(0, 1.6, 0);

// book-keep the current "player" actor root for movement/camera/mobs
let playerRoot: any = null;

// simple timer for coord logging
let posDebugTimer = 0;

// gamepad tracking
let lastPadIndex: number | null = null;

// scratch vectors for movement + camera
const V_FWD = new THREE.Vector3();
const V_RIGHT = new THREE.Vector3();
const V_MOVE = new THREE.Vector3();
const V_DESIRED_CAM = new THREE.Vector3();
const V_TARGET = new THREE.Vector3();

/* ───────── helpers: gamepad ───────── */

function getActiveGamepad(): Gamepad | null {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
  const pads = navigator.getGamepads();
  if (!pads) return null;

  if (lastPadIndex != null && pads[lastPadIndex]) {
    return pads[lastPadIndex]!;
  }

  for (let i = 0; i < pads.length; i++) {
    const p = pads[i];
    if (p && p.connected) {
      lastPadIndex = i;
      return p;
    }
  }
  return null;
}

function getMoveAxesFromInput(): { x: number; z: number } {
  let x = 0;
  let z = 0;

  // keyboard WSAD
  if (keys['KeyW']) z += 1;
  if (keys['KeyS']) z -= 1;
  if (keys['KeyD']) x += 1;
  if (keys['KeyA']) x -= 1;

  // gamepad left stick (standard mapping; DualSense is usually this)
  const pad = getActiveGamepad();
  if (pad && pad.mapping === 'standard') {
    const axX = pad.axes[0] || 0; // left/right
    const axY = pad.axes[1] || 0; // up/down (up = -1)
    const dead = 0.15;

    const lx = Math.abs(axX) < dead ? 0 : axX;
    const ly = Math.abs(axY) < dead ? 0 : axY;

    x += lx;
    z += -ly; // forward when pushing stick up
  }

  // normalize if longer than 1
  const len = Math.hypot(x, z);
  if (len > 1e-3 && len > 1) {
    x /= len;
    z /= len;
  }
  return { x, z };
}

/* ───────── anim panel glue ───────── */

export function initPlayerControls() {
  const ap = (window as any).__animPanel || {};
  const eng = (window as any).__engine || {};

  // Map your real clip names here
  const CLIP = {
    idle: 'Idle',
    breathe: 'Breathe',
    walk: 'Walk',
    jog: 'Jog',
    run: 'Run',
    aim: 'Aim',
    fire: 'Fire',
    reload: 'Reload',
    jump: 'Jump',
    fall: 'Fall',
    land: 'Land',
    turnL: 'TurnLeft',
    turnR: 'TurnRight',
  };

  // helpers
  const setLoop = (on: boolean) => ap.loop?.(on ? 'on' : 'off');
  const playOnce = (name: string) => {
    setLoop(false);
    ap.play?.(name);
  };
  const fadeTo = (name: string, t = 0.2) => {
    setLoop(true);
    ap.fadeTo?.(name, t);
  };

  /* ───────── input handlers ───────── */

  function onKey(e: KeyboardEvent, down: boolean) {
    keys[e.code] = down;

    // hotkeys only on keydown
    if (!down) return;

    switch (e.code) {
      case 'Digit8': {
        // cycle 3rd-person camera presets
        if (camMode !== 'third') {
          camMode = 'third';
          thirdPersonIndex = 0;
        } else {
          thirdPersonIndex = (thirdPersonIndex + 1) % TP_OFFSETS.length;
        }
        break;
      }
      case 'Digit7': {
        // toggle first-person on/off
        camMode = camMode === 'first' ? 'free' : 'first';
        break;
      }
      case 'Digit0': {
        // reset to old free/orbit camera
        camMode = 'free';
        break;
      }
      default:
        break;
    }
  }

  function onMouse(e: MouseEvent, down: boolean) {
    if (e.button === 2) {
      // right mouse -> aim
      keys['MouseRight'] = down;
      if (down) fadeTo(CLIP.aim);
      else updateLocomotion(); // release aim -> back to locomotion
    }
    if (e.button === 0 && keys['MouseRight']) {
      // left while aiming -> fire
      if (down) playOnce(CLIP.fire);
    }
  }

  const keyDown = (e: KeyboardEvent) => onKey(e, true);
  const keyUp = (e: KeyboardEvent) => onKey(e, false);
  const mouseDown = (e: MouseEvent) => onMouse(e, true);
  const mouseUp = (e: MouseEvent) => onMouse(e, false);

  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  window.addEventListener('mousedown', mouseDown);
  window.addEventListener('mouseup', mouseUp);

  /* ───────── locomotion state ───────── */

  function moving(): boolean {
    const { x, z } = getMoveAxesFromInput();
    return Math.abs(x) > 0.01 || Math.abs(z) > 0.01;
  }

  function isRun(): boolean {
    const pad = getActiveGamepad();
    const padRun = !!pad && !!pad.buttons[5] && pad.buttons[5].pressed; // R1
    return (
      keys['ShiftLeft'] ||
      keys['ShiftRight'] ||
      padRun
    );
  }

  function isWalk(): boolean {
    const pad = getActiveGamepad();
    const padWalk = !!pad && !!pad.buttons[4] && pad.buttons[4].pressed; // L1
    return (
      keys['AltLeft'] ||
      keys['AltRight'] ||
      padWalk
    );
  }

  function locomotionClip(): string {
    if (!moving()) return CLIP.breathe;
    if (isRun()) return CLIP.run;
    if (isWalk()) return CLIP.walk; // slower walk
    return CLIP.jog;
  }

  function updateLocomotion() {
    if (keys['MouseRight']) return; // stay in aim while held
    fadeTo(locomotionClip());
  }

  /* ───────── movement system (XZ) ───────── */

  let enabled = true;
  let speedBase = 2.5;

  function desiredSpeed(): number {
    if (!moving()) return 0;
    if (isRun() && !isWalk()) return speedBase * 1.8;
    if (isWalk() && !isRun()) return speedBase * 0.6;
    return speedBase;
  }

  function getPlayerRoot(): any {
    if (playerRoot && playerRoot.parent) return playerRoot;
    // fallback if playerRoot got deleted
    const root: any =
      eng.activeActor?.object ||
      eng.selected ||
      null;
    return root;
  }

  function applyCameraFollow(root: any, dt: number) {
    const cam: any = (window as any).__camera;
    if (!cam || camMode === 'free') return;

    const yaw = root.rotation?.y || 0;
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);

    const localOffset =
      camMode === 'first'
        ? FP_OFFSET
        : TP_OFFSETS[thirdPersonIndex] || TP_OFFSETS[0];

    // rotate local offset by yaw into world space
    V_DESIRED_CAM.set(
      localOffset.x * cos + localOffset.z * sin,
      localOffset.y,
      -localOffset.x * sin + localOffset.z * cos,
    );

    // target at head
    V_TARGET.copy(root.position).add(HEAD_OFFSET);

    // smooth follow
    const followStrength = camMode === 'first' ? 20 : 10;
    const t = Math.min(1, dt * followStrength);

    V_DESIRED_CAM.add(V_TARGET); // desired camera world position
    cam.position.lerp(V_DESIRED_CAM, t);
    cam.lookAt(V_TARGET);
  }

  const sys = {
    update(dt: number, _state?: any) {
      if (!enabled) return;

      const root: any = getPlayerRoot();
      if (!root) return;

      const cam: any = (window as any).__camera;
      const yaw =
        cam && cam.position && cam.position.set
          ? Math.atan2(
              cam.position.x - root.position.x,
              cam.position.z - root.position.z,
            )
          : root.rotation?.y || 0;

      // compute world forward/right from yaw
      V_FWD.set(Math.sin(yaw), 0, Math.cos(yaw));
      V_RIGHT.set(0, 1, 0).cross(V_FWD).negate();

      const { x: moveX, z: moveZ } = getMoveAxesFromInput();

      // combine movement vector
      V_MOVE.set(0, 0, 0);
      if (Math.abs(moveZ) > 0.001) V_MOVE.addScaledVector(V_FWD, moveZ);
      if (Math.abs(moveX) > 0.001) V_MOVE.addScaledVector(V_RIGHT, moveX);

      const sp = desiredSpeed();
      if (V_MOVE.lengthSq() > 0.0001 && sp > 0) {
        V_MOVE.normalize().multiplyScalar(sp * dt);
        root.position.add(V_MOVE);

        // rotate actor to face travel direction (smooth)
        const targetYaw = Math.atan2(V_MOVE.x, V_MOVE.z);
        root.rotation.y +=
          (targetYaw - root.rotation.y) * Math.min(1, dt * 10);
      }

      // update locomotion anim if needed
      updateLocomotion();

      // update player root & export to engine for other systems (mobs, etc.)
      playerRoot = root;
      if (!eng.player) eng.player = {};
      eng.player.object = root;

      // follow camera
      applyCameraFollow(root, dt);

      // optional coord debug once per second
      posDebugTimer += dt;
      if (posDebugTimer > 1.0) {
        posDebugTimer = 0;
        const logFn =
          (window as any).__dbgLog || console.log.bind(console);
        logFn(
          `[player] pos x=${root.position.x.toFixed(
            2,
          )}, y=${root.position.y.toFixed(2)}, z=${root.position.z.toFixed(
            2,
          )}`,
        );
      }
    },
  };

  // register into engine systems so the App tick calls it
  (eng.systems ||= new Set()).add(sys);

  // expose controls on engine
  eng.movement = {
    enabled,
    enable(v: boolean) {
      enabled = v;
      this.enabled = v;
      if (v) {
        // lock current active actor as player if possible
        const root: any =
          eng.activeActor?.object ||
          eng.selected ||
          playerRoot;
        if (root) {
          playerRoot = root;
          if (!eng.player) eng.player = {};
          eng.player.object = root;
        }
        updateLocomotion();
      }
    },
    setSpeed(v: number) {
      speedBase = Math.max(0.1, v);
    },
  };

  // start state
  fadeTo(CLIP.breathe, 0.001);

  // disposer
  return () => {
    window.removeEventListener('keydown', keyDown);
    window.removeEventListener('keyup', keyUp);
    window.removeEventListener('mousedown', mouseDown);
    window.removeEventListener('mouseup', mouseUp);
    (eng.systems as Set<any>)?.delete(sys);
    delete eng.movement;
    if (eng.player) delete eng.player;
    playerRoot = null;
  };
}

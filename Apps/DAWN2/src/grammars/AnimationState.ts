// src/grammars/AnimationState.ts
import * as THREE from 'three'

type KeyState = { [k: string]: boolean }

// global-ish key map so we can drive this from keyboard AND gamepad
const keys: KeyState = {}

// we keep one active instance so re-calling initPlayerControls is safe
let activeDispose: (() => void) | null = null

export function initPlayerControls() {
  // clean up any previous instance
  if (activeDispose) {
    activeDispose()
    activeDispose = null
  }

  // clear keys
  for (const k of Object.keys(keys)) delete keys[k]

  const ap = (window as any).__animPanel || {}
  const eng = (window as any).__engine || {}

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
  } as const

  // helpers
  const setLoop = (on: boolean) => ap.loop?.(on ? 'on' : 'off')
  const playOnce = (name: string) => {
    setLoop(false)
    ap.play?.(name)
  }
  const fadeTo = (name: string, t = 0.2) => {
    setLoop(true)
    ap.fadeTo?.(name, t)
  }

  // ───────── view modes (free / 3rd person / 1st person) ─────────

  type ViewMode = 'free' | 'third' | 'first'
  let viewMode: ViewMode = 'free'
  let thirdViewIndex = 0

  const THIRD_VIEWS = [
    // shoulders + a bit of body
    { height: 1.7, distance: 4.0, shoulder: 0.0 },
    // over-right-shoulder, a bit closer
    { height: 1.75, distance: 3.0, shoulder: 0.45 },
    // tighter chase cam
    { height: 1.8, distance: 2.3, shoulder: -0.35 },
  ] as const

  function hasActor() {
    return !!(eng.activeActor?.object || eng.selected)
  }

  function cycleThirdPerson() {
    if (!hasActor()) return
    viewMode = 'third'
    thirdViewIndex = (thirdViewIndex + 1) % THIRD_VIEWS.length
  }

  function enterFirstPerson() {
    if (!hasActor()) return
    viewMode = 'first'
  }

  function resetViewMode() {
    viewMode = 'free'
  }

  // ───────── input state ─────────
  let rightMouseDown = false

  function onKey(e: KeyboardEvent, down: boolean) {
    const tag = (e.target as HTMLElement | null)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA') return

    if (down) {
      // 8 / numpad 8 = cycle third-person camera distances
      if (e.code === 'Digit8' || e.code === 'Numpad8') {
        cycleThirdPerson()
        return
      }
      // 7 / numpad 7 / 0 = first person
      if (
        e.code === 'Digit7' ||
        e.code === 'Numpad7' ||
        e.code === 'Digit0' ||
        e.code === 'Numpad0'
      ) {
        enterFirstPerson()
        return
      }
      // = key → free camera again (while HUD still uses it to clear selection)
      if (e.code === 'Equal') {
        resetViewMode()
      }
    }

    keys[e.code] = down
  }

  function onMouse(e: MouseEvent, down: boolean) {
    if (e.button === 2) {
      // right -> aim
      rightMouseDown = down
      if (down) fadeTo(CLIP.aim)
      else updateLocomotion() // release aim -> back to locomotion
    }

    // left while aiming -> fire
    if (e.button === 0 && rightMouseDown) {
      if (down) playOnce(CLIP.fire)
    }
  }

  const keyDown = (e: KeyboardEvent) => onKey(e, true)
  const keyUp = (e: KeyboardEvent) => onKey(e, false)
  const mouseDown = (e: MouseEvent) => onMouse(e, true)
  const mouseUp = (e: MouseEvent) => onMouse(e, false)

  window.addEventListener('keydown', keyDown)
  window.addEventListener('keyup', keyUp)
  window.addEventListener('mousedown', mouseDown)
  window.addEventListener('mouseup', mouseUp)

  // ───────── locomotion state ─────────
  function moving(): boolean {
    return !!(keys['KeyW'] || keys['KeyA'] || keys['KeyS'] || keys['KeyD'])
  }

  function locomotionClip(): string {
    if (!moving()) return CLIP.breathe
    if (keys['ShiftLeft'] || keys['ShiftRight']) return CLIP.run
    if (keys['AltLeft'] || keys['AltRight']) return CLIP.walk // slower walk with Alt
    return CLIP.jog
  }

  function updateLocomotion() {
    if (rightMouseDown) return // stay in aim while held
    fadeTo(locomotionClip())
  }

  // ───────── movement system (XZ) ─────────
  let enabled = true
  let speedBase = 2.5
  let debugTimer = 0

  function desiredSpeed(): number {
    if (!moving()) return 0
    if (keys['ShiftLeft'] || keys['ShiftRight']) return speedBase * 1.8
    if (keys['AltLeft'] || keys['AltRight']) return speedBase * 0.6
    return speedBase
  }

  const up = new THREE.Vector3(0, 1, 0)
  const vTmp = new THREE.Vector3()
  const fwd = new THREE.Vector3()
  const right = new THREE.Vector3()

  // camera helpers
  const camTarget = new THREE.Vector3()
  const camDesired = new THREE.Vector3()
  const camForward = new THREE.Vector3()
  const camSide = new THREE.Vector3()
  const camLook = new THREE.Vector3()

  const sys = {
    update(dt: number, _state?: any) {
      if (!enabled) return

      const root: any = eng.activeActor?.object || eng.selected
      if (!root) {
        // if actor goes away, drop back to free view
        if (viewMode !== 'free') viewMode = 'free'
        return
      }

      const cam: any = (window as any).__camera

      // forward/back relative to camera direction
      // NOTE: this is camera -> player, so W moves AWAY from the camera.
      const yaw = cam
        ? Math.atan2(
            root.position.x - cam.position.x,
            root.position.z - cam.position.z,
          )
        : 0

      fwd.set(Math.sin(yaw), 0, Math.cos(yaw))
      right.crossVectors(up, fwd).negate()

      vTmp.set(0, 0, 0)
      if (keys['KeyW']) vTmp.add(fwd)
      if (keys['KeyS']) vTmp.sub(fwd)
      if (keys['KeyA']) vTmp.sub(right)
      if (keys['KeyD']) vTmp.add(right)

      const sp = desiredSpeed()
      if (vTmp.lengthSq() > 0) {
        vTmp.normalize().multiplyScalar(sp * dt)
        root.position.add(vTmp)

        // rotate actor to face travel direction (smooth)
        const targetYaw = Math.atan2(vTmp.x, vTmp.z)
        root.rotation.y +=
          (targetYaw - root.rotation.y) * Math.min(1, dt * 10)
      }

      // simple debug: log Rose position once per second
      debugTimer += dt
      if (debugTimer > 1) {
        debugTimer = 0
        const p = root.position
        console.debug(
          '[Player] pos:',
          p.x.toFixed(2),
          p.y.toFixed(2),
          p.z.toFixed(2),
        )
      }

      // camera follow modes
      if (cam && viewMode !== 'free') {
        const headHeight = 1.6

        // actor forward
        camForward.set(
          Math.sin(root.rotation.y),
          0,
          Math.cos(root.rotation.y),
        )
        camSide.crossVectors(camForward, up).normalize()

        camTarget.copy(root.position).addScaledVector(up, headHeight)

        if (viewMode === 'third') {
          const cfg = THIRD_VIEWS[thirdViewIndex]
          camDesired
            .copy(root.position)
            .addScaledVector(up, cfg.height)
            .addScaledVector(camForward, -cfg.distance)
            .addScaledVector(camSide, cfg.shoulder)

          const lerp = 1 - Math.exp(-dt * 10)
          cam.position.lerp(camDesired, lerp)

          camLook.copy(camTarget)
          cam.lookAt(camLook)
        } else if (viewMode === 'first') {
          const eyeHeight = headHeight + 0.05
          camTarget.copy(root.position).addScaledVector(up, eyeHeight)

          camDesired.copy(camTarget).addScaledVector(camForward, 0.1)
          const lerp = 1 - Math.exp(-dt * 12)
          cam.position.lerp(camDesired, lerp)

          // Look a few meters ahead for a nice FPS feel.
          camLook.copy(camTarget).addScaledVector(camForward, 5)
          cam.lookAt(camLook)
        }
      }

      // update locomotion anim if needed
      updateLocomotion()
    },
  }

  // register into engine systems so the App tick calls it
  ;(eng.systems ||= new Set()).add(sys as any)

  // Allow external systems (pad, AI, etc.) to drive movement
  function applyDirection(dir: {
    forward?: boolean
    back?: boolean
    left?: boolean
    right?: boolean
  }) {
    keys['KeyW'] = !!dir.forward
    keys['KeyS'] = !!dir.back
    keys['KeyA'] = !!dir.left
    keys['KeyD'] = !!dir.right
    updateLocomotion()
  }

  // expose controls on engine
  eng.movement = {
    enabled,
    enable(v: boolean) {
      enabled = v
      this.enabled = v
      updateLocomotion()
    },
    setSpeed(v: number) {
      speedBase = Math.max(0.1, v)
    },
    /** gamepad / AI can call this each frame */
    setDirection(dir: {
      forward?: boolean
      back?: boolean
      left?: boolean
      right?: boolean
    }) {
      applyDirection(dir)
    },
    /** expose for debug */
    getDirection() {
      return {
        forward: !!keys['KeyW'],
        back: !!keys['KeyS'],
        left: !!keys['KeyA'],
        right: !!keys['KeyD'],
      }
    },
  }

  // start state
  fadeTo(CLIP.breathe, 0.001)

  // disposer
  const dispose = () => {
    window.removeEventListener('keydown', keyDown)
    window.removeEventListener('keyup', keyUp)
    window.removeEventListener('mousedown', mouseDown)
    window.removeEventListener('mouseup', mouseUp)
    ;(eng.systems as Set<any>)?.delete(sys as any)
    viewMode = 'free'
  }

  activeDispose = dispose
  return dispose
}

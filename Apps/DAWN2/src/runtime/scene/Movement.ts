// Movement.ts — very small WASD movement for the *selected* actor
import * as THREE from 'three'

export function initMovement(engine: any) {
  const state = {
    enabled: false,
    keys: { w:false, a:false, s:false, d:false },
    speed: 2.5,
    last: performance.now(),
    raf: 0 as number
  }

  function step(now: number) {
    if (!state.enabled) return
    const dt = Math.min(0.05, (now - state.last) / 1000)
    state.last = now

    const sel: THREE.Object3D | undefined = [...(engine.interactor?.selection || [])][0]
    if (sel) {
      const dir = new THREE.Vector3(
        (state.a? -1:0) + (state.d? 1:0),
        0,
        (state.w? -1:0) + (state.s? 1:0)
      )
      if (dir.lengthSq() > 0) {
        dir.normalize().multiplyScalar(state.speed * dt)
        sel.position.add(dir)
      }
    }

    state.raf = requestAnimationFrame(step)
  }

  function key(e: KeyboardEvent, on: boolean) {
    const k = e.key.toLowerCase()
    if (k==='w') state.w = on
    if (k==='a') state.a = on
    if (k==='s') state.s = on
    if (k==='d') state.d = on
  }

  function enable(v: boolean) {
    if (state.enabled === v) return
    state.enabled = v
    state.last = performance.now()
    if (v) {
      window.addEventListener('keydown', dk, { passive: true })
      window.addEventListener('keyup', uk, { passive: true })
      state.raf = requestAnimationFrame(step)
    } else {
      window.removeEventListener('keydown', dk)
      window.removeEventListener('keyup', uk)
      cancelAnimationFrame(state.raf)
    }
  }

  const dk = (e: KeyboardEvent)=> key(e, true)
  const uk = (e: KeyboardEvent)=> key(e, false)

  engine.movement = {
    enable,
    get enabled(){ return state.enabled },
    setSpeed(v:number){ state.speed = v }
  }
}

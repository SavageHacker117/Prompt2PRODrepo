// core/AnimGraph.js
import * as THREE from 'three'

export class AnimGraph {
  constructor(mixer, actions) {
    this.mixer = mixer
    this.actions = actions || {}
    this.current = null
    this.speed = 0
    this.onGround = true
    this._fade = 0.15

    // Start in idle if present
    if (this.actions.idle) this._play('idle', 0)
  }

  static fromClips(mixer, clips, map) {
    // fuzzy map if not provided
    const pick = (kw, fallback) => {
      const lc = kw.toLowerCase()
      return clips.find(c => c.name.toLowerCase().includes(lc)) || fallback
    }
    const actions = {}
    if (clips?.length) {
      actions.idle = mixer.clipAction(map?.idle || pick('idle', clips[0]))
      actions.walk = mixer.clipAction(map?.walk || pick('walk'))
      actions.run  = mixer.clipAction(map?.run  || pick('run',  map?.walk))
      actions.jump = mixer.clipAction(map?.jump || pick('jump'))
      Object.values(actions).forEach(a => { if (a) { a.enabled = true; a.clampWhenFinished = false; } })
    }
    return new AnimGraph(mixer, actions)
  }

  setParams({ speed = this.speed, onGround = this.onGround } = {}) {
    this.speed = speed
    this.onGround = onGround
  }

  triggerJump() {
    if (!this.actions.jump) return
    // quick additive jump hit if available
    this._play('jump', 0.05, true)
  }

  update(dt) {
    if (this.mixer) this.mixer.update(dt)

    // choose locomotion
    let target = 'idle'
    if (!this.onGround && this.actions.jump) target = 'jump'
    else if (this.speed > 3.3 && this.actions.run) target = 'run'
    else if (this.speed > 0.2 && this.actions.walk) target = 'walk'

    this._play(target, this._fade)
  }

  _play(name, fade = 0.15, oneShot = false) {
    const next = this.actions[name]
    if (!next || this.current === next) return
    const prev = this.current
    if (oneShot) {
      next.reset()
      next.setLoop(THREE.LoopOnce, 1)
      next.clampWhenFinished = false
    }
    next.enabled = true
    next.play()
    if (prev) prev.crossFadeTo(next, fade, false)
    this.current = next
  }
}

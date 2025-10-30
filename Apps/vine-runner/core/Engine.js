import * as THREE from 'three'
import { Player } from '../prefabs/Player.js'
import { ObstacleFactory } from '../prefabs/Obstacle.js'
import { VineFactory } from '../prefabs/Vine.js'
import { GameState } from './GameState.js'
// Optional decorative walls — safe whether it exports named or default
import * as DecorWalls from '../prefabs/DecorWalls.js'

export class Engine {
  constructor(canvas, input) {
    this.canvas = canvas
    this.input = input
    this.clock = new THREE.Clock()

    this.scene = new THREE.Scene()
    this.scene.fog = new THREE.Fog(0x0a0f14, 15, 90)

    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 200)
    this.camera.position.set(0, 4, 8)

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.VSMShadowMap

    // Lights
    const hemi = new THREE.HemisphereLight(0xbfdcff, 0x2a2d31, 0.6)
    this.scene.add(hemi)
    const dir = new THREE.DirectionalLight(0xfff2cc, 0.9)
    dir.position.set(10, 16, 8)
    dir.castShadow = true
    dir.shadow.mapSize.set(2048, 2048)
    dir.shadow.camera.near = 0.5
    dir.shadow.camera.far = 80
    this.scene.add(dir)

    // Floor
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(300, 80),
      new THREE.MeshStandardMaterial({ color: 0x0e1720, roughness: 1 })
    )
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    this.scene.add(ground)

    // Subtle side rails for depth cues
    const bandMat = new THREE.MeshStandardMaterial({ color: 0x143a52, roughness: 0.9, metalness: 0.0 })
    const bandL = new THREE.Mesh(new THREE.BoxGeometry(300, 8, 2), bandMat)
    bandL.position.set(0, 4, -8); bandL.receiveShadow = true
    const bandR = bandL.clone(); bandR.position.z = 8
    this.scene.add(bandL, bandR)

    // Optional festive/confetti walls
    this._decor = null
    const buildWalls = DecorWalls.buildDecorWalls || DecorWalls.default
    if (typeof buildWalls === 'function') {
      try { this._decor = buildWalls(this.scene) } catch { /* ok if not present */ }
    }

    // Actors
    this.player = new Player(this.scene)
    this.obstacles = []
    this.vines = []

    // Game state
    this.game = new GameState()
    if (typeof this.game.lives !== 'number') this.game.lives = 3

    // Meta
    this.levelIndex = 0
    this.totalLevels = 10
    this.finishZ = 40
    this._currentLevelDef = null

    // Callbacks (wired by main.js)
    this.isRunning = false
    this.onLevelComplete = () => {}
    this.onGameOver = () => {}
    this.onHUD = () => {}

    // Input helpers
    this._jumpConsumed = false           // for grapple toggle
    this._gamepadManager = null          // optional external manager

    window.addEventListener('resize', () => this.onResize())
  }

  // (Optional) main.js can inject a manager with an update() method returning a snapshot
  setGamepad(manager) { this._gamepadManager = manager }

  setLevel(index, levelDef, { respawn = false } = {}) {
    // Clear existing level content
    this.obstacles.forEach(o => o.dispose?.())
    this.vines.forEach(v => v.dispose?.())
    this.obstacles = []
    this.vines = []

    this.levelIndex = index
    if (!respawn) this._currentLevelDef = levelDef

    // Build obstacles/vines
    levelDef.blocks.forEach(b => this.obstacles.push(ObstacleFactory.block(this.scene, b)))
    levelDef.spikes.forEach(s => this.obstacles.push(ObstacleFactory.spikes(this.scene, s)))
    levelDef.pits.forEach(p => this.obstacles.push(ObstacleFactory.pit(this.scene, p)))
    levelDef.vines.forEach(v => this.vines.push(VineFactory.vine(this.scene, v)))

    // Player + finish
    this.player.reset(levelDef.start)
    this.finishZ = levelDef.finishZ

    // Per-level reset (score for the level starts fresh; total persists)
    if (!respawn) this.game.resetForLevel?.()
  }

  start() { this.isRunning = true; this.clock.start(); this.loop() }
  stop() { this.isRunning = false }
  pause() { this.isRunning = false }
  resume() { if (!this.isRunning) { this.isRunning = true; this.loop() } }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(window.innerWidth, window.innerHeight)
  }

  // Handle a death: lose a life, respawn or game over
  _handleDeath() {
    this.game.lives = Math.max(0, (this.game.lives || 0) - 1)
    if (this.game.lives > 0) {
      // quick respawn on the same level
      this.setLevel(this.levelIndex, this._currentLevelDef, { respawn: true })
    } else {
      this.isRunning = false
      this.onGameOver()
    }
  }

  // Read controller for this frame (no latching)
  _applyGamepadThisFrame() {
    // If an external manager is present, use it
    if (this._gamepadManager && typeof this._gamepadManager.update === 'function') {
      const gp = this._gamepadManager.update()
      if (gp && typeof this.input.applyGamepad === 'function') this.input.applyGamepad(gp)
      return
    }

    // Fallback: raw Web Gamepad API
    const pads = (navigator.getGamepads && navigator.getGamepads()) || []
    const p = pads.find(g => g && g.connected)
    if (!p) return

    const axX = p.axes?.[0] ?? 0      // left stick X
    const axY = p.axes?.[1] ?? 0      // left stick Y
    const dead = 0.25
    const left  = axX < -dead
    const right = axX >  dead
    const up    = axY < -0.35
    const down  = axY >  0.35
    const aBtn  = !!(p.buttons?.[0]?.pressed) // A = jump

    if (typeof this.input.applyGamepad === 'function') {
      this.input.applyGamepad({ axes: [axX, axY], buttons: { a: aBtn, up, down, left, right } })
    } else {
      // Minimal merge into current keyboard state
      this.input.left  = this.input.left  || left
      this.input.right = this.input.right || right
      this.input.up    = this.input.up    || up
      this.input.down  = this.input.down  || down
      this.input.jump  = this.input.jump  || aBtn
    }
  }

  loop = () => {
    if (!this.isRunning) return
    requestAnimationFrame(this.loop)
    const dt = Math.min(0.033, this.clock.getDelta())

    // Rebuild ephemeral input state each frame (if Input supports it)
    if (typeof this.input.beginFrame === 'function') this.input.beginFrame()

    // Gamepad per-frame polling (prevents BT/XInput “sticky” input)
    this._applyGamepadThisFrame()

    // Tick game state + actors
    this.game.tick?.(dt)
    this.player.update(dt, this.input)
    this.vines.forEach(v => v.update?.(dt))

    // --- COLLISIONS / HAZARDS ---
    let alive = true

    // Foot AABB so floor spikes register
    const footBox = new THREE.Box3().setFromCenterAndSize(
      new THREE.Vector3(this.player.position.x, 0.6, this.player.position.z),
      new THREE.Vector3(0.7, 1.2, 0.7)
    )

    for (const o of this.obstacles) {
      if (o.type === 'block') {
        if (o.intersectsAABB(this.player.bounds)) this.player.resolveBlockCollision(o)
      } else if (o.type === 'spikes') {
        if (o.intersectsAABB(footBox)) { alive = false; break }
      } else if (o.type === 'pit') {
        const inSpan = (this.player.position.z > o.zMin && this.player.position.z < o.zMax)
        if (inSpan && this.player.position.y < o.yThreshold) { alive = false; break }
      }
    }

    // Grapple toggle on jump press
    if (this.input.jump && !this._jumpConsumed) {
      this._jumpConsumed = true
      const anyAttached = this.vines.some(v => v.playerAttached)
      if (anyAttached) this.vines.forEach(v => v.detach?.())
      else this.vines.forEach(v => v.tryAttach?.(this.player))
    }
    if (!this.input.jump) this._jumpConsumed = false

    // Finish line: award level score only at completion
    if (this.player.position.x >= this.finishZ) {
      this.game.scoreTotal = (this.game.scoreTotal || 0) + Math.max(1, Math.floor(this.game.levelScore || 0))
      this.isRunning = false
      this.onLevelComplete()
    }

    // Process death (life loss or game over)
    if (!alive) this._handleDeath()

    // Passive level scoring
    this.game.levelScore = (this.game.levelScore || 0) + dt * 10

    // HUD update (add lives)
    this.onHUD({
      levelIndex: this.levelIndex,
      totalLevels: this.totalLevels,
      score: Math.floor(this.game.scoreTotal || 0),
      hpPct: (typeof this.game.hpPct === 'function') ? this.game.hpPct() : 1.0,
      lives: this.game.lives
    })

    // Camera follow
    const target = new THREE.Vector3(
      this.player.position.x - 6,
      4 + this.player.position.y * 0.15,
      this.player.position.z + 0.0
    )
    this.camera.position.lerp(target, 1 - Math.pow(0.001, dt))
    const lookAt = new THREE.Vector3(
      this.player.position.x + 4,
      this.player.position.y + 1.5,
      this.player.position.z
    )
    this.camera.lookAt(lookAt)

    this.renderer.render(this.scene, this.camera)
  }
}

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

export class LevelManager {
  constructor(engine) {
    this.engine = engine
    this.levels = this.createLevels()
    this.current = 0
  }

  async loadLevel(index) {
    this.current = index
    await this.engine.player.ensureLoaded(new GLTFLoader())
    this.engine.setLevel(index, this.levels[index])
  }

  async nextLevel() {
    this.current = Math.min(this.current + 1, this.levels.length - 1)
    await this.loadLevel(this.current)
  }

  async retryLevel() { await this.loadLevel(this.current) }

  async reset() { this.current = 0 }

  createLevels() {
    const make = (i) => {
      const density = 6 + i
      const blocks = []
      const spikes = []
      const pits = []
      const vines = []
      let x = 6
      for (let n = 0; n < density; n++) {
        const kind = Math.random()
        const lane = (Math.random()*2-1) * 4.0
        const gap = 4 + Math.random()*3
        x += gap
        if (kind < 0.4) {
          blocks.push({ x, y: 1, z: lane, w: 2.5, h: 2, d: 2.5 })
        } else if (kind < 0.65) {
          spikes.push({ x, z: lane, count: 3, spacing: 0.8 })
        } else if (kind < 0.85) {
          pits.push({ fromX: x-1.0, toX: x+2.5, yThreshold: 0.2 })
        } else {
          vines.push({ anchorX: x, anchorY: 6 + Math.random()*2, anchorZ: lane, length: 5 + Math.random()*2, phase: Math.random()*Math.PI })
        }
      }
      return {
        start: { x: 0, y: 1.2, z: 0 },
        finishZ: x + 10,
        blocks, spikes, pits, vines,
      }
    }
    return Array.from({ length: 10 }, (_, i) => make(i))
  }
}

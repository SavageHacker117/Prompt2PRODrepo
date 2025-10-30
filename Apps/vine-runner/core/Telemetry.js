// core/Telemetry.js
export class Telemetry {
  constructor(engine) {
    this.engine = engine
    this.fps = 0
    this._ema = 0
    this.samples = 0
  }

  update(dt) {
    const fps = 1 / Math.max(1e-6, dt)
    this._ema = this._ema ? this._ema * 0.92 + fps * 0.08 : fps
    this.fps = Math.round(this._ema)

    // expose a quick snapshot for your debug console
    this.snapshot = {
      fps: this.fps,
      level: this.engine.levelIndex + 1,
      score: Math.floor(this.engine.game?.scoreTotal ?? 0),
      lives: this.engine.game?.lives ?? 0,
      bones: this.engine.player?.skeletonInfo?.boneCount ?? 0,
      pos: this.engine.player?.position?.toArray?.() ?? [0,0,0],
      velX: this.engine.player?.velocity?.x ?? 0,
    }
  }
}

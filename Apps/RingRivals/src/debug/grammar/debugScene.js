// Quick scene debug helpers (bloom/light nudge, etc)
export class SceneDebug {
  constructor({ scene, ring, crowd, bloom }) {
    this.scene = scene; this.ring = ring; this.crowd = crowd; this.bloom = bloom;
  }
  brighten() { this.bloom.strength = Math.min(2.0, (this.bloom.strength ?? 0.45) + 0.15); }
  dim()      { this.bloom.strength = Math.max(0.0, (this.bloom.strength ?? 0.45) - 0.15); }
}

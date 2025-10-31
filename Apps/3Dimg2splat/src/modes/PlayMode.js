// src/modes/PlayMode.js
export class PlayMode {
  constructor({ input, cameraController }) {
    this.input = input;
    this.cam = cameraController;
    this.enabled = false;
  }
  enable(){ this.enabled = true; }
  disable(){ this.enabled = false; }
  toggle(){ this.enabled ? this.disable() : this.enable(); }
  update(dt){
    if (!this.enabled) return;
    // Very light nudge control (only if your camera exposes it)
    const f = this.input?.analogForward ?? (this.input?.up ? 1 : this.input?.down ? -1 : 0);
    const s = this.input?.analogZ       ?? (this.input?.right ? 1 : this.input?.left ? -1 : 0);
    if ((f || s) && typeof this.cam?.nudge === 'function') this.cam.nudge(f, s, dt);
  }
}

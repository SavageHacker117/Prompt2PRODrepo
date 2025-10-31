// src/modes/EditMode.js
export class EditMode {
  constructor({ scene, builder }) {
    this.scene = scene;
    this.builder = builder;
    this.enabled = true;
    this.onPick = null;
  }
  enable(){ this.enabled = true; this.builder?.setEnabled?.(true); }
  disable(){ this.enabled = false; this.builder?.setEnabled?.(false); }
  toggle(){ this.enabled ? this.disable() : this.enable(); }
}

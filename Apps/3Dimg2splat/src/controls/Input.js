export class Input {
  constructor() {
    this.gp = null;
    this.axes = { moveX: 0, moveY: 0, lookX: 0, lookY: 0 };
    this.buttons = new Map();
  }
  setGamepadState(gp) { this.gp = gp; }
  beginFrame() {
    if (!this.gp) return;
    const a = this.gp.axes || [];
    this.axes.moveX = a[0] || 0;  this.axes.moveY = a[1] || 0;
    this.axes.lookX = a[2] || 0;  this.axes.lookY = a[3] || 0;
    (this.gp.buttons || []).forEach((b, i) => this.buttons.set(i, !!b.pressed));
  }
  getAxis(name) { return this.axes[name] || 0; }
  getButtonIndex(name) {
    // map logical names → button indices (A,B,X,Y)
    const map = { jump: 0, action: 1, select: 2, camera: 3 };
    return (name in map) ? map[name] : -1;
  }
  isPressed(name) {
    const idx = this.getButtonIndex(name);
    return idx >= 0 ? !!this.buttons.get(idx) : false;
  }
}

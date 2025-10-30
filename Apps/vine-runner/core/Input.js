// core/Input.js
// Keyboard-first input with optional gamepad merge and user-rebindable keys.
// Gamepad snapshots are queued and merged inside beginFrame() (so they are
// not wiped by the keyboard reset).

const DEFAULT_KEYMAP = {
  // Gameplay actions
  jump: 'Space',
  brake: 'ShiftLeft',
  dash: 'KeyF',
  use: 'KeyE',
  pause: 'Escape',

  // D-pad / movement
  dpad_up: 'ArrowUp',
  dpad_down: 'ArrowDown',
  dpad_left: 'ArrowLeft',
  dpad_right: 'ArrowRight',

  // Extras you may wire later
  lb: 'KeyQ', rb: 'KeyR',
  lt: 'Digit1', rt: 'Digit2',
  view: 'Tab', menu: 'Enter',
  lpress: 'KeyZ', rpress: 'KeyX',
};

export class Input {
  constructor() {
    // restore keymap
    let stored = null;
    try { stored = JSON.parse(localStorage.getItem('keymap.v1') || 'null'); } catch {}
    this.keyMap = Object.assign({}, DEFAULT_KEYMAP, stored || {});

    // runtime state read by the game
    this.left = this.right = this.up = this.down = this.jump = false;
    this.analogZ = 0;            // -1..+1 (strafe)
    this.analogForward = 0;      // -1..+1 (forward/back; up positive)

    // internals
    this._keys = new Set();
    this._pendingPad = null;     // snapshot from GamepadInput.update()
    this.onPause = null;

    // listeners
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this._keys.add(e.code);
      if (e.code === this.keyMap.pause || e.code === 'KeyP') {
        if (typeof this.onPause === 'function') this.onPause();
      }
    }, { passive: false });

    window.addEventListener('keyup', (e) => {
      this._keys.delete(e.code);
    }, { passive: true });
  }

  // ---- Key binding management ----
  setKeyBinding(action, code) {
    this.keyMap[action] = code;
    try { localStorage.setItem('keymap.v1', JSON.stringify(this.keyMap)); } catch {}
  }
  getKeyMap() { return { ...this.keyMap }; }

  // Provide latest gamepad snapshot; merged on next beginFrame()
  setGamepadState(state) { this._pendingPad = state || null; }
  // Back-compat name used elsewhere
  applyGamepad(state) { this.setGamepadState(state); }

  // Call once per frame BEFORE reading input in your game loop.
  beginFrame() {
    // Keyboard base
    const k = (code) => this._keys.has(code);
    this.left  = k(this.keyMap.dpad_left);
    this.right = k(this.keyMap.dpad_right);
    this.up    = k(this.keyMap.dpad_up);
    this.down  = k(this.keyMap.dpad_down);
    this.jump  = k(this.keyMap.jump);

    this.analogZ = 0;
    this.analogForward = 0;

    // Merge queued gamepad snapshot (if any)
    const s = this._pendingPad;
    if (s) {
      this.left  = this.left  || !!s.left;
      this.right = this.right || !!s.right;
      this.up    = this.up    || !!s.up;
      this.down  = this.down  || !!s.down;
      this.jump  = this.jump  || !!s.jump;

      if (typeof s.analogZ === 'number') {
        this.analogZ = Math.abs(s.analogZ) > Math.abs(this.analogZ) ? s.analogZ : this.analogZ;
      }
      if (typeof s.analogForward === 'number') {
        this.analogForward = Math.abs(s.analogForward) > Math.abs(this.analogForward)
          ? s.analogForward : this.analogForward;
      }

      if (s.startPressed && typeof this.onPause === 'function') this.onPause();
    }
    // keep the last snapshot one frame; Engine should call this every tick
  }
}

// core/GamepadInput.js
// Robust Xbox / XInput support (BT or USB). Picks one active pad.
// Left stick = move, A = jump, START = pause (edge is returned in state).
// Exposes connection info & change events for HUD indicator.

export class GamepadInput {
  constructor() {
    this.dead = 0.22;
    this.switchThreshold = 0.6;   // activity above this can take control

    this.activeIndex = null;
    this.prevButtons = new Map(); // key: index -> boolean[]
    this.connected = false;       // any pad present
    this.id = '';
    this.type = '';
    this.lastActiveAt = 0;

    // HUD/event hooks
    this.onConnect = null;     // () => void
    this.onDisconnect = null;  // () => void
    this.onChange = null;      // () => void (index/id changed)

    // Browser events
    window.addEventListener('gamepadconnected',  () => this._refreshConnection(true));
    window.addEventListener('gamepaddisconnected', () => this._refreshConnection(true));

    this._refreshConnection(false);
  }

  info() {
    return {
      connected: this.connected,
      index: this.activeIndex,
      id: this.id,
      type: this.type,
    };
  }

  _pads() {
    return (navigator.getGamepads && navigator.getGamepads()) || [];
  }

  _shortId(id = '') {
    // Clean noisy IDs like "Xbox 360 Controller (XInput STANDARD GAMEPAD ...)"
    return id
      .replace(/\(.*?\)/g, '')
      .replace(/STANDARD GAMEPAD/i, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  _activityOf(gp) {
    if (!gp) return 0;
    let a = 0;
    for (let i = 0; i < gp.axes.length; i++) a = Math.max(a, Math.abs(gp.axes[i] || 0));
    for (let i = 0; i < gp.buttons.length; i++) a = Math.max(a, gp.buttons[i]?.pressed ? 1 : 0);
    return a;
  }

  _emitChange(kind) {
    if (kind === 'connect' && typeof this.onConnect === 'function') this.onConnect();
    if (kind === 'disconnect' && typeof this.onDisconnect === 'function') this.onDisconnect();
    if (typeof this.onChange === 'function') this.onChange();
  }

  _refreshConnection(emit) {
    const pads = this._pads();
    const any = Array.from(pads).some(Boolean);
    const prevConnected = this.connected;
    this.connected = any;

    // Maintain id/type from currently active pad if possible
    const gp = (this.activeIndex != null) ? pads[this.activeIndex] : null;
    if (gp) {
      this.id = this._shortId(gp.id || '');
      this.type = /xbox|xinput/i.test(gp.id) ? 'xbox' : 'generic';
    } else {
      // No active pad yet → peek first available for label
      const first = Array.from(pads).find(Boolean);
      this.id = this._shortId(first?.id || '');
      this.type = first ? (/xbox|xinput/i.test(first.id) ? 'xbox' : 'generic') : '';
    }

    if (emit && prevConnected !== this.connected) {
      this._emitChange(this.connected ? 'connect' : 'disconnect');
    }
  }

  _chooseActive() {
    const pads = this._pads();
    // keep current if still connected
    if (this.activeIndex != null && pads[this.activeIndex]) return;

    // otherwise pick the first connected (or most active)
    let bestIdx = null, bestAct = -1;
    for (let i = 0; i < pads.length; i++) {
      const gp = pads[i];
      if (!gp) continue;
      const act = this._activityOf(gp);
      if (act > bestAct) { bestAct = act; bestIdx = i; }
    }

    if (bestIdx !== this.activeIndex) {
      this.activeIndex = bestIdx;
      const gp = (bestIdx != null) ? pads[bestIdx] : null;
      this.id = this._shortId(gp?.id || '');
      this.type = gp ? (/xbox|xinput/i.test(gp.id) ? 'xbox' : 'generic') : '';
      this._emitChange('change');
    }
  }

  _maybeSwitchController() {
    const pads = this._pads();
    if (!pads) return;
    const now = performance.now();

    const curr = (this.activeIndex != null) ? pads[this.activeIndex] : null;
    let bestIdx = this.activeIndex, bestAct = this._activityOf(curr);
    for (let i = 0; i < pads.length; i++) {
      const gp = pads[i];
      if (!gp) continue;
      const act = this._activityOf(gp);
      if (act > bestAct + 1e-6 && act >= this.switchThreshold) {
        bestIdx = i; bestAct = act;
      }
    }
    if (bestIdx !== this.activeIndex) {
      this.activeIndex = bestIdx;
      this.lastActiveAt = now;

      const gp = (bestIdx != null) ? pads[bestIdx] : null;
      this.id = this._shortId(gp?.id || '');
      this.type = gp ? (/xbox|xinput/i.test(gp.id) ? 'xbox' : 'generic') : '';
      this._emitChange('change');
    }
  }

  _dz(v) { return Math.abs(v) < this.dead ? 0 : v; }

  update() {
    this._refreshConnection(false);
    this._chooseActive();
    this._maybeSwitchController();

    const pads = this._pads();
    const gp = (this.activeIndex != null) ? pads[this.activeIndex] : null;
    if (!gp) return null;

    // Axes (standard mapping)
    const axX = this._dz(gp.axes[0] || 0);  // left stick X
    const axY = this._dz(gp.axes[1] || 0);  // left stick Y (up is -)

    // Digital DPAD (buttons 12..15), with graceful fallback
    const btn = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
    const dU = btn(12), dD = btn(13), dL = btn(14), dR = btn(15);

    const prev = this.prevButtons.get(this.activeIndex) || [];
    const A = btn(0);
    const START = btn(9);
    const startPressed = START && !prev[9];

    // store previous button states
    this.prevButtons.set(this.activeIndex, gp.buttons.map(b => !!b?.pressed));

    // Compose digital directions from either stick or dpad
    const left  = dL || axX < -0.35;
    const right = dR || axX >  0.35;
    const up    = dU || axY < -0.35;  // forward
    const down  = dD || axY >  0.35;  // brake

    return {
      left, right, up, down,
      jump: A,
      analogZ: axX,
      analogForward: -axY,
      startPressed,
      meta: this.info()
    };
  }
}

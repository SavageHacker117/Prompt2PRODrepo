// core/ControllerOverlay.js
// Visual + clickable controller mapper overlay.
// Click a hotspot, press a keyboard key to bind the action.
// Labels update live and bindings persist to localStorage.

function codeToHuman(code) {
  if (!code) return '—';
  if (code.startsWith('Key'))   return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const map = {
    Space:'Space', Escape:'Esc', Enter:'Enter', Tab:'Tab',
    ShiftLeft:'L-Shift', ShiftRight:'R-Shift',
    ControlLeft:'L-Ctrl', ControlRight:'R-Ctrl',
    AltLeft:'L-Alt', AltRight:'R-Alt',
    ArrowUp:'↑', ArrowDown:'↓', ArrowLeft:'←', ArrowRight:'→',
  };
  return map[code] || code;
}

export class ControllerOverlay {
  /**
   * @param {Object} opts
   *   - imageUrl: string                         // background PNG
   *   - zIndex: number
   *   - input: Input                             // to read/set key bindings
   */
  constructor(opts = {}) {
    this.imageUrl = opts.imageUrl || 'assets/ui/xbox_controller.png';
    this.zIndex = opts.zIndex ?? 12000;
    this.input = opts.input || null;

    // DOM root
    this.root = document.createElement('div');
    this.root.id = 'padOverlay';
    this.root.style.zIndex = String(this.zIndex);
    document.body.appendChild(this.root);

    // UI container
    this.ui = document.createElement('div');
    this.ui.className = 'pad-ui';
    this.ui.style.backgroundImage = `url('${this.imageUrl}')`;
    this.root.appendChild(this.ui);

    // Close button
    const close = document.createElement('button');
    close.className = 'pad-close';
    close.title = 'Close';
    close.textContent = '✕';
    close.addEventListener('click', () => this.hide());
    this.ui.appendChild(close);

    // Help text
    this.help = document.createElement('div');
    this.help.className = 'pad-help';
    this.help.textContent = 'Click a control, then press a key to bind it. Esc cancels. Click ✕ to exit.';
    this.ui.appendChild(this.help);

    // Build hotspots
    this.nodes = new Map();
    this._buildHotspots();

    // for live highlighting (from main loop)
    this._lastGP = null;
  }

  /* ---------- layout ---------- */
  _ring(wPct, hPct, xPct, yPct, id) {
    const el = document.createElement('div');
    el.className = 'pad-ring';
    this._place(el, wPct, hPct, xPct, yPct, true);
    el.dataset.id = id;

    const label = document.createElement('div');
    label.className = 'pad-label';
    label.textContent = codeToHuman(this.input?.getKeyMap?.()[id]);
    el.appendChild(label);

    el.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      this._beginCapture(id, el);
    });

    this.ui.appendChild(el);
    this.nodes.set(id, { el, label });
  }

  _trigger(wPct, hPct, xPct, yPct, id) {
    const el = document.createElement('div');
    el.className = 'pad-trigger';
    this._place(el, wPct, hPct, xPct, yPct, false);
    el.dataset.id = id;

    const fill = document.createElement('div');
    fill.className = 'fill';
    el.appendChild(fill);

    el.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      this._beginCapture(id, el);
    });

    this.ui.appendChild(el);
    this.nodes.set(id, { el, fill });
  }

  _stick(sizePct, xPct, yPct, id) {
    const el = document.createElement('div');
    el.className = 'pad-stick';
    this._place(el, sizePct, sizePct, xPct, yPct, true);
    el.dataset.id = id;

    const dot = document.createElement('div');
    dot.className = 'dot';
    el.appendChild(dot);

    // stick-press binding (click ring)
    el.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      this._beginCapture(id, el);
    });

    this.ui.appendChild(el);
    this.nodes.set(id, { el, dot });
  }

  _place(el, wPct, hPct, xPct, yPct, circle) {
    el.style.position = 'absolute';
    el.style.width = `${wPct}%`;
    el.style.height = `${hPct}%`;
    el.style.left = `${xPct - (circle ? wPct/2 : 0)}%`;
    el.style.top  = `${yPct - (circle ? hPct/2 : 0)}%`;
    if (circle) el.style.borderRadius = '999px';
  }

  _buildHotspots() {
    // Face buttons
    this._ring(7.5, 7.5, 71.8, 60.8, 'jump');   // A
    this._ring(7.5, 7.5, 77.5, 50.4, 'brake');  // B
    this._ring(7.5, 7.5, 66.2, 50.4, 'dash');   // X
    this._ring(7.5, 7.5, 71.8, 43.2, 'use');    // Y

    // Shoulders + triggers
    this._ring(18, 6, 18.0, 14.0, 'lb');
    this._ring(18, 6, 82.0, 14.0, 'rb');
    this._trigger(20, 7.5, 20.0, 10.0, 'lt');
    this._trigger(20, 7.5, 80.0, 10.0, 'rt');

    // Menu
    this._ring(6.8, 6.8, 45.5, 33.8, 'view');
    this._ring(6.8, 6.8, 54.5, 33.8, 'menu');

    // D-pad
    this._ring(10, 6.8, 36.5, 53.2, 'dpad_up');
    this._ring(10, 6.8, 36.5, 66.5, 'dpad_down');
    this._ring(10, 6.8, 30.3, 60.0, 'dpad_left');
    this._ring(10, 6.8, 42.7, 60.0, 'dpad_right');

    // Sticks + press
    this._stick(16.8, 26.5, 43.2, 'lpress'); // we bind press here
    this._stick(16.8, 57.5, 49.0, 'rpress');
  }

  /* ---------- binding flow ---------- */
  _beginCapture(actionId, el) {
    this.nodes.forEach(n => n.el.classList.remove('on'));
    el.classList.add('on');
    this.help.textContent = `Press a keyboard key to bind "${actionId.toUpperCase()}". Esc cancels.`;

    const onKey = (e) => {
      e.preventDefault(); e.stopPropagation();
      if (e.code === 'Escape') {
        this.help.textContent = 'Binding canceled. Click another control or ✕ to close.';
        el.classList.remove('on');
        window.removeEventListener('keydown', onKey, true);
        return;
      }
      if (this.input?.setKeyBinding) {
        this.input.setKeyBinding(actionId, e.code);
        try {
          localStorage.setItem('keymap.v1', JSON.stringify(this.input.getKeyMap()));
        } catch {}
        const node = this.nodes.get(actionId);
        const label = node?.el.querySelector('.pad-label');
        if (label) label.textContent = codeToHuman(e.code);
      }
      this.help.textContent = `${actionId.toUpperCase()} → ${codeToHuman(e.code)}.`;
      el.classList.remove('on');
      window.removeEventListener('keydown', onKey, true);
    };

    window.addEventListener('keydown', onKey, true);
  }

  /* ---------- external API ---------- */
  show()  { this.root.classList.add('show'); }
  hide()  { this.root.classList.remove('show'); }
  toggle(){ this.root.classList.toggle('show'); }

  /**
   * Live visual update from main loop.
   * @param {Gamepad|null} gp
   */
  update(gp) {
    // clear state first
    const off = () => {
      this.nodes.forEach(n => {
        n.el.classList.remove('on');
        if (n.fill) n.fill.style.height = '0%';
        if (n.dot)  n.dot.style.transform = 'translate(-50%,-50%)';
      });
    };

    if (!gp) { off(); return; }

    // Helper: button pressed
    const pressed = (i) => {
      const b = gp.buttons?.[i];
      return !!(b && (b.pressed || b.value > 0.5));
    };

    // XInput-like indices
    const BTN = { A:0, B:1, X:2, Y:3, LB:4, RB:5, LT:6, RT:7, VIEW:8, MENU:9, LSP:10, RSP:11, UP:12, DOWN:13, LEFT:14, RIGHT:15 };

    // Face/shoulders/menu/dpad
    const glow = (id, on) => { const n = this.nodes.get(id); if (n) n.el.classList.toggle('on', !!on); };
    glow('jump', pressed(BTN.A));
    glow('brake', pressed(BTN.B));
    glow('dash', pressed(BTN.X));
    glow('use',  pressed(BTN.Y));
    glow('lb',   pressed(BTN.LB));
    glow('rb',   pressed(BTN.RB));
    glow('view', pressed(BTN.VIEW));
    glow('menu', pressed(BTN.MENU));
    glow('dpad_up',    pressed(BTN.UP));
    glow('dpad_down',  pressed(BTN.DOWN));
    glow('dpad_left',  pressed(BTN.LEFT));
    glow('dpad_right', pressed(BTN.RIGHT));
    glow('lpress', pressed(BTN.LSP));
    glow('rpress', pressed(BTN.RSP));

    // Triggers (fill 0..1)
    const lt = gp.buttons?.[BTN.LT]?.value ?? 0;
    const rt = gp.buttons?.[BTN.RT]?.value ?? 0;
    const nLT = this.nodes.get('lt'); if (nLT?.fill) nLT.fill.style.height = `${Math.max(0, Math.min(1, lt))*100}%`;
    const nRT = this.nodes.get('rt'); if (nRT?.fill) nRT.fill.style.height = `${Math.max(0, Math.min(1, rt))*100}%`;

    // Sticks (axis index order may vary per browser; typical: 0/1 = LS, 2/3 = RS)
    const lsX = gp.axes?.[0] ?? 0, lsY = gp.axes?.[1] ?? 0;
    const rsX = gp.axes?.[2] ?? 0, rsY = gp.axes?.[3] ?? 0;
    const move = (dot, x, y) => {
      const travel = 34; // px offset from center
      dot.style.transform = `translate(calc(-50% + ${(x*travel).toFixed(1)}px), calc(-50% + ${(y*travel).toFixed(1)}px))`;
    };
    const nLS = this.nodes.get('lpress'); if (nLS?.dot) move(nLS.dot, lsX, lsY);
    const nRS = this.nodes.get('rpress'); if (nRS?.dot) move(nRS.dot, rsX, rsY);
  }
}

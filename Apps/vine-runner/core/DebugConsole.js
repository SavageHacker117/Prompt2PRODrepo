// core/DebugConsole.js
export class DebugConsole {
  constructor(engine, levels) {
    this.engine = engine;
    this.levels = levels;

    // root
    this.root = document.createElement('div');
    this.root.id = 'dbg';
    this.root.style.display = 'none';
    this.root.innerHTML = `
      <div class="dbg-title">Console
        <span style="float:right; display:flex; gap:6px">
          <button type="button" data-cmd="min" title="Minimize" style="background:#0b1218;border:1px solid #334155;color:#9fbad1;border-radius:8px;width:28px;height:24px">–</button>
          <button type="button" data-cmd="close" title="Close" style="background:#0b1218;border:1px solid #334155;color:#9fbad1;border-radius:8px;width:28px;height:24px">×</button>
        </span>
      </div>
      <pre class="dbg-log"></pre>
      <input class="dbg-in" placeholder="help..." autocomplete="off" />
    `;
    document.body.appendChild(this.root);

    this.logEl = this.root.querySelector('.dbg-log');
    this.inEl = this.root.querySelector('.dbg-in');

    // Commands registry
    this.commands = new Map();
    this._registerBuiltins();

    // Key handling
    window.addEventListener('keydown', (e) => {
      if (e.key === '`' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        this.toggle();
      } else if (e.key === 'Escape' && this.isOpen()) {
        this.close();
      }
    });

    // Click-away to close
    document.addEventListener('mousedown', (e) => {
      if (this.isOpen() && !this.root.contains(e.target)) {
        this.close();
      }
    });

    // Buttons
    this.root.addEventListener('click', (e) => {
      const cmd = e.target.dataset.cmd;
      if (cmd === 'close') this.close();
      if (cmd === 'min')  this._minToggle();
    });

    // Input submit
    this.inEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const line = this.inEl.value.trim();
        this.inEl.value = '';
        if (line) this._dispatch(line);
      }
      e.stopPropagation(); // don't leak to game input
    });

    this._writeln('` to toggle • type "help" for commands');
  }

  // Public
  open()  { this.root.style.display = 'block'; this.inEl.focus(); }
  close() { this.root.style.display = 'none'; }
  toggle(){ this.isOpen() ? this.close() : this.open(); }
  isOpen(){ return this.root.style.display !== 'none'; }

  extend(name, fn, help) {
    this.commands.set(name, { fn, help });
  }

  // Internals
  _writeln(msg='') { this.logEl.textContent += (msg + '\n'); this.logEl.scrollTop = this.logEl.scrollHeight; }
  _writePrompt(line) { this._writeln(`› ${line}`); }

  _dispatch(line) {
    this._writePrompt(line);
    const [cmd, ...rest] = line.split(/\s+/);
    const entry = this.commands.get(cmd?.toLowerCase());
    if (!entry) return this._writeln('Unknown command. Try "help".');
    try {
      const out = entry.fn(rest);
      if (typeof out === 'string') this._writeln(out);
      if (Array.isArray(out)) out.forEach(s => this._writeln(String(s)));
    } catch (err) {
      this._writeln(String(err?.message || err || 'Command error'));
    }
  }

  _minToggle() {
    const log = this.logEl;
    const inp = this.inEl;
    const isMin = log.style.display === 'none';
    log.style.display = isMin ? 'block' : 'none';
    inp.style.display = isMin ? 'block' : 'none';
  }

  _registerBuiltins() {
    const game = this.engine.game;

    this.extend('help', () => {
      return [
        'Commands:',
        '  help',
        '  pause, resume',
        '  hp <0-100>, heal <n>, damage <n>',
        '  level <i>, score <n>',
        '  anim toggle | list | play <name> | fade <name> | stop [name] | speed <v> | weight <v> | loop <on|off>',
        '  bones toggle'
      ];
    });

    this.extend('pause', () => { this.engine.pause(); return 'paused'; });
    this.extend('resume', () => { this.engine.resume(); return 'resumed'; });

    this.extend('hp', ([n]) => {
      const v = Math.max(0, Math.min(100, Number(n)));
      game.hp = v;
      return `hp ${v}`;
    });
    this.extend('heal', ([n]) => { game.heal(Number(n)||0); return `hp ${game.hp}`; });
    this.extend('damage', ([n]) => { game.damage(Number(n)||0); return `hp ${game.hp}`; });

    this.extend('level', async ([i]) => {
      const idx = Math.max(0, Number(i)||0);
      await this.levels.loadLevel(idx);
      this.engine.start();
      return `level ${idx+1}`;
    });

    this.extend('score', ([n]) => {
      const v = Math.max(0, Number(n)||0);
      game.scoreTotal = v;
      return `score ${v}`;
    });

    // ---- Animation grammar ----
    const panel = () => (window.__animPanel || null);

    this.extend('anim', (args) => {
      const p = panel();
      if (!args.length) return 'Usage: anim toggle|list|play|fade|stop|speed|weight|loop';
      const sub = args[0];

      if (sub === 'toggle') { if (!p) return 'Anim panel not ready'; p.toggle(); return 'anim panel toggled'; }
      if (sub === 'list')   { if (!p) return 'Anim panel not ready'; return p.list().length ? p.list() : '(no clips)'; }
      if (sub === 'play')   { if (!p) return 'Anim panel not ready'; return p.play(args.slice(1).join(' ')) ? 'playing' : 'not found'; }
      if (sub === 'fade')   { if (!p) return 'Anim panel not ready'; return p.fadeTo(args.slice(1).join(' ')) ? 'fading' : 'not found'; }
      if (sub === 'stop')   { if (!p) return 'Anim panel not ready'; return p.stop(args.slice(1).join(' ')) ? 'stopped' : 'not found'; }
      if (sub === 'speed')  { if (!p) return 'Anim panel not ready'; const v = Number(args[1]); this.engine.player?.mixer && (this.engine.player.mixer.timeScale = v); return `speed ${v}`; }
      if (sub === 'weight') { if (!p) return 'Anim panel not ready'; const v = Number(args[1]); const ok = p._getSelectedAction(); if (ok) { ok.enabled = true; ok.setEffectiveWeight(v); } return `weight ${v}`; }
      if (sub === 'loop')   { if (!p) return 'Anim panel not ready'; const on = (args[1]||'on').toLowerCase() !== 'off'; const a = p._getSelectedAction(); if (a){ a.setLoop(on ? THREE.LoopRepeat : THREE.LoopOnce, on?Infinity:1); a.clampWhenFinished = !on; } return `loop ${on?'on':'off'}`; }

      return 'Unknown anim subcommand';
    });

    // Optional bones tooling (if you add a UI later)
    this.extend('bones', (args) => {
      // You could wire this to your tools/BoneInspector.js if desired.
      // For now just a friendly stub:
      return 'bones tooling not wired yet (stub)';
    });
  }
}

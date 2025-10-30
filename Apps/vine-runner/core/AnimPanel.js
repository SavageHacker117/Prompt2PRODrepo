// core/AnimPanel.js
import * as THREE from 'three';

export class AnimPanel {
  constructor(engine) {
    this.engine = engine;
    this.player = engine?.player || null;

    // state
    this.current = null;
    this._clips = [];
    this._ready = false;

    // root UI
    this.root = document.createElement('div');
    this.root.className = 'anim-panel hidden';
    this.root.innerHTML = `
      <div class="anim-head">Animation</div>

      <div class="anim-row">
        <select class="anim-select" aria-label="Animation select"></select>
        <button type="button" data-cmd="refresh" title="Refresh list">⟳</button>
      </div>

      <div class="anim-row">
        <button type="button" data-cmd="play">Play</button>
        <button type="button" data-cmd="stop">Stop</button>
        <button type="button" data-cmd="fade">Fade To</button>
      </div>

      <div class="anim-row">
        <label style="min-width:56px">Speed</label>
        <input type="range" min="0" max="3" step="0.05" value="1" data-bind="speed"/>
        <span data-out="speed">1.00</span>
      </div>

      <div class="anim-row">
        <label style="min-width:56px">Weight</label>
        <input type="range" min="0" max="1" step="0.01" value="1" data-bind="weight"/>
        <span data-out="weight">1.00</span>
      </div>

      <div class="anim-row">
        <label><input type="checkbox" data-bind="loop" checked/> Loop</label>
        <div style="flex:1"></div>
        <button type="button" data-cmd="pause">Pause</button>
        <button type="button" data-cmd="reset">Reset</button>
        <button type="button" data-cmd="close">Close</button>
      </div>
    `;
    document.body.appendChild(this.root);

    // refs
    this.sel = this.root.querySelector('select.anim-select');
    this.outSpeed = this.root.querySelector('[data-out="speed"]');
    this.outWeight = this.root.querySelector('[data-out="weight"]');

    // events
    this.root.addEventListener('input', (e) => {
      if (e.target.matches('[data-bind="speed"]')) {
        const v = Number(e.target.value);
        this.outSpeed.textContent = v.toFixed(2);
        if (this.player?.mixer) this.player.mixer.timeScale = v;
      }
      if (e.target.matches('[data-bind="weight"]')) {
        const v = Number(e.target.value);
        this.outWeight.textContent = v.toFixed(2);
        const a = this._getSelectedAction();
        if (a) {
          a.enabled = true;
          a.setEffectiveWeight(v);
        }
      }
      if (e.target.matches('[data-bind="loop"]')) {
        const a = this._getSelectedAction();
        if (a) {
          if (e.target.checked) {
            a.setLoop(THREE.LoopRepeat, Infinity);
            a.clampWhenFinished = false;
          } else {
            a.setLoop(THREE.LoopOnce, 1);
            a.clampWhenFinished = true;
          }
        }
      }
    });

    this.root.addEventListener('click', (e) => {
      const cmd = e.target.dataset.cmd;
      if (!cmd) return;
      if (cmd === 'refresh') return this.refresh();
      if (cmd === 'play') return this.playSelected();
      if (cmd === 'fade') return this.fadeToSelected();
      if (cmd === 'stop') return this.stopSelected();
      if (cmd === 'pause') return this.pauseSelected();
      if (cmd === 'reset') return this.resetSelected();
      if (cmd === 'close') return this.close();
    });

    // click-away close (but never when user clicks inside)
    document.addEventListener('mousedown', (e) => {
      if (this.isOpen() && !this.root.contains(e.target)) this.close();
    });

    // first build
    this.refresh();

    // expose for quick debugging
    window.animPanel = this;
  }

  /** Optionally rebind if player object is replaced */
  bindTo(player) {
    this.player = player || this.player;
    this.refresh();
  }

  // ——— API ———
  open()  { this.root.classList.remove('hidden'); this.refresh(); }
  close() { this.root.classList.add('hidden'); }
  toggle(){ this.isOpen() ? this.close() : this.open(); }
  isOpen(){ return !this.root.classList.contains('hidden'); }
  isReady(){ return !!this._ready; }

  list() { return this._clips.slice(); }

  play(name) {
    const a = this._getActionByName(name);
    if (!a) return false;
    a.reset().enabled = true;
    a.setEffectiveWeight(1);
    a.fadeIn(0.12).play();
    this.current = a;
    return true;
  }

  fadeTo(name, dur = 0.25) {
    const a = this._getActionByName(name);
    if (!a) return false;
    if (this.current && this.current !== a) {
      this.current.crossFadeTo(a, dur, false);
    } else {
      a.reset().fadeIn(dur).play();
    }
    this.current = a;
    return true;
  }

  stop(name) {
    const a = name ? this._getActionByName(name) : this.current;
    if (!a) return false;
    a.fadeOut(0.2);
    return true;
  }

  pause(name) {
    const a = name ? this._getActionByName(name) : this.current;
    if (!a) return false;
    a.paused = !a.paused;
    return true;
  }

  reset(name) {
    const a = name ? this._getActionByName(name) : this.current;
    if (!a) return false;
    a.reset();
    return true;
  }

  playSelected(){ const n = this.sel.value; if (n) this.play(n); }
  fadeToSelected(){ const n = this.sel.value; if (n) this.fadeTo(n); }
  stopSelected(){ const n = this.sel.value; this.stop(n); }
  pauseSelected(){ const n = this.sel.value; this.pause(n); }
  resetSelected(){ const n = this.sel.value; this.reset(n); }

  // ——— internals ———
  refresh() {
    this._clips = this._discoverClips();
    this.sel.innerHTML = '';

    if (!this._clips.length) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = '(no clips yet)';
      this.sel.appendChild(opt);
      this._ready = !!this.player; // allow panel to open/close even before clips exist
      return;
    }

    for (const name of this._clips) {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      this.sel.appendChild(opt);
    }

    // pick a sensible default
    if (this.current) {
      const name = this.current.getClip ? this.current.getClip().name : '';
      if (name) this.sel.value = name;
    } else {
      this.sel.value = this._clips[0];
    }

    this._ready = true;
  }

  _discoverClips() {
    const out = new Set();
    const p = this.player;
    if (!p) return [];

    // From Player.actions
    if (p.actions && typeof p.actions === 'object') {
      Object.keys(p.actions).forEach(k => {
        const act = p.actions[k];
        const nm = act?.getClip ? act.getClip().name : k;
        if (nm) out.add(nm);
      });
    }

    // From AnimationMixer internal action list (if any)
    // While _actions is internal, it's widely used and stable enough for tools panels.
    if (p.mixer && Array.isArray(p.mixer._actions)) {
      for (const act of p.mixer._actions) {
        const nm = act?._clip?.name;
        if (nm) out.add(nm);
      }
    }

    return [...out];
  }

  _getActionByName(name) {
    if (!name) return null;
    const p = this.player;
    if (!p?.mixer) return null;

    // Try the Player.actions map
    if (p.actions) {
      for (const key of Object.keys(p.actions)) {
        const a = p.actions[key];
        const nm = a?.getClip ? a.getClip().name : key;
        if (nm === name) return a;
      }
    }

    // Fallback: ask mixer for a clipAction by name (clip lookup by string)
    try {
      return p.mixer.clipAction(name, p.model || undefined);
    } catch {
      // last resort: scan internal actions
      if (Array.isArray(p.mixer._actions)) {
        for (const a of p.mixer._actions) {
          if (a?._clip?.name === name) return a;
        }
      }
      return null;
    }
  }

  _getSelectedAction() { return this._getActionByName(this.sel.value); }
}

export default AnimPanel;

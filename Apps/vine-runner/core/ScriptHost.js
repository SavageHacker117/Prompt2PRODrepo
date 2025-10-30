// core/ScriptHost.js
// Hot-loadable motion scripts runtime. Looks in /scripts/*.js
export class ScriptHost {
  constructor(engine) {
    this.engine = engine;
    this._registry = import.meta.glob('../scripts/*.js');  // relative from core/
    // try an absolute as well (for some bundlers)
    this._registryAbs = import.meta.glob('/scripts/*.js');

    this.active = null;        // { name, mod, controller, ctx }
    this._raf = null;
    this._last = 0;

    if (import.meta.hot) {
      import.meta.hot.on('vite:afterUpdate', () => this._onHMR());
    }
  }

  _onHMR() {
    if (!this.active) return;
    const { name } = this.active;
    this.reload(name);
  }

  list() {
    const names = new Set();
    for (const p of Object.keys(this._registry)) names.add(this._basename(p));
    for (const p of Object.keys(this._registryAbs)) names.add(this._basename(p));
    return [...names].sort();
  }

  _basename(path) {
    const f = path.split('/').pop();
    return f?.replace(/\.js$/i, '') || path;
  }

  async _loadModule(name) {
    const tryPaths = [];
    for (const p of Object.keys(this._registry)) if (this._basename(p) === name) tryPaths.push(p);
    for (const p of Object.keys(this._registryAbs)) if (this._basename(p) === name) tryPaths.push(p);
    if (!tryPaths.length) throw new Error(`script "${name}" not found`);

    const path = tryPaths[0];
    const mod = (await (this._registry[path]?.() || this._registryAbs[path]?.())) || null;
    if (!mod) throw new Error(`failed to import ${path}`);
    return mod;
  }

  _makeCtx() {
    // build a bones map + list
    const player = this.engine.player;
    const bones = [];
    const map = {};
    if (player?.model) {
      player.model.traverse(n => {
        if (n.isBone) { bones.push(n); map[n.name] = n; }
      });
    }
    return {
      engine: this.engine,
      player,
      THREE: awaitTHREE(), // lazy util below
      bones,
      boneMap: map,
      time: 0,
    };
  }

  async start(name) {
    if (this.active) await this.stop();
    const mod = await this._loadModule(name);
    const create = mod.create || mod.default;
    if (typeof create !== 'function') throw new Error(`script ${name} has no create()`);
    const ctx = await this._makeCtx();
    const controller = create(ctx) || {};
    if (controller.start) controller.start(ctx);
    this.active = { name, mod, controller, ctx };
    this._runLoop();
    return true;
  }

  async stop() {
    if (!this.active) return false;
    cancelAnimationFrame(this._raf); this._raf = null;
    try { this.active.controller?.stop?.(this.active.ctx); } catch {}
    this.active = null;
    return true;
  }

  async reload(name = this.active?.name) {
    if (!name) return false;
    const wasRunning = !!this.active;
    if (wasRunning) await this.stop();
    await this.start(name);
    return true;
  }

  async scanBones(filter = '') {
    const ctx = await this._makeCtx();
    const f = filter.toLowerCase();
    return ctx.bones
      .map(b => b.name)
      .filter(n => !f || n.toLowerCase().includes(f))
      .sort();
  }

  _runLoop = (t=0) => {
    this._raf = requestAnimationFrame(this._runLoop);
    if (!this.active) return;
    const dt = Math.min(0.05, (t - this._last) / 1000 || 0);
    this._last = t;
    const { controller, ctx } = this.active;
    ctx.time += dt;
    try { controller.update?.(dt, ctx); } catch {}
  }
}

// small helper to provide THREE without an import in scripts
function awaitTHREE() { return Promise.resolve(window.THREE || null); }

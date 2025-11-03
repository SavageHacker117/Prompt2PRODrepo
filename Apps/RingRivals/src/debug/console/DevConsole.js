export class DevConsole {
  constructor({ context = {} } = {}) {
    this.ctx = context;
    this.handlers = new Map();

    this.root = document.createElement('div');
    this.root.id = 'devConsole';
    this.root.innerHTML = `
      <div class="dc-header">Dev Console <span class="dc-hint">(\` to toggle)</span></div>
      <div class="dc-output" id="dcOut"></div>
      <input class="dc-input" id="dcIn" placeholder="help · cam.mode fight · arena gym · time 0.5"/>
    `;
    document.body.appendChild(this.root);
    this.out = this.root.querySelector('#dcOut');
    this.input = this.root.querySelector('#dcIn');

    this.visible = false; this.root.style.display = 'none';

    addEventListener('keydown', (e) => {
      if (e.key === '`' && !e.ctrlKey && !e.metaKey) { this.toggle(); e.preventDefault(); return; }
      if (!this.visible) return;
      if (e.key === 'Enter') { this._run(this.input.value); this.input.value = ''; }
      if (e.key === 'Escape') { this.hide(); }
    });

    this.hist = []; this.hi = -1;
    this.input.addEventListener('keydown', (e)=>{
      if (e.key === 'ArrowUp')  { this.hi = Math.max(0, this.hi-1); this.input.value = this.hist[this.hi] ?? ''; e.preventDefault(); }
      if (e.key === 'ArrowDown'){ this.hi = Math.min(this.hist.length, this.hi+1); this.input.value = this.hist[this.hi] ?? ''; e.preventDefault(); }
    });

    window.__dev = this;
  }

  expose(name, value){ this.ctx[name] = value; }
  register(bundle){ Object.entries(bundle).forEach(([k,v])=> this.handlers.set(k, v)); }
  toggle(){ this.visible ? this.hide() : this.show(); }
  show(){ this.visible = true; this.root.style.display = 'block'; this.input.focus(); }
  hide(){ this.visible = false; this.root.style.display = 'none'; }

  log(msg){ const d=document.createElement('div'); d.textContent = msg; this.out.appendChild(d); this.out.scrollTop = this.out.scrollHeight; }

  _run(line){
    const src = line.trim();
    if (!src) return;
    this.hist.push(src); this.hi = this.hist.length;
    const [cmd, ...args] = src.split(/\s+/);
    const fn = this.handlers.get(cmd);
    if (!fn) { this.log(`? unknown: ${cmd}`); return; }
    try { const res = fn(args, this.ctx, this); if (res !== undefined) this.log(String(res)); }
    catch(err) { this.log('! ' + (err?.message ?? err)); }
  }
}

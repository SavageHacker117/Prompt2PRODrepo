// core/ScriptStudio.js
// Lightweight script manager + runner (localStorage backed).
// Depends on an optional BoneRuntime (tools/BoneRuntime.js). Gracefully degrades.

export class ScriptStudio {
  constructor(engine) {
    this.engine = engine;
    this.player = engine.player;
    this.rt = null;          // runtime instance (if available)
    this.currName = null;
    this.scripts = {};       // name -> source

    // UI
    this.root = document.createElement('div');
    this.root.className = 'script-panel hidden';
    this.root.innerHTML = `
      <div class="script-head">Scripts
        <div style="float:right;display:flex;gap:6px;">
          <button id="spClose">Close</button>
        </div>
      </div>
      <div class="script-row">
        <select id="spSelect" class="script-select"></select>
        <button id="spNew">New</button>
        <button id="spDel">Delete</button>
      </div>
      <div class="script-row">
        <button id="spRun">Run</button>
        <button id="spStop">Stop</button>
        <button id="spSave">Save</button>
        <button id="spSample">Load Sample: wave</button>
        <button id="spScan">Scan Bones</button>
      </div>
      <textarea id="spCode" spellcheck="false"></textarea>
      <pre id="spBones" class="script-bones"></pre>
    `;
    document.body.appendChild(this.root);

    // refs
    this.sel   = this.root.querySelector('#spSelect');
    this.btnNew = this.root.querySelector('#spNew');
    this.btnDel = this.root.querySelector('#spDel');
    this.btnRun = this.root.querySelector('#spRun');
    this.btnStop = this.root.querySelector('#spStop');
    this.btnSave = this.root.querySelector('#spSave');
    this.btnSample = this.root.querySelector('#spSample');
    this.btnScan = this.root.querySelector('#spScan');
    this.btnClose = this.root.querySelector('#spClose');
    this.code  = this.root.querySelector('#spCode');
    this.bones = this.root.querySelector('#spBones');

    // events
    this.btnClose.onclick = () => this.hide();
    this.btnNew.onclick   = () => this.newScript();
    this.btnDel.onclick   = () => this.deleteScript();
    this.btnSave.onclick  = () => this.saveScript();
    this.btnRun.onclick   = () => this.run();
    this.btnStop.onclick  = () => this.stop();
    this.btnSample.onclick= () => this.loadSample();
    this.btnScan.onclick  = () => this.scanBones();
    this.sel.onchange     = () => this.loadSelected();

    // storage
    this._loadFromStorage();
    this._refreshSelect();
  }

  // ---------- storage ----------
  _key(name){ return `vr.script.${name}`; }
  _loadFromStorage() {
    this.scripts = {};
    Object.keys(localStorage).forEach(k=>{
      if (k.startsWith('vr.script.')) {
        const name = k.slice('vr.script.'.length);
        this.scripts[name] = localStorage.getItem(k) || '';
      }
    });
  }
  _refreshSelect() {
    this.sel.innerHTML = '';
    const names = Object.keys(this.scripts).sort();
    for (const n of names) {
      const opt = document.createElement('option');
      opt.value = opt.textContent = n;
      this.sel.appendChild(opt);
    }
    if (!names.length) {
      this.newScript('wave');
      this.loadSample(); // give the user something to start with
    } else {
      this.sel.selectedIndex = 0;
      this.loadSelected();
    }
  }

  newScript(name) {
    const base = name || `script_${Math.floor(Math.random()*1000)}`;
    let n = base, i = 1;
    while (this.scripts[n]) n = `${base}_${i++}`;
    this.scripts[n] = '';
    localStorage.setItem(this._key(n), '');
    this._refreshSelect();
    this.selectByName(n);
  }
  deleteScript() {
    const n = this.sel.value;
    if (!n) return;
    delete this.scripts[n];
    localStorage.removeItem(this._key(n));
    this._refreshSelect();
  }
  selectByName(n){
    const idx = [...this.sel.options].findIndex(o=>o.value===n);
    if (idx>=0) { this.sel.selectedIndex = idx; this.loadSelected(); }
  }
  loadSelected() {
    this.currName = this.sel.value || null;
    this.code.value = this.currName ? (this.scripts[this.currName] ?? '') : '';
  }
  saveScript() {
    if (!this.currName) return;
    this.scripts[this.currName] = this.code.value;
    localStorage.setItem(this._key(this.currName), this.code.value);
  }

  // ---------- utils ----------
  scanBones() {
    const arr = [];
    this.player?.model?.traverse(o=>{
      if (o.isBone) arr.push(o.name);
    });
    this.bones.textContent = arr.length ? `Bones (${arr.length})\n- ${arr.join('\n- ')}` : 'No bones found (is the model loaded?)';
  }

  loadSample() {
    this.code.value =
`// Wave sample — rotates any bone whose name includes "arm"
// API (rt):
//   rt.findBones(pattern) -> Bone[]
//   rt.setBoneEuler(bone, {x,y,z})  (radians)
//   rt.time (seconds)
const arms = rt.findBones(/arm/i);
for (const b of arms) {
  const ang = Math.sin(rt.time * 4.0) * 0.5; // ±0.5 rad
  rt.setBoneEuler(b, { x: 0, y: 0, z: ang });
}`;
    this.saveScript();
  }

  // ---------- runtime ----------
  _ensureRuntime() {
    if (this.rt) return true;
    // Try to lazy-import BoneRuntime if present
    try {
      // eslint-disable-next-line no-undef
      const { BoneRuntime } = window.__BoneRuntime ?? {};
      if (BoneRuntime) {
        this.rt = new BoneRuntime(this.player?.model);
        return true;
      }
    } catch(_) {}
    // Minimal inline runtime if none provided
    this.rt = new (class {
      constructor(model){ this.model = model; this.time = 0; }
      update(dt){ this.time += dt; }
      findBones(re){ const out=[]; this.model?.traverse(o=>{ if (o.isBone && re.test(o.name)) out.push(o); }); return out; }
      setBoneEuler(b,{x=0,y=0,z=0}){ if(b){ b.rotation.set(x,y,z); b.updateMatrixWorld(); } }
    })(this.player?.model);
    return true;
  }

  run()  { this.saveScript(); this._ensureRuntime(); this._compile(); this.running = true; }
  stop() { this.running = false; }

  _compile() {
    const src = this.code.value || '';
    // create function(rt){ /* user code */ }
    this.fn = new Function('rt', src);
  }

  update(dt) {
    if (!this.running) return;
    try {
      this.rt.update(dt);
      if (this.fn) this.fn(this.rt);
    } catch (e) {
      console.warn('[ScriptStudio] script error:', e);
      this.running = false;
    }
  }

  // ---------- ui ----------
  show(){ this.root.classList.remove('hidden'); }
  hide(){ this.root.classList.add('hidden'); }
  toggle(){ this.root.classList.toggle('hidden'); }
}

// core/ScriptPanel.js
// Draggable / resizable Script IDE for Motion & Procedural scripts.
// - Motion: bone-target keyframe rot scripting (JSON)
// - Procedural: on-the-fly ES module code with ctx { THREE, scene, camera, engine, import(), log() }
// Supports docking the AnimPanel inside this panel.

const POS_KEY  = 'vineRunner.scriptPanel.pos';
const SIZE_KEY = 'vineRunner.scriptPanel.size';
const DOCK_KEY = 'vineRunner.scriptPanel.dockAnim';
const TAB_KEY  = 'vineRunner.scriptPanel.tab';   // 'motion' | 'proc'

function groupForBoneName(n) {
  const s = n.toLowerCase();
  const L = /\b(l_|_l\b|left)/.test(s), R = /\b(r_|_r\b|right)/.test(s);
  const side = L ? 'L ' : R ? 'R ' : '';
  if (/pelvis|hips?|root|boneroot/.test(s)) return 'Root';
  if (/spine|abdomen|chest|waist/.test(s)) return 'Spine';
  if (/neck|head|jaw|tongue|eye|teeth|ear/.test(s)) return 'Head / Face';
  if (/(clavicle|upperarm|shoulder)/.test(s)) return `${side}Shoulder`;
  if (/(forearm|elbow)/.test(s)) return `${side}Arm`;
  if (/(hand|wrist)/.test(s)) return `${side}Hand`;
  if (/(thumb|index|middle|ring|pinky|finger)/.test(s)) return `${side}Fingers`;
  if (/(thigh)/.test(s)) return `${side}Thigh`;
  if (/(calf|knee)/.test(s)) return `${side}Calf`;
  if (/(foot|ankle)/.test(s)) return `${side}Foot`;
  if (/(toe)/.test(s)) return `${side}Toes`;
  return 'Other';
}

export class ScriptPanel {
  /**
   * @param {import('./ScriptRuntime.js').ScriptRuntime} runtime
   * @param {{animPanel?: any}} opts
   */
  constructor(runtime, opts = {}) {
    this.runtime   = runtime;
    this.animPanel = opts.animPanel || null;

    // DOM
    this.root = document.createElement('div');
    this.root.className = 'script-panel hidden';
    this.root.innerHTML = `
      <div class="sp-head js-drag">
        <span>Scripts</span>
        <div class="sp-actions">
          <button data-act="scan" title="Scan skeleton">Scan</button>
          ${this.animPanel ? '<button data-act="dock" title="Dock/undock Anim Panel">Dock Anim</button>' : ''}
          <button data-act="close" title="Close">✕</button>
        </div>
      </div>

      <!-- Tabs -->
      <div class="sp-tabs">
        <button class="sp-tab on" data-tab="motion">Motion</button>
        <button class="sp-tab" data-tab="proc">Procedural</button>
      </div>

      <!-- Common row: script list + CRUD -->
      <div class="sp-row">
        <select class="sp-select"></select>
        <div class="sp-btns">
          <button data-act="newMotion" title="New motion script">New Motion</button>
          <button data-act="newProc"   title="New procedural script">New Proc</button>
          <button data-act="dup">Duplicate</button>
          <button data-act="del">Delete</button>
        </div>
      </div>

      <!-- MOTION EDITOR -->
      <div class="sp-pane sp-pane-motion">
        <div class="sp-row">
          <label>Target bone</label>
          <input class="sp-filter" placeholder="filter..." />
          <select class="sp-bone" size="8"></select>
        </div>
        <div class="sp-row">
          <label><input type="checkbox" class="sp-loop" checked> Loop</label>
          <select class="sp-mode">
            <option value="offset">Offset</option>
            <option value="absolute">Absolute</option>
          </select>
        </div>
        <div class="sp-row sp-editor">
          <textarea class="sp-json" spellcheck="false"></textarea>
        </div>
        <div class="sp-row">
          <button data-act="play">Play</button>
          <button data-act="stop">Stop</button>
          <button data-act="save">Save</button>
          <button data-act="export">Export</button>
          <input type="file" class="sp-import" accept="application/json,.json" style="display:none"/>
          <button data-act="import">Import</button>
          <button data-act="suggest" title="Suggest a bone for this motion">Suggest</button>
        </div>
        <div class="sp-hint">Motion JSON: {"name":"","kind":"motion","target":"BoneName","loop":true,"mode":"offset","frames":[{"t":0,"rot":[0,0,0]},...]}</div>
      </div>

      <!-- PROCEDURAL EDITOR -->
      <div class="sp-pane sp-pane-proc hidden">
        <div class="sp-row sp-editor">
          <textarea class="sp-code" spellcheck="false" placeholder="export default function(ctx){ /* build things, return { update(dt), dispose() } */ }"></textarea>
        </div>
        <div class="sp-row">
          <button data-act="play">Run</button>
          <button data-act="stop">Stop</button>
          <button data-act="save">Save</button>
          <button data-act="exportProc">Export</button>
          <input type="file" class="sp-import-proc" accept=".js,.mjs,text/javascript" style="display:none"/>
          <button data-act="importProc">Import</button>
        </div>
        <div class="sp-hint">Procedural module:
<pre style="white-space:pre-wrap;margin:6px 0 0 0;">export default function(ctx){
  const { THREE, scene, log } = ctx;
  // build scene content...
  return { update(dt){}, dispose(){} };
}</pre>
        </div>
      </div>

      ${this.animPanel ? '<div class="anim-dock"></div>' : ''}

      <div class="sp-resize" title="Resize"></div>
    `;
    document.body.appendChild(this.root);

    // refs
    this.sel     = this.root.querySelector('.sp-select');
    this.tabs    = Array.from(this.root.querySelectorAll('.sp-tab'));
    this.paneMotion = this.root.querySelector('.sp-pane-motion');
    this.paneProc   = this.root.querySelector('.sp-pane-proc');

    // Motion refs
    this.boneSel = this.root.querySelector('.sp-bone');
    this.filter  = this.root.querySelector('.sp-filter');
    this.taJson  = this.root.querySelector('.sp-json');
    this.loopEl  = this.root.querySelector('.sp-loop');
    this.modeEl  = this.root.querySelector('.sp-mode');
    this.file    = this.root.querySelector('.sp-import');

    // Proc refs
    this.taCode    = this.root.querySelector('.sp-code');
    this.fileProc  = this.root.querySelector('.sp-import-proc');

    // events
    this.root.addEventListener('click', (e) => {
      const tab = e.target.closest('.sp-tab');
      if (tab) { this._setTab(tab.getAttribute('data-tab')); return; }
      const btn = e.target.closest('button[data-act]');
      if (!btn) return;
      this._handle(btn.getAttribute('data-act'));
    });

    this.sel.addEventListener('change', () => this._loadSelected());
    this.filter.addEventListener('input', () => this._rebuildBoneList());

    // Motion handlers
    this.boneSel.addEventListener('change', () => {
      const s = this._current(); if (!s) return;
      if (s.kind !== 'motion') return;
      s.target = this.boneSel.value || '';
      this._renderScript(s);
    });
    this.loopEl.addEventListener('change', () => {
      const s = this._current(); if (!s) return;
      if (s.kind !== 'motion') return;
      s.loop = this.loopEl.checked;
      this._renderScript(s);
    });
    this.modeEl.addEventListener('change', () => {
      const s = this._current(); if (!s) return;
      if (s.kind !== 'motion') return;
      s.mode = this.modeEl.value;
      this._renderScript(s);
    });
    this.file.addEventListener('change', async () => {
      if (!this.file.files?.[0]) return;
      const text = await this.file.files[0].text();
      try {
        const obj = JSON.parse(text);
        const name = obj.name || `import_${Date.now()}`;
        this.runtime.add(name, { ...obj, kind: 'motion' });
        this.refresh();
        this.sel.value = name; this._loadSelected();
      } catch { alert('Invalid JSON'); }
      this.file.value = '';
    });

    // Proc handlers
    this.fileProc.addEventListener('change', async () => {
      if (!this.fileProc.files?.[0]) return;
      const text = await this.fileProc.files[0].text();
      // Accept either raw code or a {code:""} wrapper
      let code = text;
      try {
        const maybe = JSON.parse(text);
        if (maybe && typeof maybe.code === 'string') code = maybe.code;
      } catch {}
      const name = `proc_${Math.floor(Math.random() * 9999)}`;
      this.runtime.add(name, { name, kind: 'proc', code });
      this.refresh();
      this.sel.value = name; this._loadSelected();
      this.fileProc.value = '';
    });

    // drag / resize
    this._initDrag();
    this._initResize();

    // build initial list
    this.refresh();

    // restore dock + tab
    const dock = localStorage.getItem(DOCK_KEY);
    if (dock && this.animPanel) this._dockAnim(dock === '1');
    const savedTab = localStorage.getItem(TAB_KEY);
    this._setTab(savedTab || 'motion', false);

    window.scriptPanel = this; // quick devtools access
  }

  // visibility
  show(v = true) { this.root.classList.toggle('hidden', !v); }
  toggle() { this.show(this.root.classList.contains('hidden')); }

  // docking
  _dockAnim(v) {
    if (!this.animPanel) return;
    const dockEl = this.root.querySelector('.anim-dock');
    if (v) {
      dockEl.style.display = 'block';
      this.animPanel.root.classList.add('docked');
      this.animPanel.root.classList.remove('hidden');
      dockEl.appendChild(this.animPanel.root);
    } else {
      this.animPanel.root.classList.remove('docked');
      document.body.appendChild(this.animPanel.root);
      this.animPanel.root.classList.add('hidden');
    }
    localStorage.setItem(DOCK_KEY, v ? '1' : '0');
  }

  // tabs
  _setTab(tab, persist = true) {
    tab = (tab === 'proc') ? 'proc' : 'motion';
    this.tabs.forEach(b => b.classList.toggle('on', b.getAttribute('data-tab') === tab));
    this.paneMotion.classList.toggle('hidden', tab !== 'motion');
    this.paneProc.classList.toggle('hidden', tab !== 'proc');
    if (persist) localStorage.setItem(TAB_KEY, tab);
  }

  refresh() {
    // scripts list (sorted: motion first, then proc)
    const names = this.runtime.list().sort((a, b) => {
      const sa = this.runtime.get(a), sb = this.runtime.get(b);
      const ka = sa?.kind === 'proc' ? 1 : 0;
      const kb = sb?.kind === 'proc' ? 1 : 0;
      return ka - kb || a.localeCompare(b);
    });
    this.sel.innerHTML = names.map((n) => `<option value="${n}">${n}</option>`).join('');
    if (names.length) this.sel.value = names[0];

    // ensure skeleton is indexed for motion
    this.runtime.scanForSkeleton();
    this._rebuildBoneList();

    this._loadSelected();
  }

  _current() { return this.runtime.get(this.sel.value); }

  _renderScript(s) {
    if (!s) { this.taJson.value = ''; this.taCode.value = ''; return; }

    // Flip tab to match script kind
    this._setTab(s.kind === 'proc' ? 'proc' : 'motion');

    if (s.kind === 'motion') {
      this.loopEl.checked = s.loop !== false;
      this.modeEl.value = s.mode || 'offset';
      if (s.target && this.boneSel.querySelector(`option[value="${s.target}"]`))
        this.boneSel.value = s.target;
      this.taJson.value = JSON.stringify(s, null, 2);
    } else {
      this.taCode.value = s.code || '';
    }
  }

  _loadSelected() {
    const s = this._current();
    if (!s) { this.taJson.value = ''; this.taCode.value=''; return; }
    this._renderScript(s);
  }

  _rebuildBoneList() {
    const filter = (this.filter?.value || '').toLowerCase().trim();
    const names = Array.from(this.runtime.boneMap.keys()).sort();
    const groups = new Map();
    for (const n of names) {
      if (filter && !n.toLowerCase().includes(filter)) continue;
      const g = groupForBoneName(n);
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(n);
    }
    const parts = [];
    for (const [label, arr] of groups) {
      parts.push(`<optgroup label="${label}">`);
      for (const n of arr) parts.push(`<option value="${n}">${n}</option>`);
      parts.push(`</optgroup>`);
    }
    this.boneSel.innerHTML = parts.join('');
  }

  // CRUD + actions
  _handle(act) {
    const selected = this.sel.value;
    const script = this._current();

    // common actions
    if (act === 'scan') { this.runtime.scanForSkeleton(); this._rebuildBoneList(); return; }
    if (act === 'dock') { this._dockAnim(this.animPanel?.root?.parentElement !== this.root.querySelector('.anim-dock')); return; }
    if (act === 'close') { this.show(false); return; }

    if (act === 'newMotion') {
      const base = {
        name: 'motion_' + Math.floor(Math.random() * 9999),
        kind: 'motion',
        target: '',
        loop: true,
        mode: 'offset',
        frames: [{ t: 0, rot: [0, 0, 0] }, { t: 1, rot: [0, 0, 0] }],
      };
      this.runtime.add(base.name, base);
      this.refresh(); this.sel.value = base.name; this._loadSelected();
      return;
    }

    if (act === 'newProc') {
      const name = 'proc_' + Math.floor(Math.random() * 9999);
      const code = `export default function(ctx){
  const { THREE, scene, log } = ctx;
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color:'#46e4ff', roughness:0.6, metalness:0.0, flatShading:true });
  const geo = new THREE.IcosahedronGeometry(0.35, 0);
  const m = new THREE.Mesh(geo, mat); g.add(m); scene.add(g);
  log('${name}: online');
  return { update(dt){ g.rotation.y += dt; }, dispose(){ scene.remove(g); mat.dispose(); geo.dispose(); } };
}`;
      this.runtime.add(name, { name, kind: 'proc', code });
      this.refresh(); this.sel.value = name; this._loadSelected();
      return;
    }

    if (act === 'dup') {
      if (!script) return;
      const copy = JSON.parse(JSON.stringify(script));
      copy.name = script.name + '_copy';
      this.runtime.add(copy.name, copy);
      this.refresh(); this.sel.value = copy.name; this._loadSelected();
      return;
    }

    if (act === 'del') {
      if (!selected) return;
      if (!confirm(`Delete ${selected}?`)) return;
      this.runtime.remove(selected);
      this.refresh();
      return;
    }

    if (act === 'save') {
      if (!script) return;
      if (script.kind === 'motion') {
        try {
          const json = JSON.parse(this.taJson.value);
          const name = json.name || selected || 'motion_' + Date.now();
          json.kind = 'motion';
          if (selected && name !== selected) this.runtime.rename(selected, name);
          this.runtime.replace(name, json);
          this.refresh(); this.sel.value = name; this._loadSelected();
        } catch (e) { alert('Invalid JSON: ' + e.message); }
      } else {
        const code = String(this.taCode.value ?? '');
        const name = script.name || selected || 'proc_' + Date.now();
        this.runtime.replace(name, { name, kind: 'proc', code });
        this.refresh(); this.sel.value = name; this._loadSelected();
      }
      return;
    }

    if (act === 'export') { // motion export
      if (!script || script.kind !== 'motion') return;
      const blob = new Blob([JSON.stringify(script, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${script.name || 'motion'}.json`;
      a.click(); URL.revokeObjectURL(a.href);
      return;
    }

    if (act === 'exportProc') {
      if (!script || script.kind !== 'proc') return;
      const blob = new Blob([script.code || ''], { type: 'text/javascript' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${script.name || 'proc'}.mjs`;
      a.click(); URL.revokeObjectURL(a.href);
      return;
    }

    if (act === 'import') { this.file.click(); return; }
    if (act === 'importProc') { this.fileProc.click(); return; }

    if (act === 'play') { if (selected) this.runtime.start(selected); return; }
    if (act === 'stop') { if (selected) this.runtime.stop(selected); return; }

    if (act === 'suggest') {
      if (!script || script.kind !== 'motion') return;
      script.target = this.runtime.suggestBone('wave');
      this._renderScript(script);
      return;
    }
  }

  // ----- drag / resize support -----
  _initDrag() {
    const dragEl = this.root.querySelector('.js-drag');
    let ox = 0, oy = 0, dragging = false;

    const onMove = (e) => {
      if (!dragging) return;
      const x = e.clientX - ox, y = e.clientY - oy;
      this.root.style.left = `${x}px`;
      this.root.style.top = `${y}px`;
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      localStorage.setItem(POS_KEY, JSON.stringify({ left: this.root.style.left, top: this.root.style.top }));
    };

    dragEl.addEventListener('pointerdown', (e) => {
      dragging = true;
      const r = this.root.getBoundingClientRect();
      ox = e.clientX - r.left;
      oy = e.clientY - r.top;
      this.root.style.position = 'fixed';
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    });

    const pos = localStorage.getItem(POS_KEY);
    if (pos) {
      try {
        const p = JSON.parse(pos);
        this.root.style.position = 'fixed';
        this.root.style.left = p.left;
        this.root.style.top  = p.top;
      } catch {}
    }
  }

  _initResize() {
    const handle = this.root.querySelector('.sp-resize');
    let sx = 0, sy = 0, sw = 0, sh = 0, resizing = false;

    const onMove = (e) => {
      if (!resizing) return;
      const dw = e.clientX - sx;
      const dh = e.clientY - sy;
      this.root.style.width  = `${Math.max(320, sw + dw)}px`;
      this.root.style.height = `${Math.max(260, sh + dh)}px`;
    };
    const onUp = () => {
      if (!resizing) return;
      resizing = false;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      localStorage.setItem(SIZE_KEY, JSON.stringify({ width: this.root.style.width, height: this.root.style.height }));
    };

    handle.addEventListener('pointerdown', (e) => {
      resizing = true;
      const r = this.root.getBoundingClientRect();
      sx = e.clientX; sy = e.clientY; sw = r.width; sh = r.height;
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    });

    const size = localStorage.getItem(SIZE_KEY);
    if (size) {
      try {
        const s = JSON.parse(size);
        this.root.style.width  = s.width;
        this.root.style.height = s.height;
      } catch {}
    }
  }
}
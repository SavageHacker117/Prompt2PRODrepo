// core/PuppetPanel.js
import * as THREE from 'three';
import { analyzeSkeleton, attachSkeletonHelper } from '../tools/BoneInspector.js';

export class PuppetPanel {
  constructor(engine) {
    this.engine = engine;
    this.scene = engine.scene;
    this.camera = engine.camera;
    this.renderer = engine.renderer;

    this.player = null;          // set via bindTo()
    this.modelRoot = null;       // player.model
    this.skeleton = null;
    this.bones = [];
    this.helper = null;

    this.selection = new Set();  // Set<string bone.uuid>
    this.groups = this._loadGroups(); // {name: string: string[] uuids}
    this.markers = new Map();    // uuid -> {mesh, tag}

    this._v = new THREE.Vector3();

    // ------- UI -------
    this.root = document.createElement('div');
    this.root.className = 'anim-panel puppet-panel hidden'; // reuse anim-panel styles
    this.root.innerHTML = `
      <div class="anim-head">Puppet</div>

      <div class="anim-row">
        <input type="text" data-bind="filter" placeholder="filter bones…" style="flex:1">
        <button type="button" data-cmd="scan" title="Rescan skeleton">⟳</button>
        <label style="margin-left:6px"><input type="checkbox" data-bind="helper"> Helper</label>
        <label style="margin-left:6px"><input type="checkbox" data-bind="numbers"> #</label>
      </div>

      <div class="anim-row">
        <button type="button" data-cmd="selAll">All</button>
        <button type="button" data-cmd="selNone">None</button>
        <div style="flex:1"></div>
        <select class="grp" title="Groups" style="flex:1; min-width:120px"></select>
        <button type="button" data-cmd="grpSave" title="Save selection as group">+Grp</button>
        <button type="button" data-cmd="grpLoad" title="Select group">Use</button>
        <button type="button" data-cmd="grpDel" title="Delete group">Del</button>
      </div>

      <div class="bone-list" style="max-height:240px; overflow:auto; border:1px solid #334155; border-radius:8px; padding:6px;"></div>

      <div class="anim-row">
        <input type="text" class="rename" placeholder="rename (select exactly one)" style="flex:1">
        <button type="button" data-cmd="rename">Rename</button>
      </div>
    `;
    document.body.appendChild(this.root);

    this.elFilter = this.root.querySelector('[data-bind="filter"]');
    this.elList = this.root.querySelector('.bone-list');
    this.elGrp = this.root.querySelector('.grp');
    this.elRename = this.root.querySelector('.rename');

    // bone number tags container
    this.tagLayer = document.createElement('div');
    this.tagLayer.style.position = 'fixed';
    this.tagLayer.style.left = '0';
    this.tagLayer.style.top = '0';
    this.tagLayer.style.pointerEvents = 'none';
    this.tagLayer.style.zIndex = '9600';
    document.body.appendChild(this.tagLayer);

    // events
    this.root.addEventListener('input', (e) => {
      if (e.target === this.elFilter) this._rebuildList();
      if (e.target.matches('[data-bind="helper"]')) this._toggleHelper(e.target.checked);
      if (e.target.matches('[data-bind="numbers"]')) this._toggleNumbers(e.target.checked);
    });

    this.root.addEventListener('click', (e) => {
      const cmd = e.target.dataset.cmd;
      if (!cmd) return;
      if (cmd === 'scan') return this.scan();
      if (cmd === 'selAll') return this._selectAll();
      if (cmd === 'selNone') return this._selectNone();
      if (cmd === 'rename') return this._applyRename();
      if (cmd === 'grpSave') return this._groupSave();
      if (cmd === 'grpLoad') return this._groupLoad();
      if (cmd === 'grpDel') return this._groupDelete();
    });

    // click-away close
    document.addEventListener('mousedown', (e) => {
      if (this.isOpen() && !this.root.contains(e.target)) this.close();
    });

    this._raf = null;
    this._startTagLoop();

    this._refreshGroupSelect();
  }

  // ---------- Lifecycle / Binding ----------
  bindTo(player) {
    this.player = player || this.player;
    this.modelRoot = this.player?.model || null;
    this.scan();
  }

  open()  { this.root.classList.remove('hidden'); }
  close() { this.root.classList.add('hidden'); }
  toggle(){ this.isOpen() ? this.close() : this.open(); }
  isOpen(){ return !this.root.classList.contains('hidden'); }

  // ---------- Scan / Build ----------
  scan() {
    this._clearMarkers();
    this.skeleton = null;
    this.bones = [];
    this.selection.clear();

    if (!this.modelRoot) { this._rebuildList(); return; }

    const info = analyzeSkeleton(this.modelRoot);
    this.skeleton = info.skeleton;
    this.bones = info.bones || [];

    this._rebuildList();
    return { ok: !!this.skeleton, count: this.bones.length };
  }

  _rebuildList() {
    const q = (this.elFilter.value || '').toLowerCase();
    this.elList.innerHTML = '';

    if (!this.bones.length) {
      this.elList.innerHTML = `<div style="opacity:.75">No bones found. Load a skinned model and click ⟳.</div>`;
      return;
    }

    let idx = 1;
    for (const b of this.bones) {
      if (q && !b.name.toLowerCase().includes(q)) continue;

      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.gap = '8px';
      row.style.padding = '4px 2px';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = this.selection.has(b.uuid);
      cb.addEventListener('change', () => {
        if (cb.checked) this._select(b); else this._deselect(b);
      });

      const tag = document.createElement('span');
      tag.textContent = `${idx++}.`;
      tag.style.opacity = '.75';
      tag.style.minWidth = '20px';

      const name = document.createElement('span');
      name.textContent = b.name;
      name.style.flex = '1';
      name.style.cursor = 'pointer';
      name.addEventListener('click', () => { cb.checked = !cb.checked; cb.dispatchEvent(new Event('change')); });

      row.appendChild(cb);
      row.appendChild(tag);
      row.appendChild(name);
      this.elList.appendChild(row);
    }

    // prefill rename if single selection
    this._syncRenameField();
  }

  // ---------- Selection / Markers ----------
  _select(bone) {
    this.selection.add(bone.uuid);
    this._ensureMarker(bone);
    this._syncRenameField();
  }
  _deselect(bone) {
    this.selection.delete(bone.uuid);
    this._removeMarker(bone.uuid);
    this._syncRenameField();
  }
  _selectAll() {
    for (const b of this.bones) this._select(b);
    this._rebuildList();
  }
  _selectNone() {
    this.selection.clear();
    this._clearMarkers();
    this._rebuildList();
  }
  _syncRenameField() {
    if (this.selection.size === 1) {
      const uuid = [...this.selection][0];
      const bone = this.bones.find(b => b.uuid === uuid);
      this.elRename.value = bone ? bone.name : '';
    } else {
      this.elRename.value = '';
    }
  }

  // ---------- Helper / Numbers ----------
  _toggleHelper(on) {
    if (on) {
      if (!this.helper && this.modelRoot) {
        this.helper = attachSkeletonHelper(this.scene, this.modelRoot, 0x69d1ff);
        if (this.helper) this.helper.frustumCulled = false;
      }
    } else {
      if (this.helper) { this.scene.remove(this.helper); this.helper = null; }
    }
  }
  _toggleNumbers(on) {
    if (on) {
      // markers for ALL bones
      for (const b of this.bones) this._ensureMarker(b);
    } else {
      // keep only selected markers
      for (const [uuid] of this.markers) {
        if (!this.selection.has(uuid)) this._removeMarker(uuid);
      }
    }
  }

  // create or reuse marker for a bone (mesh + DOM tag)
  _ensureMarker(bone) {
    if (this.markers.has(bone.uuid)) return this.markers.get(bone.uuid);

    const geom = new THREE.SphereGeometry(0.03, 10, 10);
    const mat = new THREE.MeshStandardMaterial({ color: 0x20e0ff, emissive: 0x0b3a46, emissiveIntensity: 0.8 });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.name = `__boneMarker_${bone.name}`;
    bone.add(mesh);
    mesh.position.set(0, 0, 0);

    const tag = document.createElement('div');
    tag.className = 'bone-tag';
    tag.style.position = 'fixed';
    tag.style.padding = '2px 6px';
    tag.style.borderRadius = '999px';
    tag.style.fontSize = '11px';
    tag.style.fontWeight = '800';
    tag.style.background = 'rgba(17,24,39,.85)';
    tag.style.border = '1px solid #334155';
    tag.style.color = '#cdeffd';
    tag.style.transform = 'translate(-50%, -100%)';
    tag.style.pointerEvents = 'none';
    tag.textContent = bone.name || 'bone';
    this.tagLayer.appendChild(tag);

    this.markers.set(bone.uuid, { mesh, tag, bone });
    return { mesh, tag, bone };
  }

  _removeMarker(uuid) {
    const m = this.markers.get(uuid);
    if (!m) return;
    if (m.mesh?.parent) m.mesh.parent.remove(m.mesh);
    if (m.tag?.parentNode) m.tag.parentNode.removeChild(m.tag);
    this.markers.delete(uuid);
  }
  _clearMarkers() {
    for (const [uuid] of this.markers) this._removeMarker(uuid);
  }

  _startTagLoop() {
    const loop = () => {
      this._raf = requestAnimationFrame(loop);
      if (!this.camera || !this.renderer) return;

      const width = this.renderer.domElement.clientWidth || window.innerWidth;
      const height = this.renderer.domElement.clientHeight || window.innerHeight;

      for (const { bone, tag } of this.markers.values()) {
        if (!bone) continue;
        bone.getWorldPosition(this._v);
        this._v.project(this.camera);

        const x = ( this._v.x *  0.5 + 0.5) * width;
        const y = (-this._v.y *  0.5 + 0.5) * height;

        // hide if behind camera
        const visible = this._v.z < 1.0;
        tag.style.display = visible ? 'block' : 'none';
        if (visible) {
          tag.style.left = `${x}px`;
          tag.style.top  = `${y}px`;
        }
      }
    };
    loop();
  }

  // ---------- Rename ----------
  _applyRename() {
    if (this.selection.size !== 1) return;
    const newName = (this.elRename.value || '').trim();
    if (!newName) return;

    const uuid = [...this.selection][0];
    const bone = this.bones.find(b => b.uuid === uuid);
    if (!bone) return;

    bone.name = newName;
    // update any existing tag text
    const m = this.markers.get(uuid);
    if (m && m.tag) m.tag.textContent = newName;

    this._rebuildList();
  }

  // ---------- Groups ----------
  _loadGroups() {
    try { return JSON.parse(localStorage.getItem('puppet.groups') || '{}'); }
    catch { return {}; }
  }
  _saveGroups() {
    try { localStorage.setItem('puppet.groups', JSON.stringify(this.groups)); }
    catch {}
  }
  _refreshGroupSelect() {
    const sel = this.elGrp;
    sel.innerHTML = '';
    const names = Object.keys(this.groups).sort();
    for (const n of names) {
      const opt = document.createElement('option');
      opt.value = n; opt.textContent = n;
      sel.appendChild(opt);
    }
  }
  _groupSave() {
    const name = prompt('Group name?');
    if (!name) return;
    this.groups[name] = [...this.selection];
    this._saveGroups();
    this._refreshGroupSelect();
  }
  _groupLoad() {
    const name = this.elGrp.value;
    if (!name || !this.groups[name]) return;
    this.selection = new Set(this.groups[name]);
    // create markers for those bones
    for (const b of this.bones) {
      if (this.selection.has(b.uuid)) this._ensureMarker(b);
      else this._removeMarker(b.uuid);
    }
    this._rebuildList();
  }
  _groupDelete() {
    const name = this.elGrp.value;
    if (!name) return;
    delete this.groups[name];
    this._saveGroups();
    this._refreshGroupSelect();
  }
}

export default PuppetPanel;

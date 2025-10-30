// core/EditorTools.js
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';

export class EditorTools {
  /**
   * @param {{scene:THREE.Scene,camera:THREE.Camera,renderer?:THREE.WebGLRenderer}} engine
   */
  constructor(engine) {
    this.engine = engine;
    this.scene = engine.scene;
    this.camera = engine.camera;

    this.dom = engine.renderer?.domElement || document.getElementById('c');
    if (!this.dom) throw new Error('EditorTools: missing canvas/domElement');

    // --------- State ----------
    this.enabled = false;                     // Edit vs Play
    this.selection = new Set();               // Selected objects
    this.pickables = [];
    this.selected = null;

    // Snap values (held while Ctrl is down)
    this._snapTRS = {
      t: 0.5,                                  // 0.5 units translate
      r: THREE.MathUtils.degToRad(15),         // 15° rotate
      s: 0.1                                   // 0.1 scale
    };

    // Ignore helpers/pivot/etc.
    this.pickFilter = (obj) =>
      obj.isMesh && obj.visible !== false && obj.userData.noSelect !== true && obj.userData.__editor !== true;

    // --------- Orbit (zoom/pan/rotate) ----------
    this.orbit = new OrbitControls(this.camera, this.dom);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.08;
    this.orbit.enableZoom = true;
    this.orbit.enablePan  = true;
    this.orbit.mouseButtons.RIGHT = THREE.MOUSE.PAN;
    this.orbit.enabled = false;               // only in Edit Mode
    this.orbit.update();

    // --------- Transform gizmo ----------
    this.gizmo = new TransformControls(this.camera, this.dom);
    this.gizmo.setMode('translate');
    this.gizmo.setSize(0.9);
    this.gizmo.visible = false;               // only in Edit Mode
    this.scene.add(this.gizmo);

    // Disable orbit while dragging the gizmo
    this.gizmo.addEventListener('dragging-changed', (e) => {
      this.orbit.enabled = !e.value && this.enabled;
    });

    // Multi-translate support: move all by pivot delta
    this._pivot = new THREE.Group();
    this._pivot.name = '__editorPivot__';
    this._pivot.userData.__editor = true;
    this._lastPivotPos = new THREE.Vector3();

    this.gizmo.addEventListener('mouseDown', () => {
      if (this.gizmo.object === this._pivot) {
        this._lastPivotPos.copy(this._pivot.position);
      }
    });
    this.gizmo.addEventListener('objectChange', () => {
      if (!this.enabled) return;
      if (this.gizmo.object !== this._pivot) return;
      if (this.gizmo.getMode() !== 'translate') return;

      const delta = new THREE.Vector3().copy(this._pivot.position).sub(this._lastPivotPos);
      if (!delta.lengthSq()) return;
      for (const obj of this.selection) {
        if (obj === this._pivot) continue;
        obj.position.add(delta);
      }
      this._lastPivotPos.copy(this._pivot.position);
    });

    // --------- Picking ----------
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    // --------- UI ----------
    this._buildToolbar();              // tiny toolbar
    this._toolbarShow(false);

    // --------- Event handlers ----------
    this._onPointerDownCapture = this._onPointerDownCapture.bind(this);
    this._onKeyInEdit          = this._onKeyInEdit.bind(this);
    this._onKeyUpInEdit        = this._onKeyUpInEdit.bind(this);
    this._onGlobalKey          = this._onGlobalKey.bind(this);

    // Global: allow toggle (G) even in Play Mode
    window.addEventListener('keydown', this._onGlobalKey, true);

    // Populate pick list
    this.refreshPickables();
  }

  // ================= PUBLIC =================

  refreshPickables() {
    this.pickables.length = 0;
    this.scene.traverse(o => { if (this.pickFilter(o)) this.pickables.push(o); });
  }

  // Toggle Edit/Play
  toggle() { this.enabled ? this.disable() : this.enable(); }

  enable() {
    if (this.enabled) return;
    this.enabled = true;

    this.orbit.enabled = true;
    this.gizmo.visible = true;
    this._toolbarShow(true);

    // Capture pointer so gameplay clicks don’t fire
    this.dom.addEventListener('pointerdown', this._onPointerDownCapture, true);
    window.addEventListener('keydown', this._onKeyInEdit);
    window.addEventListener('keyup', this._onKeyUpInEdit);
  }

  disable() {
    if (!this.enabled) return;
    this.enabled = false;

    this.orbit.enabled = false;
    this.gizmo.visible = false;
    this.detach();
    this._clearSelection();

    this._toolbarShow(false);
    this.dom.removeEventListener('pointerdown', this._onPointerDownCapture, true);
    window.removeEventListener('keydown', this._onKeyInEdit);
    window.removeEventListener('keyup', this._onKeyUpInEdit);
  }

  setMode(mode) {                 // 'translate' | 'rotate' | 'scale'
    if (!['translate','rotate','scale'].includes(mode)) return;
    this.gizmo.setMode(mode);
    this._syncToolbar(mode);
    // Re-attach appropriately when mode changes
    this._attachToSelection();
  }

  setLocalSpace(isLocal = true) {
    this.gizmo.setSpace(isLocal ? 'local' : 'world');
    this._syncToolbar();
  }

  enableSnap(on = true) {
    this.gizmo.setTranslationSnap(on ? this._snapTRS.t : null);
    this.gizmo.setRotationSnap(on ? this._snapTRS.r : null);
    this.gizmo.setScaleSnap(on ? this._snapTRS.s : null);
  }

  detach() {
    this.gizmo.detach();
    this._syncToolbar();
  }

  update() { this.orbit.update(); }

  // ================= INTERNALS =================

  _buildToolbar() {
    const div = document.createElement('div');
    div.className = 'editor-toolbar';
    div.innerHTML = `
      <button data-m="translate" title="Move (W or 1)">Move</button>
      <button data-m="rotate"    title="Rotate (E or 2)">Rotate</button>
      <button data-m="scale"     title="Scale (R or 3)">Scale</button>
      <span class="sep"></span>
      <button data-space="local" title="Local/World (L)">Local</button>
      <button data-act="detach"  title="Detach (Q / Esc)">Detach</button>
      <span class="sep"></span>
      <span class="hint">Edit Mode (G to toggle) • Ctrl = Snap • Ctrl+Click = multi</span>
    `;
    document.body.appendChild(div);
    this.toolbar = div;

    div.addEventListener('click', (e) => {
      const m = e.target.getAttribute('data-m');
      if (m) { this.setMode(m); return; }
      if (e.target.getAttribute('data-act') === 'detach') { this.detach(); return; }
      if (e.target.getAttribute('data-space')) {
        const isLocal = this.gizmo.space !== 'local' ? true : false;
        this.setLocalSpace(isLocal);
      }
    });
    this._syncToolbar();
  }

  _toolbarShow(show) {
    if (!this.toolbar) return;
    this.toolbar.style.display = show ? 'flex' : 'none';
  }

  _syncToolbar(mode = this.gizmo.getMode()) {
    if (!this.toolbar) return;
    this.toolbar.querySelectorAll('button[data-m]').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-m') === mode);
    });
    const spaceBtn = this.toolbar.querySelector('button[data-space]');
    if (spaceBtn) spaceBtn.textContent = this.gizmo.space === 'local' ? 'Local' : 'World';
  }

  _canvasToNDC(event) {
    const rect = this.dom.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  _onPointerDownCapture(event) {
    if (!this.enabled) return;

    // Ignore clicks that start over your panels/console
    if (event.target.closest('.script-panel, .anim-panel, #dbg')) return;

    // If gizmo is being dragged, let it handle the event
    if (this.gizmo.dragging) return;

    // Raycast
    this._canvasToNDC(event);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(this.pickables, true)[0];

    if (!hit) {
      if (!event.ctrlKey) this._clearSelection();
      // prevent gameplay click in edit mode
      event.stopPropagation(); event.preventDefault();
      return;
    }

    // Select root-most object (unless an explicit root is marked)
    let obj = hit.object;
    while (obj && !obj.isObject3D) obj = obj.parent;
    while (obj?.parent && !obj.parent.isScene && !obj.userData?.selectRoot) obj = obj.parent;

    if (event.ctrlKey) {
      // Toggle in selection
      if (this.selection.has(obj)) {
        this._unhighlight(obj);
        this.selection.delete(obj);
      } else {
        this.selection.add(obj);
        this._highlight(obj);
      }
    } else {
      // Replace selection
      this._clearSelection();
      this.selection.add(obj);
      this._highlight(obj);
    }

    this._attachToSelection();

    // Stop event reaching gameplay (explode etc.)
    event.stopPropagation();
    event.preventDefault();
  }

  _attachToSelection() {
    if (this.selection.size === 0) { this.detach(); return; }

    // Many objects + translate → attach pivot at centroid
    if (this.selection.size > 1 && this.gizmo.getMode() === 'translate') {
      const centroid = new THREE.Vector3();
      for (const s of this.selection) centroid.add(s.getWorldPosition(new THREE.Vector3()));
      centroid.multiplyScalar(1 / this.selection.size);

      if (!this.scene.children.includes(this._pivot)) this.scene.add(this._pivot);
      this._pivot.position.copy(centroid);
      this._pivot.quaternion.identity();
      this._pivot.scale.set(1,1,1);

      this.gizmo.attach(this._pivot);
      return;
    }

    // Single object OR rotate/scale → attach directly
    const only = this.selection.values().next().value;
    this.gizmo.attach(only);
  }

  _clearSelection() {
    for (const s of this.selection) this._unhighlight(s);
    this.selection.clear();
    if (this.scene.children.includes(this._pivot)) this.scene.remove(this._pivot);
    this.detach();
  }

  _highlight(obj) {
    if (obj.userData.__editorHelper) return;
    const helper = new THREE.BoxHelper(obj, 0xffffff);
    helper.userData.__editor = true;
    obj.userData.__editorHelper = helper;
    this.scene.add(helper);
  }
  _unhighlight(obj) {
    const helper = obj.userData.__editorHelper;
    if (!helper) return;
    this.scene.remove(helper);
    helper.geometry?.dispose?.();
    helper.material?.dispose?.();
    delete obj.userData.__editorHelper;
  }

  // ---------- Keyboard ----------

  _onGlobalKey(e) {
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    if (e.code === 'KeyG') {
      this.toggle();
      e.preventDefault();
    }
  }

  _onKeyInEdit(e) {
    if (!this.enabled) return;

    const k = e.key.toLowerCase();

    // Modes (W/E/R and 1/2/3)
    if (k === 'w' || e.code === 'Digit1') { this.setMode('translate'); }
    else if (k === 'e' || e.code === 'Digit2') { this.setMode('rotate'); }
    else if (k === 'r' || e.code === 'Digit3') { this.setMode('scale'); }
    else if (k === 'q' || k === 'escape') { this.detach(); }
    else if (k === 'l') { this.setLocalSpace(this.gizmo.space !== 'local'); }

    // Snap on
    if (k === 'control') this.enableSnap(true);
  }

  _onKeyUpInEdit(e) {
    if (!this.enabled) return;
    if (e.key.toLowerCase() === 'control') this.enableSnap(false);
  }
}

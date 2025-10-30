// core/AnimationEditor.js
import * as THREE from 'three';

/**
 * Lightweight, in-game Animation Editor UI.
 * - Lists existing clips from Player (gltf animations + user-created)
 * - Transport: Play / Pause / Stop / Loop / Speed / Scrub
 * - Bone browser (auto-detected from skeleton)
 * - "Add Swing" generator: build a bone swinging clip (axis, amplitude, duration)
 * - Import / Export clips as JSON
 *
 * Toggle UI: press F4 (or call editor.show(true/false))
 */
export class AnimationEditor {
  constructor(player) {
    this.player = player;          // instance of your Player
    this.mixer = null;             // set when player.mixer appears
    this.currentAction = null;
    this.userClips = [];           // locally created clips (procedural / imported)
    this._raf = null;

    // DOM
    this.root = document.createElement('div');
    this.root.className = 'anim-editor hidden';
    this.root.innerHTML = `
      <div class="anim-head">
        <strong>Animation Editor</strong>
        <div class="anim-right">
          <label class="toggle"><input type="checkbox" id="aeLoop" checked> Loop</label>
          <button id="aeClose" title="Hide (F4)">×</button>
        </div>
      </div>

      <div class="anim-sec">
        <label class="anim-lbl">Library</label>
        <select id="aeClips" size="6" class="full"></select>
        <div class="row gap">
          <button id="aePlay">Play</button>
          <button id="aePause">Pause</button>
          <button id="aeStop">Stop</button>
        </div>
        <div class="row gap">
          <label>Speed <input id="aeSpeed" type="number" step="0.1" min="0.1" value="1.0" class="w80"></label>
          <span id="aeTime" class="dim">0.00 / 0.00</span>
        </div>
        <input id="aeScrub" type="range" min="0" max="0" step="0.001" value="0">
      </div>

      <div class="anim-sec">
        <label class="anim-lbl">Bones</label>
        <select id="aeBones" size="6" class="full"></select>

        <div class="row gap">
          <label>Axis
            <select id="aeAxis" class="w80">
              <option value="x">X</option>
              <option value="y" selected>Y</option>
              <option value="z">Z</option>
            </select>
          </label>
          <label>Amplitude°
            <input id="aeAmp" type="number" class="w80" value="25">
          </label>
          <label>Duration s
            <input id="aeDur" type="number" class="w80" value="1.5" step="0.1" min="0.1">
          </label>
        </div>
        <div class="row gap">
          <input id="aeNewName" class="full" type="text" placeholder="New clip name (e.g. swing_R_arm)">
        </div>
        <div class="row gap">
          <button id="aeMake">➕ Add Swing</button>
          <button id="aeDelete">🗑️ Delete Clip</button>
        </div>
      </div>

      <div class="anim-sec">
        <div class="row gap">
          <button id="aeExport">Export JSON</button>
          <label class="btnlike">
            Import JSON <input id="aeImport" type="file" accept=".json" hidden>
          </label>
        </div>
      </div>
    `;
    document.body.appendChild(this.root);

    // Grab elements
    const $ = (id) => this.root.querySelector(id);
    this.el = {
      close:  $('#aeClose'),
      loop:   $('#aeLoop'),
      clips:  $('#aeClips'),
      play:   $('#aePlay'),
      pause:  $('#aePause'),
      stop:   $('#aeStop'),
      speed:  $('#aeSpeed'),
      time:   $('#aeTime'),
      scrub:  $('#aeScrub'),
      bones:  $('#aeBones'),
      axis:   $('#aeAxis'),
      amp:    $('#aeAmp'),
      dur:    $('#aeDur'),
      make:   $('#aeMake'),
      del:    $('#aeDelete'),
      newNm:  $('#aeNewName'),
      exp:    $('#aeExport'),
      imp:    $('#aeImport'),
    };

    // Wire UI
    this.el.close.addEventListener('click', () => this.show(false));
    window.addEventListener('keydown', (e) => { if (e.key === 'F4') this.toggle(); });

    this.el.play.addEventListener('click', () => this.playSelected());
    this.el.pause.addEventListener('click', () => this.pause());
    this.el.stop.addEventListener('click', () => this.stop());

    this.el.speed.addEventListener('input', () => {
      const s = Math.max(0.01, parseFloat(this.el.speed.value) || 1);
      if (this.currentAction) this.currentAction.setEffectiveTimeScale(s);
    });

    this.el.scrub.addEventListener('input', () => this.scrubTo(parseFloat(this.el.scrub.value) || 0));

    this.el.make.addEventListener('click', () => this.makeSwing());
    this.el.del.addEventListener('click', () => this.deleteSelected());

    this.el.exp.addEventListener('click', () => this.exportSelected());
    this.el.imp.addEventListener('change', (e) => this.importClip(e));

    // Periodically sync when the player model appears
    this._pollForMixer();
    this._tick();
  }

  // ---------- visibility ----------
  show(v = true) {
    this.root.classList.toggle('hidden', !v);
  }
  hide() { this.show(false); }
  toggle() { this.root.classList.toggle('hidden'); }

  // ---------- player/mixer discovery ----------
  _pollForMixer() {
    const tryBind = () => {
      if (this.player && this.player.mixer && this.player.model) {
        this.mixer = this.player.mixer;
        this.refreshClips();
        this.refreshBones();
        return true;
      }
      return false;
    };
    if (!tryBind()) {
      setTimeout(() => this._pollForMixer(), 300);
    }
  }

  refreshClips() {
    const clips = [...(this.player?.clips || []), ...this.userClips];
    const sel = this.el.clips;
    sel.innerHTML = '';
    clips.forEach((c, i) => {
      const o = document.createElement('option');
      o.value = i.toString();
      o.textContent = `${c.name || '(unnamed)'}  — ${c.duration.toFixed(2)}s`;
      sel.appendChild(o);
    });
    sel.dataset.count = clips.length.toString();
    // update scrub max
    const c = this.getSelectedClip();
    this.el.scrub.max = c ? String(Math.max(0.001, c.duration)) : '0';
  }

  refreshBones() {
    const bones = this._getBones();
    const sel = this.el.bones;
    sel.innerHTML = '';
    bones.forEach((b, i) => {
      const o = document.createElement('option');
      o.value = i.toString();
      o.textContent = b.name || `bone_${i}`;
      sel.appendChild(o);
    });
  }

  _getBones() {
    // Prefer a SkinnedMesh skeleton; otherwise traverse child objects.
    const bones = [];
    if (!this.player?.model) return bones;

    this.player.model.traverse((o) => {
      // Collect skeletal bones
      if (o.isBone) bones.push(o);
    });

    if (bones.length === 0) {
      // Fallback: any named children — still usable for simple object tracks
      this.player.model.traverse((o) => {
        if ((o.isObject3D || o.isMesh) && o !== this.player.model && o.name) bones.push(o);
      });
    }
    return bones;
  }

  // ---------- transport ----------
  getClipsAll() {
    return [...(this.player?.clips || []), ...this.userClips];
  }
  getSelectedClip() {
    const idx = parseInt(this.el.clips.value, 10);
    const all = this.getClipsAll();
    return Number.isFinite(idx) ? all[idx] || null : null;
  }

  playSelected() {
    const clip = this.getSelectedClip();
    if (!clip || !this.mixer) return;

    // Stop current
    this.stop();

    const root = this.player.model;
    const action = this.mixer.clipAction(clip, root);
    action.reset();
    action.clampWhenFinished = !this.el.loop.checked;
    action.setLoop(this.el.loop.checked ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    action.setEffectiveTimeScale(Math.max(0.01, parseFloat(this.el.speed.value) || 1));
    action.play();
    this.currentAction = action;

    // sync scrub
    this.el.scrub.max = String(Math.max(0.001, clip.duration));
  }

  pause() {
    if (this.currentAction) {
      this.currentAction.paused = !this.currentAction.paused;
    }
  }
  stop() {
    if (this.currentAction) {
      this.currentAction.stop();
      this.currentAction = null;
    }
  }

  scrubTo(t) {
    const clip = this.getSelectedClip();
    if (!clip || !this.mixer) return;
    // Ensure an action exists for previewing
    if (!this.currentAction) {
      this.currentAction = this.mixer.clipAction(clip, this.player.model);
      this.currentAction.play();
      this.currentAction.paused = true;
    }
    this.currentAction.paused = true;
    this.currentAction.time = THREE.MathUtils.clamp(t, 0, clip.duration);
    // force update
    this.mixer.update(0);
  }

  // ---------- create/delete ----------
  makeSwing() {
    if (!this.player?.model) return;
    const bones = this._getBones();
    const bIdx = Math.max(0, parseInt(this.el.bones.value || '0', 10));
    const bone = bones[bIdx];
    if (!bone) return;

    const axis = this.el.axis.value || 'y';
    const ampDeg = parseFloat(this.el.amp.value) || 25;
    const duration = Math.max(0.1, parseFloat(this.el.dur.value) || 1.5);
    const name = (this.el.newNm.value || `${bone.name || 'bone'}_swing_${axis}`).trim();

    // Build quaternion keys: base -> rotated -> base
    const base = bone.quaternion.clone();
    const axisVec = axis === 'x' ? new THREE.Vector3(1,0,0)
                   : axis === 'y' ? new THREE.Vector3(0,1,0)
                                   : new THREE.Vector3(0,0,1);
    const qMid = base.clone().multiply(new THREE.Quaternion().setFromAxisAngle(axisVec, THREE.MathUtils.degToRad(ampDeg)));

    const times = [0, duration * 0.5, duration];
    const values = [
      base.x, base.y, base.z, base.w,
      qMid.x, qMid.y, qMid.z, qMid.w,
      base.x, base.y, base.z, base.w,
    ];

    // Track name uses the object (bone) name + property
    const tName = `${bone.name}.quaternion`;
    const track = new THREE.QuaternionKeyframeTrack(tName, times, values);
    const clip = new THREE.AnimationClip(name, duration, [track]);

    this.userClips.push(clip);
    this.refreshClips();

    // Select & play it
    const idx = this.getClipsAll().indexOf(clip);
    if (idx >= 0) {
      this.el.clips.value = String(idx);
      this.playSelected();
    }
  }

  deleteSelected() {
    const clip = this.getSelectedClip();
    if (!clip) return;
    // Can only delete userClips; ignore built-in glTF clips
    const i = this.userClips.indexOf(clip);
    if (i >= 0) {
      if (this.currentAction) this.stop();
      this.userClips.splice(i, 1);
      this.refreshClips();
    }
  }

  // ---------- import / export ----------
  exportSelected() {
    const clip = this.getSelectedClip();
    if (!clip) return;
    const json = THREE.AnimationClip.toJSON(clip);
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.download = `${(clip.name || 'clip')}.json`;
    a.href = URL.createObjectURL(blob);
    a.click();
    URL.revokeObjectURL(a.href);
  }

  importClip(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        const clip = THREE.AnimationClip.parse(data);
        this.userClips.push(clip);
        this.refreshClips();
      } catch (err) {
        console.error('Invalid clip JSON:', err);
      } finally {
        this.el.imp.value = '';
      }
    };
    reader.readAsText(file);
  }

  // ---------- small UI heartbeat ----------
  _tick = () => {
    if (this.mixer && this.currentAction) {
      const c = this.getSelectedClip();
      if (c) {
        const t = this.currentAction.time;
        const d = c.duration;
        this.el.time.textContent = `${t.toFixed(2)} / ${d.toFixed(2)}`;
        // keep scrub in sync when playing
        if (!this.currentAction.paused) {
          this.el.scrub.value = String(Math.min(d, t));
        }
      }
    }
    this._raf = requestAnimationFrame(this._tick);
  };

  // ---------- helpers ----------
  dispose() {
    cancelAnimationFrame(this._raf);
    this.root.remove();
  }
}

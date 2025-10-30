// core/ScriptRuntime.js
import * as THREE from 'three';

const LS_KEY = 'vineRunner.scripts.v2';

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const lerp = (a, b, t) => a + (b - a) * t;
const lerpV3 = (a, b, t) =>
  new THREE.Vector3(lerp(a.x, b.x, t), lerp(a.y, b.y, t), lerp(a.z, b.z, t));

function findFirstSkinned(scene) {
  let found = null;
  scene.traverse((o) => { if (!found && o.isSkinnedMesh) found = o; });
  return found;
}

// very light heuristic to “guess” good bones for typical actions
function scoreBoneForWave(name) {
  const n = name.toLowerCase();
  let s = 0;
  if (/(hand|wrist)/.test(n)) s += 100;
  if (/(forearm)/.test(n)) s += 30;
  if (/(clavicle|upperarm|arm)/.test(n)) s += 10;
  if (/thumb|index|middle|ring|pinky|toe|calf|thigh|pelvis|spine|neck|head/.test(n)) s -= 50;
  if (/\b_r_|\br_/.test(n)) s += 8;      // prefer right side for a wave
  if (/\b_l_|\bl_/.test(n)) s += 4;      // but left is fine too
  return s;
}

/*
  Script shapes:

  1) Motion script
     {
       name, kind: 'motion',
       target, loop, mode: 'offset' | 'absolute',
       frames: [{ t, rot: [x,y,z] }, ...]
     }

  2) Procedural script
     {
       name, kind: 'proc',
       // ES module source code (string). Must export a default factory:
       //   export default function(ctx) { return { update(dt){}, dispose(){} } }
       code: "..."
     }
*/
export class ScriptRuntime {
  /** @param {THREE.Scene} scene */
  constructor(scene) {
    this.scene = scene;

    // persistence
    this.scripts = new Map();          // name -> script
    this.loadFromStorage();

    // skeleton/bones
    this.skinned = null;
    this.skeleton = null;
    this.boneMap = new Map();          // name -> Bone

    // running states
    this.activeMotion = new Map();     // name -> {t, bone, script}
    this.activeProc   = new Map();     // name -> {moduleURL, inst:{update?,dispose?}}
  }

  /** Try to locate a SkinnedMesh and index its bones */
  scanForSkeleton() {
    this.skinned = findFirstSkinned(this.scene) || null;
    this.skeleton = this.skinned?.skeleton || null;
    this.boneMap.clear();
    if (this.skeleton) {
      for (const b of this.skeleton.bones) this.boneMap.set(b.name, b);
    }
    return { ok: !!this.skeleton, count: this.boneMap.size };
  }

  /** Simple “what bone should I use for …?” */
  suggestBone(purpose = 'wave') {
    if (!this.boneMap.size) this.scanForSkeleton();
    const names = Array.from(this.boneMap.keys());
    if (purpose === 'wave') {
      names.sort((a, b) => scoreBoneForWave(b) - scoreBoneForWave(a));
      return names[0] || '';
    }
    return names[0] || '';
  }

  /** Persist all scripts */
  saveToStorage() {
    try {
      const obj = {};
      for (const [k, v] of this.scripts) obj[k] = v;
      localStorage.setItem(LS_KEY, JSON.stringify(obj));
    } catch {}
  }

  /** Load scripts and seed examples if none */
  loadFromStorage() {
    this.scripts.clear();
    let hadAny = false;
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const obj = JSON.parse(raw);
        for (const k of Object.keys(obj)) { this.scripts.set(k, obj[k]); hadAny = true; }
      }
    } catch {}

    if (!hadAny) {
      // seed a motion example
      this.scripts.set('wave', {
        name: 'wave',
        kind: 'motion',
        target: '',         // UI will fill using suggestBone('wave')
        loop: true,
        mode: 'offset',     // 'offset' | 'absolute'
        frames: [
          { t: 0.00, rot: [0, 0.00, 0] },
          { t: 0.25, rot: [0, 0.60, 0] },
          { t: 0.50, rot: [0, 0.00, 0] },
          { t: 0.75, rot: [0, 0.60, 0] },
          { t: 1.00, rot: [0, 0.00, 0] },
        ],
      });

      // seed a procedural template
      this.scripts.set('hello_proc', {
        name: 'hello_proc',
        kind: 'proc',
        code:
`export default function(ctx){
  const { THREE, scene, log } = ctx;
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#46e4ff', roughness: 0.6, metalness: 0.0, flatShading: true });
  const geo = new THREE.IcosahedronGeometry(0.35, 0);
  const m = new THREE.Mesh(geo, mat);
  group.add(m);
  scene.add(group);
  log('hello_proc: added a shiny friend.');
  return {
    update(dt){ group.rotation.y += dt; },
    dispose(){ scene.remove(group); mat.dispose(); geo.dispose(); }
  };
}`
      });

      this.saveToStorage();
    }

    // upgrade older motion scripts (missing kind)
    for (const [k, v] of this.scripts) {
      if (!v.kind) v.kind = v.frames ? 'motion' : 'proc';
    }
    this.saveToStorage();
  }

  list() { return Array.from(this.scripts.keys()); }
  get(name) { return this.scripts.get(name) || null; }
  add(name, script) { this.scripts.set(name, script); this.saveToStorage(); }
  remove(name) {
    this.stop(name);
    this.scripts.delete(name);
    this.saveToStorage();
  }
  rename(oldName, newName) {
    if (!this.scripts.has(oldName)) return false;
    if (this.scripts.has(newName)) return false;
    const s = this.scripts.get(oldName);
    this.scripts.delete(oldName);
    s.name = newName;
    this.scripts.set(newName, s);
    this.saveToStorage();
    return true;
  }
  replace(name, script) {
    this.scripts.set(name, script);
    this.saveToStorage();
    if (this.activeMotion.has(name) || this.activeProc.has(name)) { this.stop(name); this.start(name); }
  }

  // ---- start/stop (dispatch by kind) ----
  start(name) {
    const s = this.get(name); if (!s) return false;
    return (s.kind === 'proc') ? this._startProc(name) : this._startMotion(name);
  }
  stop(name) {
    const s = this.get(name); if (!s) return;
    if (s.kind === 'proc') return this._stopProc(name);
    return this._stopMotion(name);
  }
  clear() {
    for (const k of [...this.activeMotion.keys(), ...this.activeProc.keys()]) this.stop(k);
  }

  // ---- motion implementation (existing, factored) ----
  _startMotion(name) {
    const s = this.get(name); if (!s) return false;
    if (!this.skeleton) this.scanForSkeleton();
    if (!s.target) s.target = this.suggestBone('wave');
    const bone = s.target ? this.boneMap.get(s.target) : null;
    if (!bone) return false;
    if (!bone.userData._baseRot) bone.userData._baseRot = bone.rotation.clone();
    this.activeMotion.set(name, { t: 0, bone, script: s });
    return true;
  }
  _stopMotion(name) {
    const st = this.activeMotion.get(name);
    if (st) {
      const base = st.bone.userData._baseRot;
      if (base) st.bone.rotation.copy(base);
      this.activeMotion.delete(name);
    }
  }

  // ---- procedural implementation (new) ----
  async _startProc(name) {
    const s = this.get(name); if (!s?.code) return false;

    // Compile the user's module via a blob URL and dynamic import
    const blob = new Blob([s.code], { type: 'text/javascript' });
    const moduleURL = URL.createObjectURL(blob);

    // Execution context (keep it small + explicit)
    const ctx = {
      THREE,
      scene: this.scene,
      camera: this.scene.userData?.__mainCamera ?? null,
      engine: this.scene.userData?.__engine ?? null,
      // Allow user modules to import local files without tripping Vite analysis
      import: (path) => import(/* @vite-ignore */ path),
      log: (...a) => console.log('[proc]', ...a),
    };

    try {
      // cache-bust so we can restart after edits; tell Vite not to analyze
      const mod = await import(/* @vite-ignore */ (moduleURL + `#t=${Date.now()}`));
      const factory = mod.default || mod.create || mod.init;
      if (typeof factory !== 'function') throw new Error('Module must export a default/init/create function.');
      const inst = await factory(ctx);
      this.activeProc.set(name, { moduleURL, inst: inst || {} });
      return true;
    } catch (e) {
      console.error('proc start failed:', e);
      URL.revokeObjectURL(moduleURL);
      return false;
    }
  }
  _stopProc(name) {
    const st = this.activeProc.get(name);
    if (st) {
      try { st.inst?.dispose?.(); } catch {}
      URL.revokeObjectURL(st.moduleURL);
      this.activeProc.delete(name);
    }
  }

  /** Called each frame */
  update(dt) {
    // motion
    if (this.activeMotion.size) {
      for (const [name, st] of this.activeMotion) {
        const s = st.script;
        const frames = (s.frames || []).slice().sort((a, b) => a.t - b.t);
        if (frames.length < 2) continue;

        st.t += dt;
        const duration = frames[frames.length - 1].t;
        let t = st.t;

        if (s.loop !== false) {
          if (duration > 0) t = st.t % duration;
        } else {
          t = Math.min(st.t, duration);
        }

        // find segment
        let i = 0;
        while (i < frames.length - 1 && !(t >= frames[i].t && t <= frames[i + 1].t)) i++;
        const a = frames[i], b = frames[Math.min(i + 1, frames.length - 1)];
        const segT = (b.t === a.t) ? 0 : clamp01((t - a.t) / (b.t - a.t));

        const av = new THREE.Vector3().fromArray(a.rot || [0, 0, 0]);
        const bv = new THREE.Vector3().fromArray(b.rot || [0, 0, 0]);
        const rv = lerpV3(av, bv, segT);

        if (s.mode === 'absolute') {
          st.bone.rotation.set(rv.x, rv.y, rv.z);
        } else {
          const base = st.bone.userData._baseRot || new THREE.Euler(0, 0, 0);
          st.bone.rotation.set(base.x + rv.x, base.y + rv.y, base.z + rv.z);
        }

        if (s.loop === false && st.t >= duration) this._stopMotion(name);
      }
    }

    // procedural
    if (this.activeProc.size) {
      for (const st of this.activeProc.values()) {
        try { st.inst?.update?.(dt); } catch {}
      }
    }
  }
}

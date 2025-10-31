import * as THREE from 'three';
import { hashString, clamp } from '../utils/SeedUtils.js';
import { buildPipelineField } from '../terrain/pipeline/TerrainPipeline.js';

const CHUNK_SIZE = 32;
const HEIGHT = 64;

export class WorldGenerator {
  constructor(materials, worldState) {
    this.materials = materials;
    this.worldState = worldState;

    // World seed & params (panel edits these)
    this.seed = 123456 >>> 0;
    this.params = {
      seaLevel: 8,        // waterline
      heightOffset: 0,    // adds/subtracts from base elevation
      amplitude: 28       // general vertical energy (mapped into pipeline)
    };

    // Streaming / culling controls
    this.viewRadius = 3;               // render distance in chunks
    this.worldMode = 'large';          // 'small' | 'large' | 'endless'
    this._modeBounds = { small: 6, large: 16 }; // half-extents in chunks

    // Scene nodes & caches
    this.group = new THREE.Group();
    this.chunks = new Map();
    this.overrides = new Map(); // `${wx},${wy},${wz}` -> material|string|null
    this.worldSpec = null;      // structured prompt spec, if used

    // Materials present in library (for instancing)
    this.matNames = Object.keys(materials.materials);

    this.boxGeo = new THREE.BoxGeometry(1, 1, 1);

    // initial field
    this._rebuildField();
  }

  getWorldGroup() { return this.group; }

  // ---- controls for UI (optional) ----
  setRenderRadius(n){ this.viewRadius = Math.max(1, Math.min(12, n|0)); this.invalidateAll(); }
  setWorldMode(mode){ this.worldMode = (mode === 'small' || mode === 'endless') ? mode : 'large'; this.invalidateAll(); }

  // ---- seeding / params -----------------------------------------------------

  async seedFromPrompt(prompt) {
    this.seed = hashString(String(prompt || '')) >>> 0;

    // optional structured spec
    this.worldSpec = null;
    try {
      const { parsePrompt } = await import('../grammar/userPromptsLang.js');
      this.worldSpec = parsePrompt(String(prompt || ''));
    } catch {}

    this._rebuildField();
    this.invalidateAll();
  }

  async seedFromImage(info) {
    this.seed = (info.seed | 0) >>> 0;
    this._rebuildField();   // hook lumInfo if you like
    this.invalidateAll();
  }

  setParams(partial) {
    Object.assign(this.params, partial || {});
    this._rebuildField();
  }

  invalidateAll() {
    for (const ch of this.chunks.values()) this.group.remove(ch.group);
    this.chunks.clear();
  }

  // ---- height field ---------------------------------------------------------

  _rebuildField(lumInfo = null) {
    const mappedParams = {
      seaLevel: this.params.seaLevel,
      amplitude: this.params.amplitude,
      baseLevel: 11 + (this.params.heightOffset | 0) // lift/lower baseline
    };

    let field;
    if (this.worldSpec) {
      field = buildPipelineField(this.seed, this.worldSpec, lumInfo);
      if (field?.params) {
        field.params.seaLevel  = this.params.seaLevel;
        field.params.baseLevel = 11 + (this.params.heightOffset | 0);
      }
    } else {
      field = buildPipelineField(this.seed, mappedParams, lumInfo);
    }
    this.splatField = field;
  }

  // quick helpers
  getSurfaceY(wx, wz) {
    return Math.floor(clamp(this.splatField.height(wx, wz), -8, HEIGHT - 1));
  }

  // ---- streaming chunks -----------------------------------------------------

  update(dt, cameraPos) {
    const cx = Math.floor(cameraPos.x / CHUNK_SIZE);
    const cy = Math.floor(cameraPos.z / CHUNK_SIZE);
    const radius = this.viewRadius;

    const wanted = new Set();
    for (let y = -radius; y <= radius; y++) {
      for (let x = -radius; x <= radius; x++) {
        const tx = cx + x, ty = cy + y;

        if (this.worldMode !== 'endless') {
          const bound = this._modeBounds[this.worldMode] ?? this._modeBounds.large;
          if (Math.abs(tx) > bound || Math.abs(ty) > bound) continue;
        }

        const k = tx + ',' + ty;
        wanted.add(k);
        this.ensureChunk(tx, ty);
      }
    }
    for (const [key, ch] of this.chunks) {
      if (!wanted.has(key)) {
        this.group.remove(ch.group);
        this.chunks.delete(key);
      }
    }
  }

  ensureChunk(cx, cy) {
    const key = cx + ',' + cy;
    if (this.chunks.has(key)) return;
    const chunk = this._generateChunk(cx, cy);
    this.chunks.set(key, chunk);
    this.group.add(chunk.group);
  }

  _getOverride(wx, wy, wz) {
    return this.overrides.get(`${wx},${wy},${wz}`);
  }

  _generateChunk(cx, cy) {
    const field = this.splatField;
    const waterLevel = (field && field.waterLevel != null)
      ? field.waterLevel
      : (this.params.seaLevel | 0);

    const group = new THREE.Group();
    group.position.set(cx * CHUNK_SIZE, 0, cy * CHUNK_SIZE);

    // 1) count instances
    const counts = {};
    for (const m of this.matNames) counts[m] = 0;

    const heightAt = (x, z) => field.height(x, z);

    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const wx = cx * CHUNK_SIZE + x;
        const wz = cy * CHUNK_SIZE + z;
        const h = Math.floor(clamp(heightAt(wx, wz), -8, HEIGHT - 1));
        const top = Math.max(0, h);

        for (let y = 0; y <= top; y++) {
          const ov = this._getOverride(wx, y, wz);
          if (ov === null) continue;
          const mat =
            (y === 0) ? 'basalt' :
            (typeof ov === 'string') ? ov :
            this._pickMaterial(wx, y, wz, top);
          counts[mat] = (counts[mat] || 0) + 1;
        }

        if (top < waterLevel) {
          for (let y = top + 1; y <= waterLevel; y++) {
            const ov = this._getOverride(wx, y, wz);
            if (ov === null) continue;
            const mat = (typeof ov === 'string') ? ov : 'water';
            counts[mat] = (counts[mat] || 0) + 1;
          }
        }
      }
    }

    // 2) create meshes
    const meshes = {};
    for (const [name, count] of Object.entries(counts)) {
      if (!count) continue;
      const mat = this.materials.get(name);
      if (!mat) continue;
      const mesh = new THREE.InstancedMesh(this.boxGeo, mat, count);
      mesh.castShadow = mesh.receiveShadow = true;
      meshes[name] = mesh;
      group.add(mesh);
    }

    // 3) fill matrices
    const cursor = {}; for (const k of Object.keys(meshes)) cursor[k] = 0;
    const m = new THREE.Matrix4();

    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const wx = cx * CHUNK_SIZE + x, wz = cy * CHUNK_SIZE + z;
        const h = Math.floor(clamp(heightAt(wx, wz), -8, HEIGHT - 1));
        const top = Math.max(0, h);

        for (let y = 0; y <= top; y++) {
          const ov = this._getOverride(wx, y, wz);
          if (ov === null) continue;
          const matName =
            (y === 0) ? 'basalt' :
            (typeof ov === 'string') ? ov :
            this._pickMaterial(wx, y, wz, top);
          const mesh = meshes[matName];
          if (!mesh) continue;
          m.makeTranslation(x, y, z);
          mesh.setMatrixAt(cursor[matName]++, m);
        }

        if (top < waterLevel) {
          for (let y = top + 1; y <= waterLevel; y++) {
            const ov = this._getOverride(wx, y, wz);
            if (ov === null) continue;
            const matName = (typeof ov === 'string') ? ov : 'water';
            const mesh = meshes[matName];
            if (!mesh) continue;
            m.makeTranslation(x, y, z);
            mesh.setMatrixAt(cursor[matName]++, m);
          }
        }
      }
    }

    for (const mesh of Object.values(meshes)) mesh.instanceMatrix.needsUpdate = true;
    return { group, meshes, cx, cy };
  }

  _pickMaterial(x, y, z, surfaceY) {
    if (this.splatField && typeof this.splatField.pickMaterial === 'function') {
      return this.splatField.pickMaterial(x, y, z, surfaceY);
    }

    // fallback heuristic
    if (y === surfaceY) {
      if (y <= 2) return 'sand';
      const hAt = (X, Z) => Math.floor(this.splatField.height(X, Z));
      const s = Math.abs(hAt(x + 1, z) - hAt(x, z)) + Math.abs(hAt(x, z + 1) - hAt(x, z));
      if (s > 2) return 'stone';
      if (y > 26) return 'snow';
      return 'grass';
    }
    if (y === 0) return 'basalt'; // bedrock
    if (y < surfaceY - 4) return 'stone';
    return 'dirt';
  }

  // ---- edits ---------------------------------------------------------------

  raycastBlock(raycaster) {
    const origin = raycaster.ray.origin.clone();
    const dir = raycaster.ray.direction.clone().normalize();
    const waterLevel = (this.splatField && this.splatField.waterLevel != null)
      ? this.splatField.waterLevel
      : (this.params.seaLevel | 0);

    let t = 0;
    for (let i = 0; i < 250; i++) {
      const p = origin.clone().addScaledVector(dir, t);
      const wx = Math.floor(p.x), wy = Math.floor(p.y), wz = Math.floor(p.z);
      if (wy < 0 || wy >= HEIGHT) { t += 0.5; continue; }
      const h = Math.floor(this.splatField.height(wx, wz));
      let mat = null;
      if (wy <= h) mat = this._pickMaterial(wx, wy, wz, h);
      else if (wy <= waterLevel) mat = 'water';
      if (mat) return { wx, wy, wz, mat, surface: h };
      t += 0.5;
    }
    return null;
  }

  placeBlock(wx, wy, wz, material) {
    // Never place solid blocks below sea level; bedrock only at y=0
    if (material !== 'water') {
      const wl = (this.splatField?.waterLevel ?? (this.params.seaLevel | 0)) + 1;
      wy = Math.max(wy, wl);
    }
    wy = Math.max(0, Math.min(HEIGHT - 1, wy));

    const cx = Math.floor(wx / CHUNK_SIZE), cy = Math.floor(wz / CHUNK_SIZE);
    const key = cx + ',' + cy;
    const ch = this.chunks.get(key);
    if (ch) { this.group.remove(ch.group); this.chunks.delete(key); }
    this.overrides.set(`${wx},${wy},${wz}`, material);
    this.ensureChunk(cx, cy);
  }

  removeBlock(wx, wy, wz) {
    // hard bedrock
    if (wy <= 0) return;
    const cx = Math.floor(wx / CHUNK_SIZE), cy = Math.floor(wz / CHUNK_SIZE);
    const key = cx + ',' + cy;
    const ch = this.chunks.get(key);
    if (ch) { this.group.remove(ch.group); this.chunks.delete(key); }
    this.overrides.set(`${wx},${wy},${wz}`, null);
    this.ensureChunk(cx, cy);
  }

  serialize() {
    const overrides = [];
    for (const [k, v] of this.overrides.entries()) overrides.push([k, v]);
    return { seed: this.seed, params: this.params, overrides };
  }

  deserialize(data) {
    this.seed = data.seed || this.seed;
    this.params = { ...this.params, ...(data.params || {}) };
    this.overrides = new Map(data.overrides || []);
    this._rebuildField();
    this.invalidateAll();
  }
}

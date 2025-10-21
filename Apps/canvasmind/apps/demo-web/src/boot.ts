import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { initCanvasMind } from "./canvasmind/init";
import { makeShadowCatcher } from "./three/shadow-catcher";
import { sendTelemetry, scoreCandidates } from "./canvasmind/telemetry/client";

// Rose + props + grass
import { loadRose, unloadRose, playRoseAction, updateRose } from "./three/roseLoader";
import { loadTestBall, unloadTestBall } from "./canvasmind/plugins/animator/testBall";
import { loadImportedBall, unloadImportedBall } from "./canvasmind/plugins/animator/importedBall";
import { GrassField, GrassOpts } from "./canvasmind/plugins/grass/grassField";

// Procedural terrain / road / car
import { TerrainSystem } from "./canvasmind/plugins/terrain/terrain-system";
import { RoadInfinite } from "./canvasmind/plugins/roads/road-infinite";
import { loadCar } from "./canvasmind/plugins/vehicles/car-loader";
import { CarController } from "./canvasmind/plugins/vehicles/car-controller";

// ► MCP (real client)
import { fetchRegistry, type MCPItem } from "./canvasmind/mcp/registry";
import { callMCP } from "./canvasmind/mcp/http";

// ► Splats
import { makeDiscSplat, SplatCloud } from "./canvasmind/plugins/splats/splat-cloud";
import { parseAsciiPLY } from "./canvasmind/plugins/splats/ply-parse";
import { imageFileToSplatCloud, videoFileToSplatCloud, type ImageSplatOpts } from "./canvasmind/plugins/splats/image-to-splats";

const DEV = true;
const vlog = (...a: any[]) => DEV && console.info("[CanvasMind]", ...a);

// ─────────────────────────────────────────────────────────────
// Selection layer: pick ONLY things that opt-in to this layer.
const LAYER_SELECTABLE = 1;
function markSelectableDeep(root: THREE.Object3D, on = true) {
  root.traverse(o => on ? o.layers.enable(LAYER_SELECTABLE) : o.layers.disable(LAYER_SELECTABLE));
}

/* ─────────────────────────  Types  ───────────────────────── */
type MCPRegistryItem = MCPItem;
type SkyboxOut = {
  asset: { kind: "texture.equirect" | "texture.cubemap"; urls: string[]; mime: string };
  provenance: { server: string; model: string; prompt?: string; seed?: number; ts: number };
  budget_hint?: { tex_mem_mb_est?: number };
};
type MeshOut = {
  asset: { kind: "model.gltf"; url: string };
  provenance: { server: string; model: string; prompt?: string; seed?: number; ts: number };
  budget_hint?: { tris_est?: number };
};
type DCWO<T = unknown> = {
  id: string; node?: T;
  context: { semantics: string[]; provenance: Record<string, unknown>; constraints?: Record<string, unknown> };
  policy: Record<string, unknown>;
};

/* ───────────────────────  Budget Manager  ─────────────────────── */
type Trackable = {
  id: string;
  kind: "env" | "mesh" | "texture" | "instanced";
  estMB: number;
  estTris?: number;
  node?: THREE.Object3D | THREE.Texture;
  dispose: () => void;
};
class BudgetManager {
  caps = { texMemMB: 512, tris: 1_500_000, nodes: 120 };
  totalMB = 0;
  totalTris = 0;
  nodes = 0;
  private lru: Trackable[] = [];
  constructor(partial?: Partial<typeof this.caps>) { Object.assign(this.caps, partial || {}); }
  track(t: Trackable) { this.lru.push(t); this.totalMB += t.estMB; if (t.estTris) this.totalTris += t.estTris; if (t.kind === "mesh") this.nodes += 1; this.trim(); }
  untrackByNode(node: THREE.Object3D | THREE.Texture) { const i = this.lru.findIndex((x) => x.node === node); if (i >= 0) this.removeAt(i); }
  clearAll() { while (this.lru.length) this.removeAt(0); }
  private removeAt(i: number) { const v = this.lru.splice(i, 1)[0]; this.totalMB -= v.estMB; if (v.estTris) this.totalTris -= v.estTris; if (v.kind === "mesh") this.nodes -= 1; try { v.dispose(); } catch {} }
  private trim() { while (this.totalMB > this.caps.texMemMB || this.totalTris > this.caps.tris || this.nodes > this.caps.nodes) { if (!this.lru.length) break; this.removeAt(0); } }
  stats() { return { mb: this.totalMB, tris: this.totalTris, nodes: this.nodes, caps: { ...this.caps } }; }
}

/* ─────────────────────  Dispose helpers  ───────────────────── */
function disposeMaterial(mat: any) {
  if (!mat) return;
  const texKeys = ["map","normalMap","roughnessMap","metalnessMap","emissiveMap","aoMap","bumpMap","alphaMap","displacementMap","envMap","specularMap"];
  for (const k of texKeys) { const tex = mat[k]; if (tex && tex.isTexture && tex.dispose) try { tex.dispose(); } catch {} }
  try { mat.dispose?.(); } catch {}
}
function disposeObject3D(node: THREE.Object3D) {
  node.traverse((o: any) => { if (o.isMesh || o.isPoints) { try { o.geometry?.dispose?.(); } catch {} disposeMaterial(o.material); } });
  node.parent?.remove(node);
}

/* ─────────────────────  Mini LOD helper  ───────────────────── */
function makeBasicLOD(node: THREE.Object3D) {
  const lod = new THREE.LOD();
  lod.addLevel(node.clone(), 0);
  const mid = node.clone(); mid.traverse((o: any) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  lod.addLevel(mid, 15);
  const far = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 10), new THREE.MeshBasicMaterial({ color: 0x666666 }));
  lod.addLevel(far, 35);
  return lod;
}

/* ─────────────────────  Instancing Pool  ───────────────────── */
type InstPoolEntry = { inst: THREE.InstancedMesh; count: number; limit: number; estMB: number; estTris: number; };
class InstancingPool {
  private pools = new Map<string, InstPoolEntry>();
  getOrCreate(key: string, proto: THREE.Mesh, trisEst: number, countHint = 1000) {
    let entry = this.pools.get(key);
    if (!entry) {
      const inst = new THREE.InstancedMesh(proto.geometry, proto.material as THREE.Material, countHint);
      inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      entry = { inst, count: 0, limit: countHint, estMB: Math.max(8, Math.round(trisEst / 2500)), estTris: trisEst };
      this.pools.set(key, entry);
    }
    return entry;
  }
  addInstance(entry: InstPoolEntry, matrix: THREE.Matrix4) {
    if (entry.count >= entry.limit) return false;
    entry.inst.setMatrixAt(entry.count, matrix);
    entry.count++; entry.inst.count = entry.count; entry.inst.instanceMatrix.needsUpdate = true;
    return true;
  }
  disposeAll(scene: THREE.Scene) {
    for (const e of this.pools.values()) { scene.remove(e.inst); e.inst.geometry.dispose(); (e.inst.material as any)?.dispose?.(); }
    this.pools.clear();
  }
}

/* ─────────────────────  Selection/Gizmo (optimized) ───────────────────── */
class Selection {
  private ray = new THREE.Raycaster();
  private tmpBox = new THREE.Box3();
  private outlineColor = 0x60a5fa;
  public selected = new Set<THREE.Object3D>();
  private helpers = new Map<THREE.Object3D, THREE.Box3Helper>();
  private dirty = false;

  constructor(
    private scene: THREE.Scene,
    private camera: THREE.Camera,
    private canvas: HTMLCanvasElement
  ) {}

  pick(ev: PointerEvent, additive: boolean) {
    if (ev.button !== 0) return; // only LMB
    const rect = this.canvas.getBoundingClientRect();
    const x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    this.ray.setFromCamera({ x, y }, this.camera as THREE.PerspectiveCamera);
    this.ray.layers.set(LAYER_SELECTABLE);

    const intersects = this.ray.intersectObjects(this.scene.children, true);
    if (!intersects.length) { if (!additive) this.clear(); return; }

    // find selectable root under scene
    let top: THREE.Object3D = intersects[0].object;
    while (top.parent && top.parent !== this.scene) top = top.parent;

    if (!additive) this.clear();
    if (this.selected.has(top)) { if (additive) this.unselect(top); }
    else this.select(top);
  }

  select(o: THREE.Object3D) {
    this.selected.add(o);
    const box = new THREE.Box3().setFromObject(o);
    const helper = new THREE.Box3Helper(box, this.outlineColor);
    helper.renderOrder = 9999;
    helper.layers.set(0); // helpers not pickable
    this.scene.add(helper);
    this.helpers.set(o, helper);
    this.dirty = false;
  }

  unselect(o: THREE.Object3D) {
    this.selected.delete(o);
    const h = this.helpers.get(o);
    if (h) { this.scene.remove(h); (h as any).geometry?.dispose?.(); (h as any).material?.dispose?.(); }
    this.helpers.delete(o);
    this.dirty = false;
  }

  clear() { [...this.selected].forEach(o => this.unselect(o)); }

  markDirty() { this.dirty = true; }
  refreshHelpers() {
    if (!this.dirty) return;
    for (const [obj, helper] of this.helpers) {
      this.tmpBox.setFromObject(obj);
      (helper as any).box.copy(this.tmpBox);
    }
    this.dirty = false;
  }

  deleteSelected() {
    for (const obj of [...this.selected]) {
      this.unselect(obj);
      disposeObject3D(obj);
    }
  }

  duplicateSelected(offset = new THREE.Vector3(0.25,0,0.25)) {
    const clones: THREE.Object3D[] = [];
    for (const obj of this.selected) {
      const clone = obj.clone(true);
      clone.traverse((n: any) => {
        if (n.isMesh) {
          n.material = n.material.clone?.() ?? n.material;
          n.geometry = n.geometry.clone?.() ?? n.geometry;
        }
      });
      const wp = new THREE.Vector3();
      obj.getWorldPosition(wp).add(offset);
      clone.position.copy(wp);
      (obj.parent || this.scene).add(clone);
      markSelectableDeep(clone, true);
      clones.push(clone);
    }
    this.clear();
    clones.forEach(c => this.select(c));
  }
}

/* ─────────────────────  Public API type  ───────────────────── */
export type CanvasMindAPI = {
  refreshRegistry(): Promise<void>;
  applySkybox(prompt: string): Promise<void>;
  spawnMesh(): Promise<void>;
  batchSpawn(count: number): Promise<void>;
  clearScene(): void;
  screenshot(): void;
  setGround(y: number, rx: number, rz: number): void;
  setQuality(mode: "performance" | "balanced" | "quality"): void;

  // Character/props
  loadRose(url?: string): Promise<any>;
  unloadRose(): void;
  playRoseAction(action: "walk" | "run" | "jump", loops?: number): void;
  loadTestBall(): void;
  unloadTestBall(): void;
  loadImportedBall(url: string): Promise<any>;
  unloadImportedBall(): void;

  // Grass
  loadGrass(opts?: GrassOpts & { quality?: "low"|"med"|"high" }): void;
  unloadGrass(): void;
  updateGrass(opts: Partial<GrassOpts & { quality?: "low"|"med"|"high" }>): void;

  // Editor/Gizmo/Selection
  setGizmoMode(mode: "translate"|"rotate"|"scale"): void;
  clearSelection(): void;
  deleteSelection(): void;
  duplicateSelection(): void;
  flipSelectionXZ(): void;

  // Skybox shaping
  setBackgroundExposure(v: number): void;
  setBackgroundBlur(v: number): void;

  // Procedural controls
  startProcedural(): Promise<void>;
  stopProcedural(): void;

  // Splats
  spawnSplatDemo(count?: number, radius?: number): void;
  loadSplatPLY(url: string): Promise<void>;
  loadSplatFromFile(file: File, opts?: ImageSplatOpts): Promise<void>;
  clearSplats(): void;

  getState(): { assets: number; fps: number; draws: number; budget: ReturnType<BudgetManager["stats"]> };
  dispose(): void;
};

/* ─────────────────────  Boot function  ───────────────────── */
export async function bootOnCanvas(rootDiv: HTMLElement): Promise<CanvasMindAPI> {
  // Canvas
  const canvas = document.createElement("canvas");
  canvas.style.width = "100%"; canvas.style.height = "100%";
  canvas.oncontextmenu = e => e.preventDefault();
  rootDiv.appendChild(canvas);

  // Renderer
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  let pixelRatio = Math.min(window.devicePixelRatio ?? 1, 1.75);
  renderer.setPixelRatio(pixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMappingExposure = 1.0;

  // Scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0f18);

  // Expose for injectors
  (window as any).__CM_SCENE = scene;
  (window as any).__CM_RENDERER = renderer;

  // ───────── Injectors (used by MCPAssetFetcher) ─────────
  (window as any).__CM_INJECT = {
    async applyTextureToTestBall(maps: Record<string, string>) {
      const s: THREE.Scene = (window as any).__CM_SCENE;
      const r: THREE.WebGLRenderer = (window as any).__CM_RENDERER;

      // Ensure a ball exists
      let ball = s.getObjectByName("CM_TestBall") as THREE.Mesh | null;
      if (!ball) {
        const res = (window as any).CanvasMindApp?.loadTestBall?.();
        if (res instanceof Promise) await res;
        s.updateMatrixWorld(true);
        ball = s.getObjectByName("CM_TestBall") as THREE.Mesh | null;
      }
      if (!ball) return;

      // Ensure PBR material
      if (!(ball.material instanceof THREE.MeshStandardMaterial) &&
          !(ball.material instanceof (THREE as any).MeshPhysicalMaterial)) {
        const old: any = ball.material;
        ball.material = new THREE.MeshStandardMaterial({
          color: (old?.color?.isColor ? old.color : new THREE.Color(0xffffff)),
          roughness: 0.5,
          metalness: 0.0,
          envMapIntensity: 1.0
        });
        old?.dispose?.();
      }
      const mat = ball.material as THREE.MeshStandardMaterial;

      const loader = new THREE.TextureLoader();
      const loadTex = async (url?: string, isColor = false) => {
        if (!url) return undefined;
        const t = await loader.loadAsync(url);
        if (isColor) t.colorSpace = THREE.SRGBColorSpace;
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.anisotropy = Math.min(8, r.capabilities.getMaxAnisotropy?.() || 1);
        return t;
      };

      const albedo = await loadTex(maps.pbr_albedo || maps.baseColor || maps.color, true);
      const normal = await loadTex(maps.normal);
      const rough  = await loadTex(maps.roughness);
      const metal  = await loadTex(maps.metalness);
      const ao     = await loadTex(maps.ao || maps.ambientOcclusion);

      if (albedo) mat.map = albedo;
      if (normal) mat.normalMap = normal;
      if (rough)  mat.roughnessMap = rough;
      if (metal)  mat.metalnessMap = metal;
      if (ao)     mat.aoMap = ao;

      mat.roughness = rough ? 1.0 : (mat.roughness ?? 0.5);
      mat.metalness = metal ? 1.0 : (mat.metalness ?? 0.0);
      mat.color.set(0xffffff);
      mat.needsUpdate = true;
    },

    async loadHDRIEnvironment(url: string) {
      const r: THREE.WebGLRenderer = (window as any).__CM_RENDERER;
      const s: THREE.Scene = (window as any).__CM_SCENE;
      const tex = await new THREE.TextureLoader().loadAsync(url);
      tex.mapping = THREE.EquirectangularReflectionMapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      const pmrem = new THREE.PMREMGenerator(r);
      s.environment = pmrem.fromEquirectangular(tex).texture;
      s.background = tex;
      (s as any).backgroundBlurriness = 0;
      pmrem.dispose();
    },

    async loadGLBModel(url: string) {
      const loader = new GLTFLoader();
      const gltf = await loader.loadAsync(url);
      gltf.scene.traverse((o:any)=>{ if (o.isMesh){ o.castShadow = o.receiveShadow = true; }});
      gltf.scene.name = "CM_RemoteModel";
      (window as any).__CM_SCENE.add(gltf.scene);
    },

    unloadGLBModel() {
      const s: THREE.Scene = (window as any).__CM_SCENE;
      const n = s.getObjectByName("CM_RemoteModel");
      if (!n) return;
      n.traverse((o:any)=>{ if (o.isMesh){ o.geometry?.dispose?.(); (o.material as any)?.dispose?.(); }});
      n.parent?.remove(n);
    }
  };

  // Camera + controls
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 2000);
  camera.position.set(5, 3, 7);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 1, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.update();

  // Lights
  const dirLight = new THREE.DirectionalLight(0xffffff, 2);
  dirLight.position.set(5, 20, 10);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(2048, 2048);
  dirLight.shadow.camera.near = 0.1;
  dirLight.shadow.camera.far = 2000;
  scene.add(dirLight, new THREE.AmbientLight(0xffffff, 0.4));

  const grid = new THREE.GridHelper(20, 20, 0x334155, 0x1f2937);
  (grid.material as THREE.Material).depthWrite = false;
  grid.renderOrder = -2;
  scene.add(grid);

  // Shadow catcher ground (kept for “empty scene” mode)
  const shadowPlane = makeShadowCatcher(60, 0.35);
  shadowPlane.name = "CM_ShadowCatcher";
  shadowPlane.position.y = 0;
  shadowPlane.layers.disable(LAYER_SELECTABLE);
  shadowPlane.renderOrder = -1;
  scene.add(shadowPlane);

  const rootGroup = new THREE.Group();
  rootGroup.name = "CM_SpawnRoot";
  scene.add(rootGroup);

  function adoptToRoot(node?: THREE.Object3D | null) {
    if (!node) return;
    if (node.parent) node.parent.remove(node);
    rootGroup.add(node);
    markSelectableDeep(node, true);
  }

  // Resize
  function resize() {
    const w = rootDiv.clientWidth || rootDiv.getBoundingClientRect().width;
    const h = rootDiv.clientHeight || window.innerHeight * 0.75;
    renderer.setSize(w, h, false);
    camera.aspect = Math.max(1e-3, w / Math.max(1, h));
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(rootDiv);
  window.addEventListener("resize", resize);
  resize();

  // Selection + TransformControls
  const selector = new Selection(scene, camera, canvas);
  const gizmo = new TransformControls(camera, canvas);
  gizmo.size = 0.9;
  gizmo.addEventListener("dragging-changed", (e: any) => {
    controls.enabled = !e.value;
  });
  // Perf lighten during drag
  let restoreDrag: null | (()=>void) = null;
  gizmo.addEventListener("dragging-changed", (e:any) => {
    if (e.value) {
      const prevShadow = dirLight.shadow.mapSize.clone();
      const prevPR = pixelRatio;
      dirLight.shadow.mapSize.set(1024,1024);
      pixelRatio = Math.max(0.9, Math.min(pixelRatio, 1.25));
      renderer.setPixelRatio(pixelRatio);
      restoreDrag = () => { dirLight.shadow.mapSize.copy(prevShadow); pixelRatio = prevPR; renderer.setPixelRatio(pixelRatio); };
    } else { restoreDrag?.(); restoreDrag = null; selector.markDirty(); }
  });
  gizmo.addEventListener("objectChange", () => selector.markDirty());
  scene.add(gizmo);

  function attachGizmoToLast() {
    const last = [...selector.selected].at(-1);
    if (last) gizmo.attach(last as THREE.Object3D);
    else gizmo.detach();
  }

  // picking
  canvas.addEventListener("pointerdown", (ev) => {
    const additive = (ev.ctrlKey || ev.metaKey);
    selector.pick(ev, additive);
    attachGizmoToLast();
  });

  // keys for gizmo
  window.addEventListener("keydown", (e) => {
    if (e.key === "w" || e.key === "W") gizmo.setMode("translate");
    if (e.key === "e" || e.key === "E") gizmo.setMode("rotate");
    if (e.key === "r" || e.key === "R") gizmo.setMode("scale");
    if (e.key === "x" || e.key === "X") { selector.deleteSelected(); gizmo.detach(); }
    if (e.key === "d" || e.key === "D") { selector.duplicateSelected(); attachGizmoToLast(); }
    if (e.key === "f" || e.key === "F") {
      for (const o of selector.selected) { o.scale.x *= -1; o.scale.z *= -1; }
      selector.markDirty();
    }
  });

  // ───────────────────────────────
  // Procedural terrain / road / car
  // ───────────────────────────────
  let terrain: TerrainSystem | null = null;
  let road: RoadInfinite | null = null;
  let car: THREE.Group | null = null;
  let carCtl: CarController | null = null;

  const procState = {
    width: 7, bank: 5, curvature: 0.7, segLen: 80, heightAmp: 18, seed: 7, segCount: 18,
  };

  const input = { throttle: 0, steer: 0 };
  const driveKeys = new Set<string>();
  function recomputeInput() {
    input.throttle = driveKeys.has("ArrowUp") ? 1 : driveKeys.has("ArrowDown") ? -1 : 0;
    input.steer    = driveKeys.has("ArrowLeft") ? -1 : driveKeys.has("ArrowRight") ? 1 : 0;
  }
  window.addEventListener("keydown", (e) => {
    if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key)) { e.preventDefault(); driveKeys.add(e.key); recomputeInput(); }
  });
  window.addEventListener("keyup", (e) => {
    if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key)) { e.preventDefault(); driveKeys.delete(e.key); recomputeInput(); }
  });

  async function rebuildRoad() {
    if (!terrain) return;
    if (road?.group.parent) scene.remove(road.group);
    road = new RoadInfinite({
      seed: procState.seed,
      segmentCount: procState.segCount,
      segmentLen: procState.segLen,
      curvature: procState.curvature,
      width: procState.width,
      bankAngleDeg: procState.bank,
      terrain
    });
    await road.build();
    scene.add(road.group);

    if (car && terrain) {
      carCtl = new CarController(car, { path: road.path, terrain });
    }
  }

  async function startProcedural() {
    shadowPlane.visible = false;
    grid.visible = false;

    terrain = new TerrainSystem({
      tileSize: 220,
      tileSegments: 120,
      height: { amplitude: procState.heightAmp }
    });
    terrain.group.name = "CM_Terrain";
    scene.add(terrain.group);
    markSelectableDeep(terrain.group, false);

    await rebuildRoad();

    try {
      car = await loadCar("/assets/Car.glb");
      adoptToRoot(car);
      carCtl = new CarController(car, { path: (road as any).path, terrain });
    } catch (err) {
      console.warn("Car model not found:", err);
    }

    window.addEventListener("proc.set", (e: any) => {
      const p = e.detail || {};
      let needsRoad = false;
      if (typeof p.roadWidth === "number") { procState.width = p.roadWidth; needsRoad = true; }
      if (typeof p.bank === "number")      { procState.bank = p.bank; needsRoad = true; }
      if (typeof p.curvature === "number") { procState.curvature = p.curvature; needsRoad = true; }
      if (typeof p.segLen === "number")    { procState.segLen = p.segLen; needsRoad = true; }
      if (typeof p.heightScale === "number") { procState.heightAmp = p.heightScale; terrain?.setHeightParams({ amplitude: procState.heightAmp }); }
      if (needsRoad) { void rebuildRoad(); }
    });
    window.addEventListener("proc.regen", () => {
      procState.seed = (Math.random() * 65536) | 0;
      void rebuildRoad();
    });
  }

  function stopProcedural() {
    grid.visible = true;
    shadowPlane.visible = true;
    if (car) { disposeObject3D(car); car = null; }
    if (road) { if (road.group.parent) scene.remove(road.group); road.group.traverse((o:any)=>{ if(o.isMesh){ o.geometry?.dispose?.(); (o.material as any)?.dispose?.(); }}); road = null; }
    if (terrain) {
      if (terrain.group.parent) scene.remove(terrain.group);
      terrain.group.traverse((o:any)=>{ if(o.isMesh){ o.geometry?.dispose?.(); (o.material as any)?.dispose?.(); }});
      terrain = null;
    }
    carCtl = null;
  }

  // Auto-start procedural demo
  await startProcedural();

  // Telemetry/FPS
  let frames = 0, lastFpsTick = performance.now();
  let fps = 0, draws = 0;
  let lastRenderNow = performance.now();
  let animId = 0;
  const TARGET_FPS = 55;

  const animate = (now: number) => {
    animId = requestAnimationFrame(animate);
    const deltaSec = (now - lastRenderNow) / 1000;
    lastRenderNow = now;

    updateRose(deltaSec);
    if (grass) grass.update(deltaSec);
    if (carCtl) carCtl.update(deltaSec, input);
    if (road && car) road.tick(car.position.x, car.position.z);

    frames++;
    if (now - lastFpsTick >= 1000) {
      fps = frames; frames = 0; lastFpsTick = now;
      draws = renderer.info.render.calls; renderer.info.reset();
      const b = budgets.stats();
      const crowded = b.nodes > b.caps.nodes * 0.9 || b.mb > b.caps.texMemMB * 0.9;
      dirLight.shadow.mapSize.set(crowded ? 1024 : 2048, crowded ? 1024 : 2048);

      if (!restoreDrag) {
        if (fps < TARGET_FPS - 5) pixelRatio = Math.max(0.9, pixelRatio - 0.1);
        if (fps > TARGET_FPS + 5) pixelRatio = Math.min(1.75, pixelRatio + 0.05);
        renderer.setPixelRatio(pixelRatio);
      }
    }
    selector.refreshHelpers();
    controls.update();
    renderer.render(scene, camera);
  };
  animId = requestAnimationFrame(animate);

  // Flush render lists occasionally (micro GC)
  const renderListTimer = setInterval(() => (renderer as any).renderLists?.dispose?.(), 5_000);

  // Context loss guard
  canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); console.warn("WebGL context lost"); });
  canvas.addEventListener("webglcontextrestored", () => { location.reload(); });

  // Budgets
  let budgets = new BudgetManager({ texMemMB: 512, tris: 1_500_000, nodes: 120 });

  // Instancing pool
  const instPool = new InstancingPool();

  // ►► MCP helpers
  async function getPreferredServer(tag: "skybox" | "mesh"): Promise<MCPRegistryItem | null> {
    const items = await fetchRegistry();
    const sel = document.getElementById("serverSelect") as HTMLSelectElement | null;
    if (sel && sel.value) {
      const chosen = items.find(i => i.id === sel.value);
      if (chosen && chosen.tags.includes(tag)) return chosen;
    }
    return items.find(i => i.tags.includes(tag)) || null;
  }

  /* ───────────────  Actions  ─────────────── */
  async function refreshRegistry() {
    const items = await fetchRegistry();
    const sel = document.getElementById("serverSelect") as HTMLSelectElement | null;
    if (sel) {
      sel.innerHTML = "";
      items.forEach((i) => {
        const opt = document.createElement("option");
        opt.value = i.id;
        opt.textContent = `${i.name} (${i.tags.join(",")})`;
        sel.appendChild(opt);
      });
    }
    log(`Registry loaded: ${items.length} servers`);
  }

  // keep the last env to dispose properly
  let lastEnvTex: THREE.Texture | null = null;
  async function applySkybox(promptText: string) {
    const server = await getPreferredServer("skybox");
    if (!server) throw new Error("No skybox-capable server found");
    log(`Calling MCP ${server.id}/generate_skybox …`);

    const out = await callMCP<SkyboxOut>(server.server_url, "generate_skybox", {
      prompt: promptText, seed: 42, format: "equirect"
    });

    const tex = await new THREE.TextureLoader().loadAsync(out.asset.urls[0]);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    scene.background = tex as any;

    if (lastEnvTex) try { lastEnvTex.dispose(); } catch {}
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envMap = pmrem.fromEquirectangular(tex).texture;
    scene.environment = envMap;
    (scene as any).backgroundIntensity = 1.0;
    (scene as any).backgroundBlurriness = 0.0;
    pmrem.dispose();
    lastEnvTex = tex;

    budgets.track({
      id: `skybox_${out.provenance.seed}`,
      kind: "env",
      estMB: out.budget_hint?.tex_mem_mb_est ?? 32,
      node: tex,
      dispose: () => { try { tex.dispose(); } catch {} scene.environment = null; }
    });

    register({
      id: `skybox_${out.provenance.seed}`,
      node: tex,
      context: { semantics: ["skybox"], provenance: out.provenance },
      policy: { allow: { background: true } }
    });

    log(`Skybox applied • model=${out.provenance.model} seed=${out.provenance.seed}`);

    void sendTelemetry("http://localhost:8088", {
      prompt: String(out.provenance.prompt ?? promptText),
      candidate: { type: "skybox", model: out.provenance.model, seed: out.provenance.seed },
      chosen: true,
      dwell_time: 0
    });
  }

  const gltfLoader = new GLTFLoader();
  const draco = new DRACOLoader();
  draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.6/");
  gltfLoader.setDRACOLoader(draco);
  gltfLoader.setMeshoptDecoder(MeshoptDecoder);

  function heuristicScore(c: any): number {
    const tris = c?.budget_hint?.tris_est ?? 20000;
    const trisScore = Math.max(0, 1 - tris / 300_000);
    const novelty = ((c?.provenance?.seed ?? 0) % 97) / 97;
    const name = (c?.asset?.url || "").toLowerCase();
    const nameBias = /(boulder|rock|helmet|crate|barrel)/.test(name) ? 0.05 : 0;
    return 0.75 * trisScore + 0.20 * novelty + 0.05 * nameBias;
  }

  async function spawnMesh() {
    const s = budgets.stats();
    if (s.nodes >= s.caps.nodes) { log("Spawn refused (node cap reached)."); return; }

    const server = await getPreferredServer("mesh");
    if (!server) throw new Error("No mesh-capable server found");
    log(`Calling MCP ${server.id}/generate_mesh …`);

    const K = 3;
    const candidates: MeshOut[] = [];
    for (let i = 0; i < K; i++) {
      const out = await callMCP<MeshOut>(server.server_url, "generate_mesh", {
        prompt: "basalt boulder with wet sheen", seed: 1337 + i
      });
      candidates.push(out);
    }

    const feats: number[][] = candidates.map(c => {
      const t = c.budget_hint?.tris_est ?? 20000;
      const p = (c.provenance.prompt ?? "").length % 100;
      const sSeed = (c.provenance.seed ?? 0) % 997;
      return [t / 100000, p / 100, sSeed / 1000, 1,0,0,0,0,0,0,0,0,0,0,0,0];
    });

    let scores: number[] | null = null;
    try {
      const s = await scoreCandidates("http://localhost:8088", feats, 16);
      if (Array.isArray(s) && s.some(v => Number.isFinite(v))) scores = s;
    } catch {}
    if (!scores) scores = candidates.map(heuristicScore);

    let bestIdx = 0; let best = -Infinity;
    scores.forEach((sc, i) => { if (sc > best) { best = sc; bestIdx = i; } });
    const chosen = candidates[bestIdx];

    const gltf = await gltfLoader.loadAsync(chosen.asset.url);

    // Try instancing
    let usedInstancing = false;
    gltf.scene.updateMatrixWorld(true);
    const firstMesh = gltf.scene.getObjectByProperty("type", "Mesh") as THREE.Mesh | null;

    if (firstMesh && firstMesh.geometry && firstMesh.material) {
      const trisEst = chosen.budget_hint?.tris_est ?? 20000;
      const entry = instPool.getOrCreate(chosen.asset.url, firstMesh, trisEst, 2000);
      if (!entry.inst.parent) {
        entry.inst.name = "CM_InstancedPool";
        rootGroup.add(entry.inst);
        markSelectableDeep(entry.inst, true);
        budgets.track({
          id: `instPool_${chosen.asset.url}`,
          kind: "instanced",
          estMB: entry.estMB,
          estTris: trisEst,
          node: entry.inst,
          dispose: () => {
            try { entry.inst.geometry.dispose(); } catch {}
            try { (entry.inst.material as any)?.dispose?.(); } catch {}
            entry.inst.parent?.remove(entry.inst);
          }
        });
      }
      const m = new THREE.Matrix4().makeTranslation(Math.random()*4-2, 0, Math.random()*4-2);
      if (instPool.addInstance(entry, m)) { usedInstancing = true; log(`Instanced spawn (policy score=${best.toFixed(3)})`); }
    }

    if (!usedInstancing) {
      const node = makeBasicLOD(gltf.scene);
      node.name = "CM_Mesh";
      node.position.set((Math.random() * 4 - 2), 0, (Math.random() * 4 - 2));
      node.traverse((o: any) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
      adoptToRoot(node);

      const estTris = chosen.budget_hint?.tris_est ?? 20000;
      const estMB = Math.max(8, Math.round(estTris / 2000));
      budgets.track({
        id: `mesh_${chosen.provenance.seed}_${Math.random().toString(36).slice(2,6)}`,
        kind: "mesh", estMB, estTris, node,
        dispose: () => disposeObject3D(node)
      });
      register({
        id: `mesh_${chosen.provenance.seed}_${Math.random().toString(36).slice(2,6)}`,
        node,
        context: { semantics: ["mesh"], provenance: chosen.provenance },
        policy: { allow: { transform: true } }
      });
      log(`Mesh spawned (policy score=${best.toFixed(3)}) • model=${chosen.provenance.model} seed=${chosen.provenance.seed}`);
    }

    await sendTelemetry("http://localhost:8088", {
      prompt: String(chosen.provenance.prompt ?? ""),
      candidate: { type: "mesh", model: chosen.provenance.model, seed: chosen.provenance.seed, score: best },
      chosen: true, dwell_time: 0
    });
  }

  async function batchSpawn(count: number) {
    const MAX_INFLIGHT = 4;
    let inflight = 0, i = 0;
    return new Promise<void>((resolve) => {
      const tick = () => {
        const s = budgets.stats();
        if (s.nodes >= s.caps.nodes) return resolve();
        while (inflight < MAX_INFLIGHT && i < count) {
          inflight++; i++;
          spawnMesh().finally(() => { inflight--; setTimeout(tick, 0); });
        }
        if (i >= count && inflight === 0) resolve();
      };
      tick();
    });
  }

  // Grass (with quality)
  let grass: GrassField | null = null;
  let lastGrassOpts: (GrassOpts & { quality?: "low"|"med"|"high" }) | null = null;

  function buildGrass(opts: GrassOpts & { quality?: "low"|"med"|"high" }) {
    lastGrassOpts = { ...opts };
    if (grass) { grass.removeFrom(scene); grass = null; }
    grass = new GrassField(opts);
    grass.addTo(scene);
    grass.group.position.set(0, 0, 0);
    markSelectableDeep(grass.group, true);
  }

  function loadGrass(opts: GrassOpts & { quality?: "low"|"med"|"high" } = {}) { buildGrass(opts); }
  function unloadGrass() { if (!grass) return; grass.removeFrom(scene); grass = null; }
  function updateGrass(opts: Partial<GrassOpts & { quality?: "low"|"med"|"high" }>) {
    if (!grass) { buildGrass({ ...(opts as any) }); return; }
    if (opts.quality !== undefined && lastGrassOpts?.quality !== opts.quality) {
      buildGrass({ ...lastGrassOpts!, ...opts });
      return;
    }
    if (typeof opts.bladeHeight === "number") grass.setHeight(opts.bladeHeight);
    if (typeof opts.windStrength === "number" || typeof opts.windSpeed === "number") {
      grass.setWind(
        opts.windStrength ?? (lastGrassOpts?.windStrength ?? 0.6),
        opts.windSpeed   ?? (lastGrassOpts?.windSpeed ?? 1.1)
      );
    }
    lastGrassOpts = { ...lastGrassOpts!, ...opts };
  }

  // ───────────────────────────────
  // Splats (Gaussian-splat scaffold)
  // ───────────────────────────────
  const splatRoot = new THREE.Group();
  splatRoot.name = "CM_Splats";
  scene.add(splatRoot);

  function trackPoints(points: THREE.Points, id: string, extraBytes = 0) {
    const posBytes = (points.geometry.getAttribute("position")?.array?.byteLength ?? 0);
    const colorBytes = (points.geometry.getAttribute("color")?.array?.byteLength ?? 0);
    budgets.track({
      id,
      kind: "mesh",
      estMB: Math.max(4, Math.ceil((posBytes + colorBytes + extraBytes) / 1_000_000)),
      node: points,
      dispose: () => disposeObject3D(points)
    });
  }

  function spawnSplatDemo(count = 20000, radius = 2) {
    const cloud = makeDiscSplat(count, radius);
    cloud.name = `CM_SplatDemo_${Date.now()}`;
    markSelectableDeep(cloud, true);
    splatRoot.add(cloud);
    trackPoints(cloud, cloud.name);
  }

  async function loadSplatPLY(url: string) {
    const text = await (await fetch(url)).text();
    const { positions, colors } = parseAsciiPLY(text);

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    let hasColors = false;
    if (colors && colors.length) {
      const stride = (colors.length % 3 === 0) ? 3 : 4;
      const f = new Float32Array((colors.length / stride) * 4);
      for (let i = 0, j = 0; i < colors.length; i += stride, j += 4) {
        f[j+0] = colors[i+0] / 255;
        f[j+1] = colors[i+1] / 255;
        f[j+2] = colors[i+2] / 255;
        f[j+3] = (stride === 4 ? colors[i+3] : 255) / 255;
      }
      g.setAttribute("color", new THREE.BufferAttribute(f, 4));
      hasColors = true;
    }

    const m = new THREE.PointsMaterial({
      size: 0.02, sizeAttenuation: true, transparent: true, depthWrite: false,
      vertexColors: hasColors
    });
    const pts = new THREE.Points(g, m);
    pts.name = `CM_SplatPLY_${Date.now()}`;

    markSelectableDeep(pts, true);
    splatRoot.add(pts);
    trackPoints(pts, pts.name);
    vlog("PLY splat loaded:", url, pts);
  }

  async function loadSplatFromFile(file: File, opts: ImageSplatOpts = {}) {
    const lower = file.name.toLowerCase();
    let splat: SplatCloud | null = null;

    if (/\.(png|jpg|jpeg|gif|webp|bmp)$/i.test(lower)) {
      splat = await imageFileToSplatCloud(file, { step: 2, worldWidth: 2, size: 0.02, ...opts });
    } else if (/\.(mp4|webm|mov)$/i.test(lower)) {
      splat = await videoFileToSplatCloud(file, { step: 2, worldWidth: 2, size: 0.02, ...opts });
    } else if (/\.ply$/i.test(lower)) {
      // If user drops a PLY file, route via PLY path
      const url = URL.createObjectURL(file);
      try { await loadSplatPLY(url); } finally { URL.revokeObjectURL(url); }
      return;
    } else {
      throw new Error("Unsupported file for splats");
    }

    splat.name = `CM_ImageSplat_${Date.now()}`;
    markSelectableDeep(splat, true);
    splat.position.set(0, 1.25, 0); // raise a bit above ground
    splatRoot.add(splat);
    trackPoints(splat, splat.name);
  }

  function clearSplats() {
    while (splatRoot.children.length) disposeObject3D(splatRoot.children[0]);
  }

  // UI events
  window.addEventListener("splat.demo" as any, (e: any) => {
    const { count = 20000, radius = 2 } = e.detail || {};
    spawnSplatDemo(count, radius);
  });
  window.addEventListener("splat.loadPLY" as any, (e: any) => {
    const { url } = e.detail || {};
    if (url) void loadSplatPLY(url);
  });
  window.addEventListener("splat.clear" as any, () => clearSplats());
  window.addEventListener("splat.fromFile" as any, (e: any) => {
    const { file, opts } = e.detail || {};
    if (file) void loadSplatFromFile(file, opts);
  });

  function clearScene() {
    // env/background
    const bg: any = scene.background;
    if (bg?.dispose) try { bg.dispose(); } catch {}
    scene.background = new THREE.Color(0x0a0f18);
    scene.environment = null;
    (scene as any).backgroundBlurriness = 0;

    // instancing
    instPool.disposeAll(scene);

    // meshes
    while (rootGroup.children.length) disposeObject3D(rootGroup.children[0]);

    // splats
    clearSplats();

    // procedural
    stopProcedural();

    // grass
    if (grass) { grass.removeFrom(scene); grass = null; }

    selector.clear(); gizmo.detach();

    // registry + budgets
    clearDCWOs();
    budgets.clearAll();
    budgets = new BudgetManager(budgets.caps);
    (renderer as any).renderLists?.dispose?.();

    log("Scene cleared.");
  }

  function setGround(y: number, rx: number, rz: number) {
    shadowPlane.position.y = y;
    shadowPlane.rotation.x = -Math.PI / 2 + rx;
    shadowPlane.rotation.z = rz;
    if (grass) grass.group.position.y = y + 0.001;
  }

  function setQuality(mode: "performance" | "balanced" | "quality") {
    if (mode === "performance") {
      budgets.caps = { texMemMB: 256, tris: 800_000, nodes: 80 };
      pixelRatio = Math.min(window.devicePixelRatio ?? 1, 1.25);
      renderer.setPixelRatio(pixelRatio);
      dirLight.shadow.mapSize.set(1024, 1024);
    } else if (mode === "balanced") {
      budgets.caps = { texMemMB: 512, tris: 1_500_000, nodes: 120 };
      pixelRatio = Math.min(window.devicePixelRatio ?? 1, 1.5);
      renderer.setPixelRatio(pixelRatio);
      dirLight.shadow.mapSize.set(2048, 2048);
    } else {
      budgets.caps = { texMemMB: 1024, tris: 3_000_000, nodes: 200 };
      pixelRatio = Math.min(window.devicePixelRatio ?? 1, 2);
      renderer.setPixelRatio(pixelRatio);
      dirLight.shadow.mapSize.set(4096, 4096);
    }
  }

  function screenshot() {
    const data = renderer.domElement.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = data; a.download = `canvasmind_${Date.now()}.png`; a.click();
  }

  function setBackgroundExposure(v: number) { renderer.toneMappingExposure = Math.max(0.01, v); }
  function setBackgroundBlur(v: number) { (scene as any).backgroundBlurriness = Math.max(0, Math.min(1, v)); }

  function getState() { return { assets: DCWO_REG.size, fps, draws, budget: budgets.stats() }; }

  // DCWO registry (lightweight)
  const DCWO_REG = new Map<string, DCWO>();
  const register = (w: DCWO) => DCWO_REG.set(w.id, w);
  const clearDCWOs = () => { DCWO_REG.clear(); };

  // init CanvasMind core
  await initCanvasMind({
    scene, renderer,
    features: { worldField: false },
    budgets: { texMemSoftCapMB: budgets.caps.texMemMB, trisSoftCap: budgets.caps.tris }
  });

  // HUD
  const fpsEl = document.getElementById("fps");
  const drawsEl = document.getElementById("draws");
  const assetsEl = document.getElementById("assets");
  const hudTimer = setInterval(() => {
    const s = getState();
    fpsEl && (fpsEl.textContent = String(s.fps));
    drawsEl && (drawsEl.textContent = String(s.draws));
    assetsEl && (assetsEl.textContent = String(s.assets));
  }, 500);

  function log(msg: string) {
    const el = document.getElementById("log"); if (!el) return;
    const p = document.createElement("div"); p.textContent = msg; el.appendChild(p);
    el.scrollTop = el.scrollHeight;
  }

  const api: CanvasMindAPI = {
    refreshRegistry,
    applySkybox,
    spawnMesh,
    batchSpawn,
    clearScene,
    screenshot,
    setGround,
    setQuality,

    // character & props
    async loadRose(url: string = "/assets/rose.glb") { const n = await loadRose(scene, url); adoptToRoot(n as any); return n; },
    unloadRose() { return unloadRose(scene); },
    playRoseAction(action: "walk" | "run" | "jump", loops = 2) { return playRoseAction(action, loops); },

    loadTestBall() {
      const res = loadTestBall(scene) as { node: THREE.Object3D } | any;
      const node = res?.node ?? res;
      adoptToRoot(node);
    },
    unloadTestBall() { unloadTestBall(scene); },

    async loadImportedBall(url: string) { const n = await loadImportedBall(scene, url); adoptToRoot(n as any); return n; },
    unloadImportedBall() { unloadImportedBall(scene); },

    // grass
    loadGrass, unloadGrass, updateGrass,

    // editor/gizmo
    setGizmoMode(mode) { gizmo.setMode(mode); },
    clearSelection() { selector.clear(); gizmo.detach(); },
    deleteSelection() { selector.deleteSelected(); gizmo.detach(); },
    duplicateSelection() { selector.duplicateSelected(); attachGizmoToLast(); },
    flipSelectionXZ() { for (const o of selector.selected) { o.scale.x *= -1; o.scale.z *= -1; } selector.markDirty(); },

    // skybox shaping
    setBackgroundExposure, setBackgroundBlur,

    // procedural
    async startProcedural() { await startProcedural(); },
    stopProcedural() { stopProcedural(); },

    // splats
    spawnSplatDemo,
    loadSplatPLY,
    loadSplatFromFile,
    clearSplats,

    getState,
    dispose() {
      clearInterval(hudTimer);
      clearInterval(renderListTimer);
      cancelAnimationFrame(animId);
      ro.disconnect();
      window.removeEventListener("resize", resize);
      clearScene();
      renderer.dispose();
      rootDiv.innerHTML = "";
    }
  };
  (window as any).CanvasMindApp = api;

  // enable picking on spawn root
  markSelectableDeep(rootGroup, true);

  return api;
}

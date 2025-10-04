import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { initCanvasMind } from "./canvasmind/init";
import { makeShadowCatcher } from "./three/shadow-catcher";
import { sendTelemetry, scoreCandidates } from "./canvasmind/telemetry/client";

// NEW: Rose + props controls
import { loadRose, unloadRose, playRoseAction, updateRose } from "./three/roseLoader";
import { loadTestBall, unloadTestBall } from "./canvasmind/plugins/animator/testBall";
import { loadImportedBall, unloadImportedBall } from "./canvasmind/plugins/animator/importedBall";

const DEV = true;
const vlog = (...a: any[]) => DEV && console.info("[CanvasMind]", ...a);

/* ─────────────────────────  Types  ───────────────────────── */
type MCPRegistryItem = {
  id: string; name: string; server_url: string; tags: string[]; capabilities: string[];
};
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
  node.traverse((o: any) => { if (o.isMesh) { try { o.geometry?.dispose?.(); } catch {} disposeMaterial(o.material); } });
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
  // NEW
  loadRose(url?: string): Promise<any>;
  unloadRose(): void;
  playRoseAction(action: "walk" | "run" | "jump", loops?: number): void;
  loadTestBall(): void;
  unloadTestBall(): void;
  loadImportedBall(url: string): Promise<any>;
  unloadImportedBall(): void;

  getState(): { assets: number; fps: number; draws: number; budget: ReturnType<BudgetManager["stats"]> };
  dispose(): void;
};

/* ─────────────────────  Boot function  ───────────────────── */
export async function bootOnCanvas(rootDiv: HTMLElement): Promise<CanvasMindAPI> {
  // Canvas
  const canvas = document.createElement("canvas");
  canvas.style.width = "100%"; canvas.style.height = "100%";
  rootDiv.appendChild(canvas);

  // Renderer
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio ?? 1, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0f18);

  // Camera + controls
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
  camera.position.set(5, 3, 7);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 1, 0); controls.update();

  // Lights
  const dirLight = new THREE.DirectionalLight(0xffffff, 2);
  dirLight.position.set(5, 10, 6);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(2048, 2048);
  scene.add(dirLight, new THREE.AmbientLight(0xffffff, 0.4));

  const grid = new THREE.GridHelper(20, 20, 0x334155, 0x1f2937);
  scene.add(grid);

  // Shadow catcher ground
  const shadowPlane = makeShadowCatcher(60, 0.35);
  shadowPlane.position.y = 0;
  scene.add(shadowPlane);

  const rootGroup = new THREE.Group();
  scene.add(rootGroup);

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

  // DCWO registry (lightweight)
  const DCWO_REG = new Map<string, DCWO>();
  const register = (w: DCWO) => DCWO_REG.set(w.id, w);
  const clearDCWOs = () => {
    for (const w of DCWO_REG.values()) {
      // @ts-expect-error
      if (w.node?.dispose) (w.node as any).dispose();
      // @ts-expect-error
      if (w.node?.parent) (w.node as any).parent.remove(w.node);
    }
    DCWO_REG.clear();
  };

  // Telemetry/FPS
  let frames = 0, lastFpsTick = performance.now();
  let fps = 0, draws = 0;
  let lastRenderNow = performance.now();
  let animId = 0;
  const animate = (now: number) => {
    animId = requestAnimationFrame(animate);

    // delta for animation mixers
    const deltaSec = (now - lastRenderNow) / 1000;
    lastRenderNow = now;

    // >>> NEW: advance Rose mixer
    updateRose(deltaSec);

    frames++;
    if (now - lastFpsTick >= 1000) {
      fps = frames; frames = 0; lastFpsTick = now;
      draws = renderer.info.render.calls; renderer.info.reset();
      const b = budgets.stats(); // adaptive quality (downshift when crowded)
      const crowded = b.nodes > b.caps.nodes * 0.9 || b.mb > b.caps.texMemMB * 0.9;
      dirLight.shadow.mapSize.set(crowded ? 1024 : 2048, crowded ? 1024 : 2048);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio ?? 1, crowded ? 1.25 : 1.75));
    }
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

  // MCP mocks
  const MCP_REGISTRY: MCPRegistryItem[] = [
    { id: "nebula-skybox", name: "Nebula Skybox Generator (mock)", server_url: "/mcp/nebula", tags: ["skybox","texture"], capabilities: ["generate_skybox"] },
    { id: "mesh-boulder",  name: "Basalt Boulder Mesh (mock)",    server_url: "/mcp/mesh",   tags: ["mesh","glb"],    capabilities: ["generate_mesh"] }
  ];
  async function fetchRegistry(): Promise<MCPRegistryItem[]> { return MCP_REGISTRY; }

  async function callMCP<TOut>(serverUrl: string, endpoint: string, body: Record<string, unknown>): Promise<TOut> {
    if (serverUrl.endsWith("/nebula") && endpoint === "generate_skybox") {
      const url = "https://threejs.org/examples/textures/2294472375_24a3b8ef46_o.jpg";
      return {
        asset: { kind: "texture.equirect", urls: [url], mime: "image/jpeg" },
        provenance: { server: serverUrl, model: "nebula-mock-v1", prompt: body?.["prompt"] as string, seed: (body?.["seed"] as number) ?? 42, ts: Date.now() },
        budget_hint: { tex_mem_mb_est: 32 }
      } as unknown as TOut;
    }
    if (serverUrl.endsWith("/mesh") && endpoint === "generate_mesh") {
      const url = "https://threejs.org/examples/models/gltf/DamagedHelmet/glTF/DamagedHelmet.gltf";
      return {
        asset: { kind: "model.gltf", url },
        provenance: { server: serverUrl, model: "mesh-mock-v1", prompt: body?.["prompt"] as string, seed: (body?.["seed"] as number) ?? 1337, ts: Date.now() },
        budget_hint: { tris_est: 20000 }
      } as unknown as TOut;
    }
    throw new Error(`Unknown MCP endpoint ${serverUrl}/${endpoint}`);
  }

  /* ───────────────  Actions  ─────────────── */
  async function refreshRegistry() {
    const items = await fetchRegistry();
    const sel = document.getElementById("serverSelect") as HTMLSelectElement | null;
    if (sel) {
      sel.innerHTML = "";
      items.forEach((i) => { const opt = document.createElement("option"); opt.value = i.id; opt.textContent = `${i.name} (${i.tags.join(",")})`; sel.appendChild(opt); });
    }
    log(`Registry loaded: ${items.length} servers`);
  }

  // keep the last env to dispose properly
  let lastEnvTex: THREE.Texture | null = null;
  async function applySkybox(promptText: string) {
    const server = (await fetchRegistry()).find((r) => r.tags.includes("skybox"));
    if (!server) throw new Error("No skybox server found");
    log(`Calling MCP ${server.id}/generate_skybox …`);

    const out = await callMCP<SkyboxOut>(server.server_url, "generate_skybox", { prompt: promptText, seed: 42, format: "equirect" });

    const tex = await new THREE.TextureLoader().loadAsync(out.asset.urls[0]);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    scene.background = tex;

    // Dispose previous env
    if (lastEnvTex) try { lastEnvTex.dispose(); } catch {}
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envMap = pmrem.fromEquirectangular(tex).texture;
    scene.environment = envMap;
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

    // Telemetry
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

  async function spawnMesh() {
    // backpressure guard
    const s = budgets.stats();
    if (s.nodes >= s.caps.nodes) { log("Spawn refused (node cap reached)."); return; }

    const server = (await fetchRegistry()).find((r) => r.tags.includes("mesh"));
    if (!server) throw new Error("No mesh server found");
    log(`Calling MCP ${server.id}/generate_mesh …`);

    // 1) generate a few candidates (K=3 mock)
    const K = 3;
    const candidates: MeshOut[] = [];
    for (let i = 0; i < K; i++) {
      const out = await callMCP<MeshOut>(server.server_url, "generate_mesh", {
        prompt: "basalt boulder with wet sheen", seed: 1337 + i
      });
      candidates.push(out);
    }

    // 2) simple features → score
    const feats: number[][] = candidates.map(c => {
      const t = c.budget_hint?.tris_est ?? 20000;
      const p = (c.provenance.prompt ?? "").length % 100;
      const sSeed = (c.provenance.seed ?? 0) % 997;
      return [t / 100000, p / 100, sSeed / 1000, 1,0,0,0,0,0,0,0,0,0,0,0,0];
    });
    const scores = await scoreCandidates("http://localhost:8088", feats, 16);
    let bestIdx = 0; let best = -Infinity;
    scores.forEach((sc, i) => { if (sc > best) { best = sc; bestIdx = i; } });
    const chosen = candidates[bestIdx];

    // 3) Load chosen GLTF
    const gltf = await gltfLoader.loadAsync(chosen.asset.url);

    // If single mesh, try instancing
    let usedInstancing = false;
    gltf.scene.updateMatrixWorld(true);
    const firstMesh = gltf.scene.getObjectByProperty("type", "Mesh") as THREE.Mesh | null;

    if (firstMesh && firstMesh.geometry && firstMesh.material) {
      const trisEst = chosen.budget_hint?.tris_est ?? 20000;
      const entry = instPool.getOrCreate(chosen.asset.url, firstMesh, trisEst, 2000);
      if (!entry.inst.parent) {
        rootGroup.add(entry.inst);
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

    // Fallback: normal object with LOD
    if (!usedInstancing) {
      const node = makeBasicLOD(gltf.scene);
      node.position.set((Math.random() * 4 - 2), 0, (Math.random() * 4 - 2));
      node.traverse((o: any) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
      rootGroup.add(node);

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

    // 4) Telemetry for the chosen mesh
    await sendTelemetry("http://localhost:8088", {
      prompt: String(chosen.provenance.prompt ?? ""),
      candidate: { type: "mesh", model: chosen.provenance.model, seed: chosen.provenance.seed, score: best },
      chosen: true, dwell_time: 0
    });
  }

  async function batchSpawn(count: number) {
    const MAX_INFLIGHT = 4; // throttle
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

  function clearScene() {
    // env/background
    const bg: any = scene.background;
    if (bg?.dispose) try { bg.dispose(); } catch {}
    scene.background = new THREE.Color(0x0a0f18);
    scene.environment = null;
    if (lastEnvTex) { try { lastEnvTex.dispose(); } catch {} lastEnvTex = null; }

    // instancing
    instPool.disposeAll(scene);

    // meshes
    while (rootGroup.children.length) disposeObject3D(rootGroup.children[0]);

    // registry + budgets
    clearDCWOs();
    budgets.clearAll();
    budgets = new BudgetManager(budgets.caps); // reset book-keeping
    (renderer as any).renderLists?.dispose?.();

    log("Scene cleared.");
  }

  function setGround(y: number, rx: number, rz: number) {
    shadowPlane.position.y = y;
    shadowPlane.rotation.x = -Math.PI / 2 + rx;
    shadowPlane.rotation.z = rz;
  }

  function setQuality(mode: "performance" | "balanced" | "quality") {
    if (mode === "performance") {
      budgets.caps = { texMemMB: 256, tris: 800_000, nodes: 80 };
      renderer.setPixelRatio(Math.min(window.devicePixelRatio ?? 1, 1.25));
      dirLight.shadow.mapSize.set(1024, 1024);
    } else if (mode === "balanced") {
      budgets.caps = { texMemMB: 512, tris: 1_500_000, nodes: 120 };
      renderer.setPixelRatio(Math.min(window.devicePixelRatio ?? 1, 1.5));
      dirLight.shadow.mapSize.set(2048, 2048);
    } else {
      budgets.caps = { texMemMB: 1024, tris: 3_000_000, nodes: 200 };
      renderer.setPixelRatio(Math.min(window.devicePixelRatio ?? 1, 2));
      dirLight.shadow.mapSize.set(4096, 4096);
    }
  }

  function screenshot() {
    const data = renderer.domElement.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = data; a.download = `canvasmind_${Date.now()}.png`; a.click();
  }

  function getState() {
    return { assets: DCWO_REG.size, fps, draws, budget: budgets.stats() };
  }

  // HTML buttons (if present)
  bindOptionalHtmlUi({
    applySkybox, spawnMesh, batchSpawn, clearScene, screenshot, refreshRegistry
  });

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

    // NEW: public API for Rose + props
    async loadRose(url: string = "/assets/rose.glb") { return loadRose(scene, url); },
    unloadRose() { return unloadRose(scene); },
    playRoseAction(action: "walk" | "run" | "jump", loops = 2) { return playRoseAction(action, loops); },
    loadTestBall() { loadTestBall(scene); },
    unloadTestBall() { unloadTestBall(scene); },
    async loadImportedBall(url: string) { return loadImportedBall(scene, url); },
    unloadImportedBall() { unloadImportedBall(scene); },

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
  return api;
}

/* ───────────  Optional: keep native HTML buttons working  ─────────── */
function bindOptionalHtmlUi(api: {
  applySkybox(prompt: string): Promise<void>;
  spawnMesh(): Promise<void>;
  batchSpawn(count: number): Promise<void>;
  clearScene(): void;
  screenshot(): void;
  refreshRegistry(): Promise<void>;
}) {
  const $ = (id: string) => document.getElementById(id);
  // existing controls
  $("btnSkybox")?.addEventListener("click", () => {
    const prompt = (document.getElementById("prompt") as HTMLInputElement | null)?.value?.trim() || "aurora nebula";
    api.applySkybox(prompt);
  });
  $("btnMesh")?.addEventListener("click", () => api.spawnMesh());
  $("btnClear")?.addEventListener("click", () => api.clearScene());
  $("btnShot")?.addEventListener("click", () => api.screenshot());
  $("btnRefresh")?.addEventListener("click", () => api.refreshRegistry());

  const gY  = $("groundY")  as HTMLInputElement | null;
  const gRX = $("groundRX") as HTMLInputElement | null;
  const gRZ = $("groundRZ") as HTMLInputElement | null;
  [gY, gRX, gRZ].forEach((el) => el?.addEventListener("input", () => {
    const y  = parseFloat(gY?.value ?? "0");
    const rx = parseFloat(gRX?.value ?? "0");
    const rz = parseFloat(gRZ?.value ?? "0");
    (window as any).CanvasMindApp?.setGround(y, rx, rz);
  }));

  // NEW: Rose + Props buttons
  $("btnLoadRose")?.addEventListener("click", () => {
    const url = (document.getElementById("roseUrl") as HTMLInputElement | null)?.value?.trim() || "/assets/rose.glb";
    (window as any).CanvasMindApp?.loadRose?.(url);
  });
  $("btnUnloadRose")?.addEventListener("click", () => {
    (window as any).CanvasMindApp?.unloadRose?.();
  });
  $("btnRoseWalk")?.addEventListener("click", () => {
    (window as any).CanvasMindApp?.playRoseAction?.("walk", 2);
  });
  $("btnRoseRun")?.addEventListener("click", () => {
    (window as any).CanvasMindApp?.playRoseAction?.("run", 2);
  });
  $("btnRoseJump")?.addEventListener("click", () => {
    (window as any).CanvasMindApp?.playRoseAction?.("jump", 1);
  });

  $("btnLoadTestBall")?.addEventListener("click", () => {
    (window as any).CanvasMindApp?.loadTestBall?.();
  });
  $("btnUnloadTestBall")?.addEventListener("click", () => {
    (window as any).CanvasMindApp?.unloadTestBall?.();
  });

  $("btnLoadImportedBall")?.addEventListener("click", () => {
    const url = (document.getElementById("importedBallUrl") as HTMLInputElement | null)?.value?.trim();
    if (url) (window as any).CanvasMindApp?.loadImportedBall?.(url);
  });
  $("btnUnloadImportedBall")?.addEventListener("click", () => {
    (window as any).CanvasMindApp?.unloadImportedBall?.();
  });

  // Hotkeys for dev
  window.addEventListener("keydown", (e) => {
    if (e.key === "1") (window as any).CanvasMindApp?.loadRose?.("/assets/rose.glb");
    if (e.key === "2") (window as any).CanvasMindApp?.playRoseAction?.("walk", 2);
    if (e.key === "3") (window as any).CanvasMindApp?.playRoseAction?.("run", 2);
    if (e.key === "4") (window as any).CanvasMindApp?.playRoseAction?.("jump", 1);
    if (e.key === "0") (window as any).CanvasMindApp?.unloadRose?.();

    if (e.key === "t") (window as any).CanvasMindApp?.loadTestBall?.();
    if (e.key === "y") (window as any).CanvasMindApp?.unloadTestBall?.();
  });
}

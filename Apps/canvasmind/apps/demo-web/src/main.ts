import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { initCanvasMind, CanvasMindContext } from "./canvasmind/init";
import { makeShadowCatcher } from "./three/shadow-catcher";

/* ---------------- Types ---------------- */
type MCPRegistryItem = {
  id: string;
  name: string;
  server_url: string;
  tags: string[];
  capabilities: string[];
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
  id: string;
  node?: T;
  context: {
    semantics: string[];
    provenance: Record<string, unknown>;
    constraints?: Record<string, unknown>;
    acl?: { roles: Record<string, string[]> };
    telemetry?: Record<string, unknown>;
  };
  policy: Record<string, unknown>;
};

/* ---------------- DOM helpers ---------------- */
const $ = (id: string) => document.getElementById(id)! as HTMLElement;
const log = (msg: string) => {
  const p = document.createElement("div");
  p.textContent = msg;
  $("log").appendChild(p);
  $("log").scrollTop = $("log").scrollHeight;
};

/* ---------------- HUD refs ---------------- */
const fpsEl = $("fps");
const drawsEl = $("draws");
const assetsEl = $("assets");

/* ---------------- Three.js setup ---------------- */
const canvas = $("scene") as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio ?? 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0f18);

const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
camera.position.set(5, 3, 7);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 1, 0);
controls.update();

const dirLight = new THREE.DirectionalLight(0xffffff, 2);
dirLight.position.set(5, 10, 6);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048);

scene.add(dirLight, new THREE.AmbientLight(0xffffff, 0.4));

const grid = new THREE.GridHelper(20, 20, 0x334155, 0x1f2937);
scene.add(grid);

// Shadow-catcher ground (align with sliders)
const shadowPlane = makeShadowCatcher(60, 0.35);
shadowPlane.position.y = 0;
scene.add(shadowPlane);

const rootGroup = new THREE.Group();
scene.add(rootGroup);

function onResize() {
  const w = canvas.clientWidth || canvas.getBoundingClientRect().width;
  const h = window.innerHeight * 0.75;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", onResize);
onResize();

/* ---------------- DCWO Registry ---------------- */
const DCWO_REG = new Map<string, DCWO>();
const registerDCWO = (w: DCWO) => { DCWO_REG.set(w.id, w); updateHud(); };
const clearDCWOs = () => {
  for (const w of DCWO_REG.values()) {
    // @ts-expect-error dispose if present
    if (w.node?.dispose) (w.node as any).dispose();
    // @ts-expect-error detach if present
    if (w.node?.parent) (w.node as any).parent.remove(w.node);
  }
  DCWO_REG.clear();
  updateHud();
};
function updateHud() { assetsEl.textContent = String(DCWO_REG.size); }

/* ---------------- Telemetry ---------------- */
let frames = 0;
let lastSec = performance.now();
function animate(now: number) {
  frames++;
  if (now - lastSec >= 1000) {
    fpsEl.textContent = String(frames);
    frames = 0; lastSec = now;
    drawsEl.textContent = String(renderer.info.render.calls);
    renderer.info.reset();
  }
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

/* ---------------- MCP mock registry ---------------- */
const MCP_REGISTRY: MCPRegistryItem[] = [
  { id: "nebula-skybox", name: "Nebula Skybox Generator (mock)", server_url: "/mcp/nebula", tags: ["skybox","texture"], capabilities: ["generate_skybox"] },
  { id: "mesh-boulder", name: "Basalt Boulder Mesh (mock)", server_url: "/mcp/mesh", tags: ["mesh","glb"], capabilities: ["generate_mesh"] }
];
async function fetchRegistry(): Promise<MCPRegistryItem[]> { return MCP_REGISTRY; }

async function callMCP<TOut>(serverUrl: string, endpoint: string, body: Record<string, unknown>): Promise<TOut> {
  if (serverUrl.endsWith("/nebula") && endpoint === "generate_skybox") {
    const url = "https://threejs.org/examples/textures/2294472375_24a3b8ef46_o.jpg";
    return {
      asset: { kind: "texture.equirect", urls: [url], mime: "image/jpeg" },
      provenance: { server: serverUrl, model: "nebula-mock-v1", prompt: body?.prompt as string, seed: (body?.seed as number) ?? 42, ts: Date.now() },
      budget_hint: { tex_mem_mb_est: 32 }
    } as unknown as TOut;
  }
  if (serverUrl.endsWith("/mesh") && endpoint === "generate_mesh") {
    const url = "https://threejs.org/examples/models/gltf/DamagedHelmet/glTF/DamagedHelmet.gltf";
    return {
      asset: { kind: "model.gltf", url },
      provenance: { server: serverUrl, model: "mesh-mock-v1", prompt: body?.prompt as string, seed: (body?.seed as number) ?? 1337, ts: Date.now() },
      budget_hint: { tris_est: 20000 }
    } as unknown as TOut;
  }
  throw new Error(`Unknown MCP endpoint ${serverUrl}/${endpoint}`);
}

/* ---------------- Skybox installer ---------------- */
async function applyMcpSkybox(promptText: string) {
  const server = (await fetchRegistry()).find((r) => r.tags.includes("skybox"));
  if (!server) throw new Error("No skybox server found");

  log(`Calling MCP ${server.id}/generate_skybox …`);
  const out = await callMCP<SkyboxOut>(server.server_url, "generate_skybox", {
    prompt: promptText, seed: 42, format: "equirect"
  });

  const tex = await new THREE.TextureLoader().loadAsync(out.asset.urls[0]);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  scene.background = tex;

  // IBL reflections from background
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envMap = pmrem.fromEquirectangular(tex).texture;
  scene.environment = envMap;
  pmrem.dispose();

  registerDCWO({
    id: `skybox_${out.provenance.seed}`,
    node: tex,
    context: { semantics: ["skybox"], provenance: out.provenance },
    policy: { allow: { background: true } }
  });
  log(`Skybox applied • model=${out.provenance.model} seed=${out.provenance.seed}`);
}

/* ---------------- Mesh installer ---------------- */
async function spawnMcpMesh() {
  const server = (await fetchRegistry()).find((r) => r.tags.includes("mesh"));
  if (!server) throw new Error("No mesh server found");

  log(`Calling MCP ${server.id}/generate_mesh …`);
  const out = await callMCP<MeshOut>(server.server_url, "generate_mesh", {
    prompt: "basalt boulder with wet sheen", seed: 1337
  });

  const gltf = await new GLTFLoader().loadAsync(out.asset.url);
  const node = gltf.scene;
  node.position.set((Math.random() * 4 - 2), 0, (Math.random() * 4 - 2));
  node.traverse((o: any) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  rootGroup.add(node);

  registerDCWO({
    id: `mesh_${out.provenance.seed}_${Math.random().toString(36).slice(2,6)}`,
    node,
    context: { semantics: ["mesh"], provenance: out.provenance },
    policy: { allow: { transform: true } }
  });
  log(`Mesh spawned • model=${out.provenance.model} seed=${out.provenance.seed}`);
}

/* ---------------- Init CanvasMind ---------------- */
const ctx: CanvasMindContext = await initCanvasMind({
  scene,
  renderer,
  features: { worldField: false }, // can enable later
  budgets: { texMemSoftCapMB: 128, trisSoftCap: 1_000_000 }
});

/* ---------------- UI wiring ---------------- */
($("btnRefresh") as HTMLButtonElement).onclick = async () => {
  const items = await fetchRegistry();
  const sel = $("serverSelect") as HTMLSelectElement;
  sel.innerHTML = "";
  items.forEach((i) => {
    const opt = document.createElement("option");
    opt.value = i.id;
    opt.textContent = `${i.name} (${i.tags.join(",")})`;
    sel.appendChild(opt);
  });
  log(`Registry loaded: ${items.length} servers`);
};

($("btnSkybox") as HTMLButtonElement).onclick = async () => {
  await applyMcpSkybox((($("prompt") as HTMLInputElement).value || "").trim() || "aurora nebula");
};
($("btnMesh") as HTMLButtonElement).onclick = spawnMcpMesh;

($("btnClear") as HTMLButtonElement).onclick = () => {
  scene.background = new THREE.Color(0x0a0f18);
  while (rootGroup.children.length) rootGroup.remove(rootGroup.children[0]);
  clearDCWOs();
  log("Scene cleared.");
};

// Screenshot
(document.getElementById("btnShot") as HTMLButtonElement | null)?.addEventListener("click", () => {
  const data = renderer.domElement.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = data;
  a.download = `canvasmind_${Date.now()}.png`;
  a.click();
});

// Ground-align sliders
const gY  = document.getElementById("groundY")  as HTMLInputElement | null;
const gRX = document.getElementById("groundRX") as HTMLInputElement | null;
const gRZ = document.getElementById("groundRZ") as HTMLInputElement | null;
[gY, gRX, gRZ].forEach((el) =>
  el?.addEventListener("input", () => {
    shadowPlane.position.y = parseFloat(gY?.value ?? "0");
    shadowPlane.rotation.x = -Math.PI / 2 + parseFloat(gRX?.value ?? "0");
    shadowPlane.rotation.z = parseFloat(gRZ?.value ?? "0");
  })
);

// Keyboard shortcuts: G=skybox, M=mesh, B=batch, C=clear
window.addEventListener("keydown", async (e) => {
  if (e.key === "g") ($("btnSkybox") as HTMLButtonElement).click();
  if (e.key === "m") ($("btnMesh") as HTMLButtonElement).click();
  if (e.key === "b") for (let k = 0; k < 5; k++) await spawnMcpMesh();
  if (e.key === "c") ($("btnClear") as HTMLButtonElement).click();
});

// Initial registry load
($("btnRefresh") as HTMLButtonElement).click();

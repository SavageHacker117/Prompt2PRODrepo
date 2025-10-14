// src/App.tsx
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import { createRenderer } from "./game/engine/renderer";
import { createSceneWithBackdrop, StationId, addSpiderBackdrop } from "./game/engine/scene";
import { createCamera } from "./game/engine/camera";
import { createInput } from "./game/engine/input";
import { createTerrain, Terrain } from "./game/engine/terrain";
import { createPhysics } from "./game/engine/physics";
import { createDigger } from "./game/gameplay/digger";
import { createSurfaceDinos } from "./game/gameplay/mobs";
import { createVendors, VendorInfo } from "./game/gameplay/vendors";

import HUD from "./game/ui/HUD";
import MarketScreen from "./game/ui/MarketScreen";
import ContractBoard from "./game/ui/ContractBoard";
import MenuOverlay from "./game/ui/MenuOverlay";
import FabMenuButton from "./game/ui/FabMenuButton";
import VendorShop from "./game/ui/VendorShop";

// Dev overlays
import DebugOverlay from "./game/ui/DebugOverlay";
import DevTools from "./game/ui/DevTools";
import { createDebug } from "./game/engine/debug";
import { createSelector, Selector } from "./game/debug/selector";
import { dlog, getLog } from "./game/debug/log";

// Inventory (data)
import { createInventory, Inventory } from "./game/gameplay/inventory";

type BackdropName = "HomeBase" | "BioDome" | "OilRefine";
type MinerModel = "superdigger_rig.glb" | "mech.glb";

const ICONS = {
  ak47: "/src/assets/ui/icons/ak47.png",
  chainsaw: "/src/assets/ui/icons/chainsaw.png",
  tnt: "/src/assets/ui/icons/tnt.png",
  c4: "/src/assets/ui/icons/c4.png",
} as const;

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);

  const [hud, setHud] = useState({ health: 100, fuel: 100, depth: 0, credits: 0, hint: "" });
  const [ui, setUi] = useState<{ market?: boolean; contracts?: boolean; menu?: boolean; vendor?: VendorInfo | null }>({});
  const [miner, setMiner] = useState<MinerModel>("superdigger_rig.glb");
  const [backdrop, setBackdrop] = useState<BackdropName>("HomeBase");

  // Inventory model + quickbar (10 slots)
  const [invOpen, setInvOpen] = useState(false);
  const [inventory] = useState<Inventory>(() => {
    const inv = createInventory(12);
    inv.add("chainsaw", 1);
    inv.add("ak47", 1);
    inv.add("tnt", 3);
    inv.add("c4", 1);
    return inv;
  });
  const [quick, setQuick] = useState<(string | null)[]>(["chainsaw", "ak47", "tnt", "c4", null, null, null, null, null, null]);
  const [slotSel, setSlotSel] = useState(0);

  // Dev overlays OFF by default; toggle with `
  const [devVisible, setDevVisible] = useState(false);
  const [dbg, setDbg] = useState<ReturnType<typeof createDebug> | null>(null);
  const [selector, setSelector] = useState<Selector | null>(null);
  const [selStats, setSelStats] = useState<{ selected?: string; count: number; fps: number; cam: THREE.Vector3 }>({
    selected: undefined, count: 0, fps: 0, cam: new THREE.Vector3()
  });
  const [showHits, setShowHits] = useState(true);

  // stop page scroll so wheel/space don’t move the document
  useEffect(() => {
    const stop = (e: Event) => e.preventDefault();
    document.body.style.overflow = "hidden";
    window.addEventListener("touchmove", stop, { passive: false });
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("touchmove", stop);
    };
  }, []);

  // Publish equip hook so we can change tools without rebuilding scene
  useEffect(() => {
    (window as any).__applyEquipped = (id: string | null) => {
      // no-op until the world effect wires this up
    };
  }, []);

  // World boot (runs once; we keep the scene alive)
  useEffect(() => {
    const container = mountRef.current!;
    const renderer = createRenderer(container);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // Block wheel from scrolling the page
    const wheelBlock = (e: WheelEvent) => e.preventDefault();
    renderer.domElement.addEventListener("wheel", wheelBlock, { passive: false });

    const camera = createCamera();
    const input = createInput(container);

    // Terrain
    const terrain: Terrain = createTerrain(scene);
    const worldWidth = terrain.size.W * terrain.size.S;
    const groundY = -terrain.size.S * 0.5;

    // Backdrops + buildings (raised slightly)
    addSpiderBackdrop(scene, worldWidth, 2.0, groundY, -2, -120);
    let stations = createSceneWithBackdrop(scene, "HomeBase", worldWidth + 6, groundY, -0.05);

    // Physics + player
    const physics = createPhysics(terrain);
    let digger = createDigger(scene, { model: "superdigger_rig.glb", start: new THREE.Vector3(0, 0, 0) });

    // Ecosystem
    const dinos = createSurfaceDinos(scene, worldWidth, groundY, 6);
    const vendors = createVendors(scene, worldWidth, groundY);

    // Camera follow + wheel zoom + Q/E dolly (camera dolly)
    let camDist = 26;
    const CAM_MIN = 10, CAM_MAX = 90;
    camera.position.set(0, 8, camDist);

    (scene as any).__camera = camera;
    (scene as any).__renderer = renderer;
    (scene as any).__terrainPick = (ray: THREE.Raycaster, cb: (key: string) => void) => {
      const hit = terrain.raycast(ray); if (hit) cb(hit.key);
    };

    // Debug + selector
    const debug = createDebug(scene, camera, groundY, worldWidth);
    debug.attach(renderer.domElement);
    setDbg(debug);

    const sel = createSelector(scene, camera, renderer.domElement, groundY);
    sel.setShowHitboxes(showHits);
    sel.register({ id: "digger", group: digger.group, radius: 1.2 });
    setSelector(sel);
    debug.state.log("debug online");

    // Shared state
    const state = {
      credits: 0,
      docking: null as StationId | null,
      nearVendor: null as VendorInfo | null,
      accum: 0,
      step: 1 / 60,
      running: true,
    };
    (window as any).__addCredits = (delta: number) => {
      state.credits = Math.max(0, state.credits + delta);
      setHud((h) => ({ ...h, credits: state.credits }));
      dlog("credits", { delta, total: state.credits });
    };

    // Equip logic (no scene rebuild)
    const applyEquippedVisual = (id: string | null) => {
      if (!id) return;
      if (id === "chainsaw") {
        digger.attachTool("left", "../../assets/models/tools/Saw.glb");
      } else if (id === "ak47") {
        digger.attachTool("right", "../../assets/models/tools/Ak47.glb");
      } else if (id === "tnt") {
        digger.attachTool("left", "../../assets/models/tools/tnt.glb");
      } else if (id === "c4") {
        digger.attachTool("left", "../../assets/models/tools/c4.glb");
      }
    };
    (window as any).__applyEquipped = applyEquippedVisual;
    applyEquippedVisual(quick[slotSel] ?? null); // initial

    // Swap miner/backdrop
    const swapMiner = (next: MinerModel) => {
      const pos = digger.group.position.clone();
      const old = digger.group;
      digger = createDigger(scene, { model: next, start: pos });
      sel.register({ id: `digger-${next}`, group: digger.group, radius: 1.2 });
      old.visible = false;
      setTimeout(() => scene.remove(old), 0);
      setMiner(next);
      setUi((s) => ({ ...s, menu: false }));
      applyEquippedVisual(quick[slotSel] ?? null);
    };
    const swapBackdrop = (b: BackdropName) => {
      scene.remove(stations.plane);
      stations = createSceneWithBackdrop(scene, b, worldWidth + 6, groundY, -0.05);
      setBackdrop(b);
      setUi((s) => ({ ...s, menu: false }));
    };
    (window as any).__swapMiner = swapMiner;
    (window as any).__swapBackdrop = swapBackdrop;

    // UI hotkeys (panel / inventory / dev)
    input.onKey((code, down) => {
      if (code === "Escape" && (ui.market || ui.contracts || ui.menu || ui.vendor || invOpen)) {
        setUi({});
        setInvOpen(false);
      }
      if (!down) return;
      if (code === "KeyU" || code === "KeyI") setInvOpen((v) => !v);
      if (code === "KeyM") setUi((s) => ({ ...s, menu: !s.menu }));
    });
    const globalKey = (e: KeyboardEvent) => {
      if (e.key === "`") setDevVisible((v) => !v);
      // number keys for quickbar select (1..0)
      if (e.code.startsWith("Digit")) {
        const n = parseInt(e.code.replace("Digit", ""), 10) % 10;
        setSlotSel((n === 0 ? 9 : n - 1));
        setTimeout(() => applyEquippedVisual(quick[(n === 0 ? 9 : n - 1)] ?? null), 0);
      }
    };
    window.addEventListener("keydown", globalKey);

    // Dolly with Q/E (camera dolly)
    const camDolly = (dt: number) => {
      const q = (input as any).isDown?.("KeyQ");
      const e = (input as any).isDown?.("KeyE");
      if (q) camDist = Math.min(CAM_MAX, camDist + 20 * dt);
      if (e) camDist = Math.max(CAM_MIN, camDist - 20 * dt);
    };

    // --------- FIREBALL system (AK-47 on F) ----------
    type Shot = { mesh: THREE.Mesh; vel: THREE.Vector3; ttl: number };
    const shots: Shot[] = [];
    let facingX = 1; // updated from movement input

    function spawnFireball() {
      const equipped = quick[slotSel];
      if (equipped !== "ak47") return;

      const geo = new THREE.SphereGeometry(0.28, 12, 12);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xff7b00,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(geo, mat);
      const mouth = digger.group.position.clone().add(new THREE.Vector3(facingX * 1.2, 0.6, 0));
      mesh.position.copy(mouth);
      const vel = new THREE.Vector3(facingX * 42, 0, 0); // fast & fun
      shots.push({ mesh, vel, ttl: 1.2 });
      scene.add(mesh);
    }

    // Key bind: F to shoot
    input.onKey((code, down) => {
      if (down && code === "KeyF") spawnFireball();
    });

    // Hold-to-mine ray
    const ray = new THREE.Raycaster();
    let mining = false;
    let mineTimer = 0;
    function updateRayFromPointer(ev: PointerEvent) {
      const rect = renderer.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((ev.clientX - rect.left) / rect.width) * 2 - 1,
        -((ev.clientY - rect.top) / rect.height) * 2 + 1
      );
      ray.setFromCamera(mouse, camera);
    }
    const onDown = (e: PointerEvent) => { if (e.button === 0) { mining = true; updateRayFromPointer(e); } };
    const onUp   = () => { mining = false; };
    const onMove = (e: PointerEvent) => { if (mining) updateRayFromPointer(e); };
    renderer.domElement.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    renderer.domElement.addEventListener("pointermove", onMove);

    // Use equipped helpers
    const equippedId = () => quick[slotSel] ?? null;
    function blastAround(key: string, radius: number) {
      const [gx, gy, gz] = key.split(",").map((s) => parseInt(s, 10));
      let earned = 0;
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dz = -radius; dz <= radius; dz++) {
            const k = `${gx + dx},${gy + dy},${gz + dz}`;
            earned += terrain.mine(k) || 0;
          }
        }
      }
      if (earned > 0) (window as any).__addCredits?.(earned);
    }

    // Loop
    let last = performance.now();
    let uiAccum = 0;
    let prevY = digger.group.position.y;

    function loop(now: number) {
      if (!state.running) return;
      requestAnimationFrame(loop);

      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      state.accum += dt;

      const wheel = (input as any).consumeWheel?.() ?? 0;
      if (wheel !== 0) camDist = Math.min(CAM_MAX, Math.max(CAM_MIN, camDist + wheel * 0.01));
      camDolly(dt);

      while (state.accum >= state.step) {
        const beforeY = digger.group.position.y;
        const interact = physics.step(digger, input, state.step);
        state.accum -= state.step;

        // update facing dir from horizontal input
        if ((input as any).isDown?.("KeyA") || (input as any).isDown?.("ArrowLeft")) facingX = -1;
        else if ((input as any).isDown?.("KeyD") || (input as any).isDown?.("ArrowRight")) facingX = 1;

        const afterY = digger.group.position.y;
        const vy = (afterY - beforeY) / state.step;

        // Gentle land OK, hard smack hurts
        const justLanded = beforeY < 0.05 && afterY === 0;
        if (justLanded && vy < -14) {
          const damage = Math.min(100, Math.round(Math.abs(vy) * 3));
          setHud((h) => ({ ...h, health: Math.max(0, h.health - damage), hint: "Ouch! Hard landing." }));
        }

        // Ecosystem
        dinos.update(state.step);
        vendors.update(state.step);

        // Proximity
        state.docking = stations.testDock(digger.getBounds());
        state.nearVendor = vendors.test(digger.getBounds());

        const hint = state.nearVendor
          ? `Press X to trade with ${state.nearVendor.name}`
          : state.docking
          ? `Press X to use ${state.docking}`
          : "LMB: mine • F: fireball (AK) • U/I: Inventory • M: Menu • `: Dev • Q/E: Dolly";

        setHud((h) => ({
          ...h,
          depth: Math.max(0, Math.round(-digger.group.position.y)),
          fuel: digger.fuel,
          credits: state.credits,
          hint,
        }));
        if (interact?.minedValue) state.credits += interact.minedValue;

        // click mine
        const req = digger.consumeMineRequest();
        if (req) {
          const id = equippedId();
          if (id === "tnt" || id === "c4") {
            if (inventory.remove(id, 1)) {
              blastAround(req.key, id === "tnt" ? 1 : 2);
              setHud((h) => ({ ...h, hint: `${id.toUpperCase()} detonated!` }));
            } else setHud((h) => ({ ...h, hint: `No ${id.toUpperCase()} left.` }));
          } else {
            const gained = terrain.mine(req.key);
            if (gained) (window as any).__addCredits?.(gained);
          }
        }

        // hold mining
        if (mining) {
          mineTimer -= state.step;
          if (mineTimer <= 0) {
            const hit = terrain.raycast(ray);
            if (hit) {
              const id = equippedId();
              if (id === "tnt" || id === "c4") {
                if (inventory.remove(id, 1)) {
                  blastAround(hit.key, id === "tnt" ? 1 : 2);
                  setHud((h) => ({ ...h, hint: `${id.toUpperCase()} detonated!` }));
                } else setHud((h) => ({ ...h, hint: `No ${id.toUpperCase()} left.` }));
                mineTimer = 0.22;
              } else {
                const gained = terrain.mine(hit.key);
                if (gained) (window as any).__addCredits?.(gained);
                mineTimer = 0.12;
              }
            } else {
              mineTimer = 0.06;
            }
          }
        }

        // update fireballs (movement + simple collision vs terrain)
        for (let i = shots.length - 1; i >= 0; i--) {
          const s = shots[i];
          s.mesh.position.addScaledVector(s.vel, state.step);
          s.ttl -= state.step;

          // short ray ahead to catch a block
          const dir = s.vel.clone().normalize();
          const r = new THREE.Raycaster(s.mesh.position, dir, 0, 0.6);
          const hit = terrain.raycast(r);
          if (hit) {
            terrain.mine(hit.key);
            scene.remove(s.mesh);
            shots.splice(i, 1);
            continue;
          }
          if (s.ttl <= 0) {
            scene.remove(s.mesh);
            shots.splice(i, 1);
          }
        }

        selector?.update(state.step);
        uiAccum += state.step;
        if (uiAccum > 0.2 && selector) {
          setSelStats(selector.stats());
          uiAccum = 0;
        }
      }

      dbg?.update(dt);

      // follow camera
      camera.lookAt(digger.group.position);
      camera.position.lerp(
        new THREE.Vector3(
          digger.group.position.x,
          digger.group.position.y + 8,
          digger.group.position.z + camDist
        ),
        0.15
      );

      renderer.render(scene, camera);
    }
    requestAnimationFrame(loop);

    const onResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    return () => {
      state.running = false;
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", globalKey);
      renderer.domElement.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("wheel", wheelBlock as any);
      dbg?.detach(renderer.domElement);
      (input as any).dispose?.();
      renderer.dispose();
      container.innerHTML = "";
    };
    // deliberately no deps → world stays alive
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keep the equipped model in sync with quickbar/slot selection WITHOUT rebuilding world
  useEffect(() => {
    (window as any).__applyEquipped?.(quick[slotSel] ?? null);
  }, [quick, slotSel]);

  // --------- Quickbar + simple inventory overlay ----------
  const quickbar = (
    <div
      style={{
        position: "absolute",
        left: "50%",
        transform: "translateX(-50%)",
        bottom: 16,
        display: "grid",
        gridTemplateColumns: "repeat(10, 1fr)",
        gap: 8,
        padding: 10,
        borderRadius: 14,
        background: "rgba(10,16,24,.7)",
        border: "1px solid rgba(255,255,255,.12)",
        zIndex: 8000,
      }}
    >
      {quick.map((id, i) => (
        <button
          key={i}
          onClick={() => { setSlotSel(i); }}
          style={{
            width: 56, height: 56, borderRadius: 10,
            border: `2px solid ${i === slotSel ? "#7ef" : "rgba(255,255,255,.16)"}`,
            background: "rgba(26,36,54,.9)",
            display: "grid", placeItems: "center", cursor: "pointer"
          }}
          title={id ?? "Empty"}
        >
          {id ? <img src={ICONS[id as keyof typeof ICONS]} style={{ width: 36, height: 36, imageRendering: "pixelated" }} /> : <div style={{opacity:.3, fontSize:12}}>empty</div>}
        </button>
      ))}
    </div>
  );

  const invPanel = invOpen && (
    <div
      onClick={() => setInvOpen(false)}
      style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 9000, display: "grid", placeItems: "center" }}
    >
      <div onClick={(e)=>e.stopPropagation()} style={{ width: 620, maxWidth: "92vw", background:"rgba(14,22,33,.96)", border:"1px solid rgba(255,255,255,.14)", borderRadius:16, padding:14, color:"#eaf1ff", fontFamily:"ui-monospace,Consolas,monospace" }}>
        <div style={{display:"flex", justifyContent:"space-between", marginBottom:8}}>
          <b>INVENTORY</b><span style={{opacity:.7}}>Click item to assign to slot {((slotSel+1)%10)||10}</span>
        </div>
        <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(120px, 1fr))", gap:10}}>
          {inventory.stacks.map(s => (
            <button key={s.id}
              onClick={()=>{
                if (!s.qty) return;
                const next = [...quick];
                next[slotSel] = s.id;
                setQuick(next);
              }}
              style={{display:"flex", gap:10, alignItems:"center", padding:8, borderRadius:10, background:"#1b2a43", border:"1px solid rgba(255,255,255,.12)", cursor:"pointer"}}
            >
              <img src={ICONS[s.id as keyof typeof ICONS]} style={{width:32, height:32}}/>
              <div>
                <div style={{fontSize:12, opacity:.85}}>{s.id.toUpperCase()}</div>
                <div style={{fontSize:11, opacity:.6}}>x{s.qty}</div>
              </div>
            </button>
          ))}
        </div>
        <div style={{marginTop:10, textAlign:"right", opacity:.8}}>U / I to close</div>
      </div>
    </div>
  );

  // --------- Render ---------
  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }} ref={mountRef}>
      <HUD {...hud} />

      {ui.market && <MarketScreen onClose={() => setUi({})} />}
      {ui.contracts && <ContractBoard onClose={() => setUi({})} />}

      {ui.menu && (
        <MenuOverlay
          current={miner}
          onSwap={(m) => (window as any).__swapMiner?.(m)}
          onBackdrop={(b) => (window as any).__swapBackdrop?.(b)}
          onClose={() => setUi({})}
        />
      )}

      {ui.vendor && (
        <VendorShop
          vendor={ui.vendor}
          credits={hud.credits}
          onBuy={(item) => {
            if (hud.credits >= item.price) {
              (window as any).__addCredits?.(-item.price);
              setHud((h) => ({ ...h, hint: `Bought ${item.label}!` }));
              const id = item.id as string;
              if (["tnt","c4","ak47","chainsaw"].includes(id)) inventory.add(id, 1);
            }
          }}
          onClose={() => setUi({})}
        />
      )}

      <FabMenuButton onClick={() => setUi((s) => ({ ...s, menu: true }))} />

      {quickbar}
      {invPanel}

      {/* Dev overlays (toggle with backtick) */}
      {devVisible && dbg && (
        <DebugOverlay
          fps={dbg.state.fps}
          camPos={dbg.state.camPos}
          lookAt={dbg.state.lookAt}
          zoom={dbg.state.zoom}
          markers={dbg.state.markers}
          gizmos={dbg.state.gizmos}
          logs={dbg.state.logs}
          onSpawn={() => dbg.spawnMarker()}
          onClear={() => dbg.clearMarkers()}
          onToggle={() => dbg.toggleGizmos()}
          onCommand={(cmd) => dbg.state.log(`cmd: ${cmd}`)}
        />
      )}
      {devVisible && selector && dbg && (
        <DevTools
          selected={selStats.selected}
          picks={selStats.count}
          fps={selStats.fps}
          cam={selStats.cam}
          showHits={showHits}
          logs={getLog().map((l) => l.msg)}
          onToggleHits={() => {
            selector.setShowHitboxes(!showHits);
            setShowHits((s) => !s);
            dlog("toggle hitboxes", !showHits);
          }}
          onClearPicks={() => {
            selector.clear();
            dlog("clear picks");
          }}
          onSpawnGizmo={() => {
            dbg?.spawnMarker();
            dlog("spawn gizmo");
          }}
          onClearGizmos={() => {
            dbg?.clearMarkers();
            dlog("clear gizmos");
          }}
        />
      )}
    </div>
  );
}

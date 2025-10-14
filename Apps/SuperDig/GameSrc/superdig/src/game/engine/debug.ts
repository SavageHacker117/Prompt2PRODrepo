import * as THREE from "three";

export type DebugAPI = {
  update(dt: number): void;
  attach(dom: HTMLElement): void;
  detach(dom: HTMLElement): void;
  spawnMarker(pos?: THREE.Vector3): void;
  clearMarkers(): void;
  toggleGizmos(v?: boolean): void;
  state: {
    fps: number;
    camPos: THREE.Vector3;
    lookAt: THREE.Vector3;
    zoom: number;
    gizmos: boolean;
    markers: number;
    log: (msg: string) => void;
    logs: string[];
  };
};

export function createDebug(
  scene: THREE.Scene,
  camera: THREE.Camera,
  groundY: number,
  worldWidth: number
): DebugAPI {
  // ---------- metrics ----------
  let fps = 0, acc = 0, frames = 0;
  const camPos = new THREE.Vector3();
  const lookAt = new THREE.Vector3();
  let zoom = 0;

  // ---------- ray / dragging ----------
  const ray = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const pickPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -groundY); // y = groundY
  let dragging: THREE.Object3D | null = null;

  // ---------- marker factory ----------
  const markers: THREE.Object3D[] = [];
  const markerMat = new THREE.MeshBasicMaterial({ color: 0x6bd19c, transparent: true, opacity: 0.95 });
  const hitMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.03, depthWrite: false });

  function makeMarker(): THREE.Object3D {
    const g = new THREE.Group();

    // visible square (≈ 1m)
    const visible = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), markerMat);
    visible.rotation.x = -Math.PI / 2; // horizontal
    visible.position.y = 0.02;

    // fat hitbox (easier to grab): ~ 1.8m, nearly invisible but raycastable
    const hit = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.8), hitMat);
    hit.rotation.x = -Math.PI / 2;
    hit.position.y = 0.03;
    hit.name = "debug-hitbox";

    g.add(visible);
    g.add(hit);
    g.userData.isMarker = true;
    return g;
  }

  function spawnMarker(pos?: THREE.Vector3) {
    const m = makeMarker();
    const x = pos?.x ?? THREE.MathUtils.randFloatSpread(worldWidth * 0.8);
    m.position.set(x, groundY + 0.01, 0);
    scene.add(m);
    markers.push(m);
  }

  function clearMarkers() {
    for (const m of markers) scene.remove(m);
    markers.length = 0;
  }

  // ---------- pointer handlers ----------
  function ndc(ev: PointerEvent, dom: HTMLElement) {
    const r = dom.getBoundingClientRect();
    mouse.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
    mouse.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
  }

  function pointerDown(ev: PointerEvent, dom: HTMLElement) {
    ndc(ev, dom);
    ray.setFromCamera(mouse, camera);
    const hits = ray.intersectObjects(markers, true);
    if (hits.length) {
      // climb up to marker group
      let obj: THREE.Object3D | null = hits[0].object;
      while (obj && !obj.userData.isMarker) obj = obj.parent;
      dragging = obj;
    } else {
      dragging = null; // click empty → deselect
    }
  }

  function pointerMove(ev: PointerEvent, dom: HTMLElement) {
    if (!dragging) return;
    ndc(ev, dom);
    ray.setFromCamera(mouse, camera);
    const p = new THREE.Vector3();
    ray.ray.intersectPlane(pickPlane, p);
    if (p.x < -worldWidth * 0.5) p.x = -worldWidth * 0.5;
    if (p.x >  worldWidth * 0.5) p.x =  worldWidth * 0.5;
    dragging.position.x = p.x;
  }

  function pointerUp() {
    dragging = null;
  }

  // ---------- public attach/detach ----------
  const onDown = (e: PointerEvent) => pointerDown(e, _dom!);
  const onMove = (e: PointerEvent) => pointerMove(e, _dom!);
  const onUp   = () => pointerUp();

  let _dom: HTMLElement | null = null;
  function attach(dom: HTMLElement) {
    if (_dom) detach(_dom);
    _dom = dom;
    dom.addEventListener("pointerdown", onDown);
    dom.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }
  function detach(dom: HTMLElement) {
    dom.removeEventListener("pointerdown", onDown);
    dom.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    _dom = null;
  }

  // ---------- logs ----------
  const logs: string[] = [];
  const log = (msg: string) => {
    logs.unshift(`[${new Date().toLocaleTimeString()}] ${msg}`);
    if (logs.length > 100) logs.length = 100;
    // eslint-disable-next-line no-console
    console.log("%c[DBG]", "color:#9ff", msg);
  };

  // ---------- update ----------
  function update(dt: number) {
    acc += dt; frames++;
    if (acc >= 0.25) { fps = Math.round(frames / acc); frames = 0; acc = 0; }
    camPos.copy((camera as any).position ?? new THREE.Vector3());
    // infer lookAt from camera ray
    const r = new THREE.Raycaster();
    r.setFromCamera(new THREE.Vector2(0,0), camera);
    const p = new THREE.Vector3();
    r.ray.intersectPlane(pickPlane, p);
    lookAt.copy(p);
    zoom = camPos.distanceTo(lookAt);
  }

  let gizmos = true;
  function toggleGizmos(v?: boolean) {
    gizmos = v ?? !gizmos;
    for (const m of markers) m.visible = gizmos;
  }

  return {
    update,
    attach,
    detach,
    spawnMarker,
    clearMarkers,
    toggleGizmos,
    state: { get fps(){return fps;}, camPos, lookAt, get zoom(){return zoom;}, get gizmos(){return gizmos;}, get markers(){return markers.length;}, log, logs }
  };
}

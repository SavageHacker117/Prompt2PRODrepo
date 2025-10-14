import * as THREE from "three";
import { dlog } from "./log";

export type PickReg = {
  id?: string;
  group: THREE.Group;         // the thing we will move
  radius?: number;            // hitbox radius (x,z)
};

export type Selector = {
  register: (r: PickReg) => void;
  clear: () => void;
  setShowHitboxes: (v: boolean) => void;
  update: (dt: number) => void;
  stats: () => { selected?: string; count: number; fps: number; cam: THREE.Vector3; };
};

export function createSelector(
  scene: THREE.Scene,
  camera: THREE.Camera,
  dom: HTMLElement,
  groundY: number
): Selector {
  const ray = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const picks: { id: string; proxy: THREE.Mesh; target: THREE.Group; }[] = [];
  let showHit = false;

  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -groundY);
  const hitPoint = new THREE.Vector3();

  let dragging: null | { item: typeof picks[number]; offsetX: number } = null;
  let selected: string | undefined;

  // fps
  let fps = 0, acc = 0, frames = 0, last = performance.now();

  function makeProxy(id: string, target: THREE.Group, radius: number) {
    const geo = new THREE.BoxGeometry(radius * 2, 0.3, radius * 2);
    const mat = new THREE.MeshBasicMaterial({ color: 0x51e29a, transparent: true, opacity: 0.5, depthTest: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 999;
    mesh.position.set(target.position.x, groundY + 0.15, target.position.z);
    mesh.userData.__pickable = true;
    mesh.visible = showHit;
    scene.add(mesh);
    return { id, proxy: mesh, target };
  }

  function worldPointFromMouse(ev: PointerEvent) {
    const rect = dom.getBoundingClientRect();
    mouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    ray.setFromCamera(mouse, camera as THREE.Camera);
    ray.ray.intersectPlane(plane, hitPoint);
    return hitPoint;
  }

  function onDown(ev: PointerEvent) {
    const p = worldPointFromMouse(ev);
    // Try pick proxies first (bigger hit)
    const hits = ray.intersectObjects(picks.map(p => p.proxy), false);
    if (hits.length) {
      const item = picks.find(i => i.proxy === hits[0].object)!;
      selected = item.id;
      // store x offset so dragging feels anchored
      dragging = { item, offsetX: p.x - item.target.position.x };
      dlog("selected", selected);
      return;
    }
    // empty click → deselect
    selected = undefined;
    dragging = null;
  }

  function onMove(ev: PointerEvent) {
    if (!dragging) return;
    const p = worldPointFromMouse(ev);
    const nx = p.x - dragging.offsetX;
    dragging.item.target.position.x = nx;
    dragging.item.proxy.position.x = nx;
  }

  function onUp() { dragging = null; }

  dom.addEventListener("pointerdown", onDown);
  dom.addEventListener("pointermove", onMove);
  dom.addEventListener("pointerup", onUp);
  dom.addEventListener("pointerleave", onUp);

  return {
    register: ({ id, group, radius = 1.6 }) => {
      const item = makeProxy(id ?? `obj_${picks.length}`, group, radius * 1.8); // 80% larger hitbox
      picks.push(item);
    },
    clear: () => {
      for (const p of picks) scene.remove(p.proxy);
      picks.length = 0;
      selected = undefined;
      dlog("cleared debug proxies");
    },
    setShowHitboxes: (v: boolean) => {
      showHit = v;
      for (const p of picks) p.proxy.visible = v;
    },
    update: () => {
      // simple fps
      const now = performance.now();
      frames++; acc += (now - last); last = now;
      if (acc >= 1000) { fps = frames; frames = 0; acc = 0; }
    },
    stats: () => {
      return {
        selected,
        count: picks.length,
        fps,
        cam: (camera as THREE.PerspectiveCamera).position.clone(),
      };
    }
  };
}

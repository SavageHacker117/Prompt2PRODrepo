// 16:9 tiled video skins for floor, ceiling and side walls (no stretching).
// Adds smart placement: prefers named meshes (LHwall/RHwall/Floor/Sky, etc).
// If none found, falls back to corridor bounds and centers near an optional anchor.
// Handles mirroring/orientation per wall and avoids z-fighting.
// Includes debug wall-ID overlays (toggle via .toggleDebugIDs())

import * as THREE from 'three';

const ASPECT = 16 / 9; // landscape videos

function makeVideo(url) {
  const v = document.createElement('video');
  v.src = url;
  v.loop = true;
  v.muted = true;
  v.playsInline = true;
  v.crossOrigin = 'anonymous';
  return v;
}

function makeMatFromVideo(video) {
  const tex = new THREE.VideoTexture(video);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.flipY = false;                      // explicit for VideoTexture

  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    side: THREE.DoubleSide,
    toneMapped: false,
    depthWrite: false,                    // overlays corridor walls cleanly
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  return { tex, mat };
}

// Utility to set repeat + optional mirroring (flip) cleanly
function setRepeat(tex, rx, ry, flipX = false, flipY = false) {
  tex.repeat.set(flipX ? -rx : rx, flipY ? -ry : ry);
  tex.offset.set(flipX ? 1 : 0, flipY ? 1 : 0);
}

function worldPos(obj) {
  const p = new THREE.Vector3();
  obj.getWorldPosition(p);
  return p;
}

function getWorldBox(obj) {
  return new THREE.Box3().setFromObject(obj);
}

function computeCorridorBounds(scene) {
  const b = new THREE.Box3();
  const tmp = new THREE.Box3();
  scene.traverse(o => { if (o.isMesh) b.union(tmp.setFromObject(o)); });
  if (!isFinite(b.min.x) || !isFinite(b.max.x)) {
    b.set(new THREE.Vector3(-4, 0, -20), new THREE.Vector3(4, 6, 20));
  }
  return b;
}

/** simple canvas text -> texture for big numeric wall IDs */
function makeLabelTexture(text) {
  const w = 1024, h = 512;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');

  // background pill
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, w, h);

  // outline
  ctx.lineWidth = 18;
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.font = 'bold 360px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeText(text, w/2, h/2);

  // fill
  ctx.fillStyle = '#38bdf8';
  ctx.fillText(text, w/2, h/2);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

function makeLabelPlane(text, widthWorld = 4, heightWorld = 2) {
  const tex = makeLabelTexture(text);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    side: THREE.DoubleSide,
    transparent: true,
    toneMapped: false,
    depthWrite: false
  });
  const geo = new THREE.PlaneGeometry(widthWorld, heightWorld);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 20;
  mesh.userData.isWallId = true;
  return mesh;
}

/**
 * Attempt to find a mesh by a set of name hints.
 * If multiple match, picks the closest to the anchor (if provided),
 * otherwise the one with the largest area.
 */
function findMeshByHints(scene, hints, anchor = null) {
  const lower = hints.map(h => h.toLowerCase());
  let best = null;
  let bestScore = -Infinity;

  scene.traverse((o) => {
    if (!o.isMesh || !o.name) return;
    const nm = o.name.toLowerCase();
    if (!lower.some(h => nm.includes(h))) return;

    const box = getWorldBox(o);
    const size = new THREE.Vector3();
    box.getSize(size);
    const area = size.x * size.y + size.y * size.z + size.x * size.z; // rough measure

    let score = area;
    if (anchor) {
      const d = worldPos(o).distanceTo(worldPos(anchor));
      score += Math.max(0, 1e6 - d * 1e4); // prefer closer to anchor
    }

    if (score > bestScore) {
      bestScore = score;
      best = o;
    }
  });

  return best;
}

/**
 * Install video planes for left/right walls, floor, and sky.
 * @param {THREE.Scene} scene
 * @param {{ left?: string, right?: string, floor?: string, sky?: string }} urls
 * @param {{
 *   anchor?: THREE.Object3D,
 *   nameHints?: { left?: string[], right?: string[], floor?: string[], sky?: string[] }
 * }} [opts]
 */
export async function installVideoWalls(scene, urls, opts = {}) {
  const {
    anchor = null,
    nameHints = {
      left:  ['LHwall', 'LeftWall', 'Left', 'Wall_L', 'WallLeft'],
      right: ['RHwall', 'RightWall', 'Right', 'Wall_R', 'WallRight'],
      floor: ['1Floor', 'Floor', 'Ground'],
      sky:   ['1Sky', 'Sky', 'Ceiling', 'Ceil'],
    },
  } = opts;

  // Holder so we can dispose later
  const group = new THREE.Group();
  group.name = '__videoSkins__';
  scene.add(group);

  const registry = {};
  const playables = [];

  // debug IDs group (hidden by default)
  const debugIds = new THREE.Group();
  debugIds.visible = false;
  debugIds.name = '__videoSkinsDebug__';
  group.add(debugIds);

  const bounds = computeCorridorBounds(scene);
  const W = bounds.max.x - bounds.min.x;           // corridor width  (X)
  const H = bounds.max.y - bounds.min.y;           // corridor height (Y)
  const L = bounds.max.z - bounds.min.z;           // corridor length (Z)

  // center near anchor if available, otherwise global center
  const centerZ = (anchor ? worldPos(anchor).z : 0.5 * (bounds.min.z + bounds.max.z));
  const centerX = 0.5 * (bounds.min.x + bounds.max.x);
  const corridorCenter = new THREE.Vector3(centerX, bounds.min.y + H * 0.5, centerZ);

  function addPlane({ key, url, width, height, place, repeat }) {
    if (!url) return;
    const video = makeVideo(url);
    const { tex, mat } = makeMatFromVideo(video);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height, 1, 1), mat);
    mesh.renderOrder = 10;                // above corridor walls
    place(mesh);
    repeat(tex);
    group.add(mesh);
    registry[key] = { mesh, video, tex };
    playables.push(video);

    // Add a big numeric label for walls (LEFT=1, RIGHT=2)
    if (key === 'left' || key === 'right') {
      const label = makeLabelPlane(key === 'left' ? '1  LEFT' : '2  RIGHT', 4, 1.6);
      label.position.copy(mesh.position);
      // Nudge slightly toward corridor center to avoid z-fighting
      const toCenter = corridorCenter.clone().sub(mesh.position).normalize().multiplyScalar(0.03);
      label.position.add(toCenter);
      label.lookAt(corridorCenter);
      debugIds.add(label);
    }
  }

  // Helper: create plane aligned to a target wall mesh (if present),
  // otherwise fallback to corridor bounds (existing behaviour).
  function bindWall(kind, url) {
    if (!url) return;

    const target =
      findMeshByHints(scene, nameHints[kind] || [], anchor);

    if (target) {
      const box = getWorldBox(target);
      const size = new THREE.Vector3();
      box.getSize(size);
      const mid = new THREE.Vector3();
      box.getCenter(mid);

      if (kind === 'left' || kind === 'right') {
        // span length (Z) by height (Y); position at min/max X
        const height = size.y;
        const length = size.z;
        const x = (kind === 'left') ? box.min.x + 0.015 : box.max.x - 0.015;

        addPlane({
          key: kind,
          url,
          width: length,
          height,
          place: (m) => {
            m.rotation.y = (kind === 'left') ? Math.PI / 2 : -Math.PI / 2;
            m.position.set(x, mid.y, mid.z);
          },
          repeat: (tex) => {
            const tileZ = height * ASPECT;
            const tiles = Math.max(1e-6, length / tileZ);
            // Right wall often needs flipX so both walls flow same direction.
            const flipX = (kind === 'right');
            setRepeat(tex, tiles, 1, flipX, false);
          }
        });
      } else if (kind === 'floor' || kind === 'sky') {
        // span width (X) by length (Z); position at min/max Y
        const width = size.x;
        const length = size.z;
        const y = (kind === 'floor') ? box.min.y + 0.01 : box.max.y - 0.01;

        addPlane({
          key: kind,
          url,
          width,
          height: length,
          place: (m) => {
            m.rotation.x = (kind === 'floor') ? -Math.PI / 2 : Math.PI / 2;
            m.position.set(mid.x, y, mid.z);
          },
          repeat: (tex) => {
            const tileZ = width * (1 / ASPECT);
            const tiles = Math.max(1e-6, length / tileZ);
            // Many sources look better with V flipped on the floor:
            const flipY = (kind === 'floor');
            setRepeat(tex, 1, tiles, false, flipY);
          }
        });
      }
    } else {
      // Fallback to corridor bounds placement
      if (kind === 'left' || kind === 'right') {
        addPlane({
          key: kind,
          url,
          width: L, height: H,
          place: (m) => {
            m.rotation.y = (kind === 'left') ? Math.PI / 2 : -Math.PI / 2;
            const x = (kind === 'left') ? (bounds.min.x + 0.015) : (bounds.max.x - 0.015);
            m.position.set(x, bounds.min.y + H * 0.5, centerZ);
          },
          repeat: (tex) => {
            const tileZ = H * ASPECT;
            const tiles = Math.max(1e-6, L / tileZ);
            const flipX = (kind === 'right');
            setRepeat(tex, tiles, 1, flipX, false);
          }
        });
      } else {
        addPlane({
          key: kind,
          url,
          width: W, height: L,
          place: (m) => {
            m.rotation.x = (kind === 'floor') ? -Math.PI / 2 : Math.PI / 2;
            const y = (kind === 'floor') ? (bounds.min.y + 0.01) : (bounds.max.y - 0.01);
            m.position.set(centerX, y, centerZ);
          },
          repeat: (tex) => {
            const tileZ = W * (1 / ASPECT);
            const tiles = Math.max(1e-6, L / tileZ);
            const flipY = (kind === 'floor');
            setRepeat(tex, 1, tiles, false, flipY);
          }
        });
      }
    }
  }

  bindWall('left',  urls.left);
  bindWall('right', urls.right);
  bindWall('floor', urls.floor);
  bindWall('sky',   urls.sky);

  return {
    group,
    assets: registry,
    async playAll() { for (const v of playables) { try { await v.play(); } catch {} } },
    toggleDebugIDs(show) {
      if (typeof show === 'boolean') debugIds.visible = show;
      else debugIds.visible = !debugIds.visible;
    },
    dispose() {
      scene.remove(group);
      group.traverse(o => {
        if (o.isMesh) {
          o.geometry?.dispose?.();
          const m = o.material;
          if (m?.map?.dispose) m.map.dispose();
          m?.dispose?.();
        }
      });
    }
  };
}

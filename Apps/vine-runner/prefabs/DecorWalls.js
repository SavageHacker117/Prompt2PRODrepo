// prefabs/DecorWalls.js
import * as THREE from 'three';

/**
 * Build background-only corridor walls that never occlude gameplay.
 * They draw behind everything (renderOrder), write no depth, and sit outside the lane.
 */
export function buildDecorWalls(scene, opts = {}) {
  const {
    length = 300,
    height = 8,
    laneWidth = 12,     // gameplay lane is roughly [-6..+6] on Z in your Player.js
    offsetZ = 9.5,      // push walls outside lane
    opacity = 0.12,
    noCeiling = true,   // default: no ceiling to avoid “random thing blocking”
  } = opts;

  const group = new THREE.Group();
  scene.add(group);

  // Shared material: background only — doesn’t occlude.
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x0b1923,
    roughness: 1,
    metalness: 0,
    transparent: true,
    opacity,
    depthWrite: false,    // <- critical: don't write to depth buffer
  });

  // Left wall
  {
    const geo = new THREE.PlaneGeometry(length, height);
    const mesh = new THREE.Mesh(geo, wallMat.clone());
    mesh.rotation.y =  Math.PI / 2;
    mesh.position.set(0, height / 2, -offsetZ);
    mesh.receiveShadow = false;
    mesh.renderOrder = -10; // draw behind everything
    group.add(mesh);
  }

  // Right wall
  {
    const geo = new THREE.PlaneGeometry(length, height);
    const mesh = new THREE.Mesh(geo, wallMat.clone());
    mesh.rotation.y = -Math.PI / 2;
    mesh.position.set(0, height / 2,  offsetZ);
    mesh.receiveShadow = false;
    mesh.renderOrder = -10;
    group.add(mesh);
  }

  // Optional ceiling (disabled by default because it can creep into camera)
  if (!noCeiling) {
    const ceilGeo = new THREE.PlaneGeometry(length, laneWidth + 4);
    const ceil = new THREE.Mesh(ceilGeo, wallMat.clone());
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, height - 0.1, 0);
    ceil.receiveShadow = false;
    ceil.renderOrder = -10;
    group.add(ceil);
  }

  // Very light “confetti” points way above camera as a vibe (non-occluding)
  const dots = new THREE.Group();
  dots.renderOrder = -11;
  const pMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: opacity * 0.6, depthWrite: false });
  for (let i = 0; i < 80; i++) {
    const s = 0.15 + Math.random() * 0.35;
    const m = new THREE.Mesh(new THREE.CircleGeometry(s, 5 + (Math.random() * 4) | 0), pMat.clone());
    m.material.color.setHSL(Math.random(), 0.7, 0.6);
    m.position.set(
      (Math.random() - 0.5) * length,
      6.5 + Math.random() * 1.5,           // keep well above head space
      (Math.random() < 0.5 ? -offsetZ + 0.1 : offsetZ - 0.1)
    );
    m.rotation.y = Math.random() * Math.PI * 2;
    dots.add(m);
  }
  group.add(dots);

  // Expose a dispose helper
  group.userData.dispose = () => {
    group.traverse(o => {
      if (o.isMesh) {
        o.geometry?.dispose?.();
        o.material?.dispose?.();
      }
    });
    scene.remove(group);
  };

  return group;
}

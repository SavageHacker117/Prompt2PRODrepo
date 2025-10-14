// src/game/engine/scene.ts
import * as THREE from "three";

export type StationId = "Market" | "Fuel" | "Processing" | "Contracts";

type BackdropStations = {
  plane: THREE.Mesh;
  zones: { id: StationId; aabb: THREE.Box3 }[];
  testDock(bounds: THREE.Box3): StationId | null;
};

/** Spider ad behind buildings (on top of black). Bottom anchors slightly below ground. */
export function addSpiderBackdrop(
  scene: THREE.Scene,
  worldWidth: number,
  scale = 2.0,
  groundY = -1,
  bottomOffset = -2,
  z = -120
) {
  const tex = new THREE.TextureLoader().load("/src/assets/surface/spider.png");
  tex.colorSpace = THREE.SRGBColorSpace;

  const geo = new THREE.PlaneGeometry(1, 1);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: false });
  const plane = new THREE.Mesh(geo, mat);
  plane.renderOrder = -10;
  plane.position.z = z;

  const setScale = () => {
    if (!tex.image || !tex.image.width || !tex.image.height) return;
    const aspect = tex.image.width / tex.image.height;
    const w = worldWidth * scale;
    const h = Math.max(1, w / aspect);
    plane.scale.set(w, h, 1);
    const bottom = groundY + bottomOffset;
    plane.position.y = bottom + h * 0.5;
  };
  if ((tex as any).image) setScale(); else tex.onUpdate = setScale;

  scene.add(plane);
  return plane;
}

/** Buildings PNG with station hit boxes; image ground aligns to world `groundY` + `groundOffset`. */
export function createSceneWithBackdrop(
  scene: THREE.Scene,
  which: "HomeBase" | "BioDome" | "OilRefine",
  worldWidth = 60,
  groundY = 0,
  groundOffset = -0.05 // raised slightly so you can access stations without mining
): BackdropStations {
  const fileMap = {
    HomeBase: "/src/assets/surface/HomeBase.png",
    BioDome: "/src/assets/surface/BioDome.png",
    OilRefine: "/src/assets/surface/OilRefine.png",
  } as const;

  // Approx ground-line inside each PNG (0 bottom .. 1 top). Tweak if needed.
  const groundFracBy: Record<keyof typeof fileMap, number> = {
    HomeBase: 0.285,
    BioDome: 0.35,
    OilRefine: 0.33,
  };

  const tex = new THREE.TextureLoader().load(fileMap[which]);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;

  const planeGeo = new THREE.PlaneGeometry(1, 1);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
  const plane = new THREE.Mesh(planeGeo, mat);
  plane.position.set(0, 0, -80);
  plane.renderOrder = 0;
  scene.add(plane);

  const setScaleFromImage = () => {
    if (!tex.image || !tex.image.width || !tex.image.height) return;
    const aspect = tex.image.width / tex.image.height;
    const w = worldWidth;
    const h = Math.max(1, w / aspect);
    plane.scale.set(w, h, 1);

    // Align PNG ground to world groundY with a small nudge
    const g = groundFracBy[which];
    plane.position.y = groundY - g * h + h * 0.5 + groundOffset;
  };
  if ((tex as any).image) setScaleFromImage(); else tex.onUpdate = setScaleFromImage;

  // Station zones + visible YELLOW pads
  const zones: { id: StationId; aabb: THREE.Box3 }[] = [];
  const anchors =
    which === "HomeBase"
      ? [
          { id: "Market" as StationId, x: 0.18 },
          { id: "Contracts" as StationId, x: 0.45 },
          { id: "Fuel" as StationId, x: 0.64 },
          { id: "Processing" as StationId, x: 0.86 },
        ]
      : which === "BioDome"
      ? [
          { id: "Contracts" as StationId, x: 0.50 },
          { id: "Market" as StationId, x: 0.32 },
          { id: "Fuel" as StationId, x: 0.68 },
          { id: "Processing" as StationId, x: 0.84 },
        ]
      : [
          { id: "Processing" as StationId, x: 0.62 },
          { id: "Market" as StationId, x: 0.30 },
          { id: "Fuel" as StationId, x: 0.48 },
          { id: "Contracts" as StationId, x: 0.80 },
        ];

  const zoneWidth = worldWidth * 0.10;
  const zoneHeight = worldWidth * 0.12;

  anchors.forEach(({ id, x }) => {
    const cx = (x - 0.5) * worldWidth;

    // visual pad
    const pad = new THREE.Mesh(
      new THREE.PlaneGeometry(zoneWidth * 0.95, zoneHeight * 0.35),
      new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.22, depthWrite: false })
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(cx, groundY + 0.01 + groundOffset, 0.5);
    pad.renderOrder = 999;
    scene.add(pad);

    // aabb used for docking
    const aabb = new THREE.Box3().setFromCenterAndSize(
      new THREE.Vector3(cx, groundY - zoneHeight * 0.25 + groundOffset, 0),
      new THREE.Vector3(zoneWidth, zoneHeight, 10)
    );
    zones.push({ id, aabb });
  });

  function testDock(playerBounds: THREE.Box3): StationId | null {
    for (const z of zones) if (z.aabb.intersectsBox(playerBounds)) return z.id;
    return null;
  }

  return { plane, zones, testDock };
}

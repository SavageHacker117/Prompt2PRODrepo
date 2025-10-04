// apps/demo-web/src/canvasmind/plugins/animator/crumbLibrary.ts
export type Crumb = {
  t: number;               // 0..1 normalized time
  op: "move" | "rotate" | "scale" | "mat" | "custom";
  target: "skybox" | "scene" | "object" | "bone";
  path?: string;           // for objects/bones (e.g. "Armature/Hips/Spine/Neck" or object name)
  value: number[];         // vec3 or euler (deg) depending on op
};

export function makeWave200(): Crumb[] {
  const crumbs: Crumb[] = [];
  for (let i = 0; i < 200; i++) {
    const t = i / 199;
    // tiny skybox “exposure-ish” cue (we toggle needsUpdate; actual exposure handled by renderer settings)
    crumbs.push({ t, op: "mat", target: "skybox", value: [0.98 + 0.02 * Math.sin(t * Math.PI * 2), 1, 1] });
    // gentle scene yaw wobble for life
    const yawDeg = 0.35 * Math.sin(t * Math.PI) * (180 / Math.PI);
    crumbs.push({ t, op: "rotate", target: "scene", value: [0, yawDeg, 0] });
  }
  return crumbs;
}

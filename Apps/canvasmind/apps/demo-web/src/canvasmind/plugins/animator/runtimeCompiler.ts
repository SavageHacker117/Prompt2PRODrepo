// apps/demo-web/src/canvasmind/plugins/animator/runtimeCompiler.ts
import * as THREE from "three";
import type { Crumb } from "./crumbLibrary";

/** Turn crumbs into small mutators that are evaluated each frame */
export function compileCrumbs(
  crumbs: Crumb[],
  ctx: {
    scene: THREE.Scene;
    skyboxTex?: THREE.Texture | null;
    findObjectByName: (name: string) => THREE.Object3D | null;
    findBoneByPath: (root: THREE.Object3D, path: string) => THREE.Object3D | null;
  }
) {
  const sky = ctx.skyboxTex || null;
  const scene = ctx.scene;

  const compiled = crumbs.map(c => {
    const t = THREE.MathUtils.clamp(c.t, 0, 1);

    if (c.target === "skybox" && c.op === "mat" && sky) {
      return (now: number) => {
        if (now >= t) {
          // signal update; actual tone/exposure can be handled via renderer or post
          sky.needsUpdate = true;
        }
      };
    }

    if (c.target === "scene" && c.op === "rotate") {
      const [rxDeg, ryDeg, rzDeg] = c.value;
      const rx = THREE.MathUtils.degToRad(rxDeg);
      const ry = THREE.MathUtils.degToRad(ryDeg);
      const rz = THREE.MathUtils.degToRad(rzDeg);
      return (now: number) => { if (now >= t) scene.rotation.set(rx, ry, rz); };
    }

    if (c.target === "object" && c.path) {
      const obj = ctx.findObjectByName(c.path);
      if (!obj) return (now:number)=>void now;
      if (c.op === "move") {
        const [x,y,z] = c.value;
        return (now:number)=>{ if (now>=t) obj.position.set(x,y,z); };
      }
      if (c.op === "rotate") {
        const [rx,ry,rz] = c.value.map(v=>THREE.MathUtils.degToRad(v));
        return (now:number)=>{ if (now>=t) obj.rotation.set(rx,ry,rz); };
      }
      if (c.op === "scale") {
        const [sx,sy,sz] = c.value;
        return (now:number)=>{ if (now>=t) obj.scale.set(sx,sy,sz); };
      }
    }

    if (c.target === "bone" && c.path) {
      const [rootName, ...rest] = c.path.split("/");
      const root = ctx.findObjectByName(rootName);
      const bone = root ? ctx.findBoneByPath(root, rest.join("/")) : null;
      if (!bone) return (now:number)=>void now;
      if (c.op === "rotate") {
        const [rx,ry,rz] = c.value.map(v=>THREE.MathUtils.degToRad(v));
        return (now:number)=>{ if (now>=t) (bone as any).rotation.set(rx,ry,rz); };
      }
    }

    return (now: number) => void now; // no-op
  });

  return function run(nowNorm: number) {
    for (const fn of compiled) fn(nowNorm);
  };
}

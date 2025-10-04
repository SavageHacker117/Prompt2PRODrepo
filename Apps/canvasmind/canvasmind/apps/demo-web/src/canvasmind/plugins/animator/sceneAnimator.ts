import * as THREE from "three";
import { compileCrumbs } from "./animationCompleter";
import { makeWave200 } from "./crumbLibrary";

export type SceneAnimator = {
  playWave(): void;      // example animation for skybox + subtle scene motion
  stop(): void;
  isPlaying(): boolean;
};

export function createSceneAnimator(
  scene: THREE.Scene,
  opts: {
    getSkyboxTexture: () => THREE.Texture | null;
    findObjectByName: (name: string) => THREE.Object3D | null;
    findBoneByPath: (root: THREE.Object3D, path: string) => THREE.Object3D | null;
  }
): SceneAnimator {
  let raf = 0;
  let t0 = 0;
  let runner: ((nowNorm: number) => void) | null = null;
  let playing = false;

  function loop(ts: number) {
    raf = requestAnimationFrame(loop);
    if (!runner) return;
    if (t0 === 0) t0 = ts;
    const durMs = 8000; // 8s for 200 crumbs (feel free to tune)
    const nowNorm = Math.min(1, (ts - t0) / durMs);
    runner(nowNorm);
    if (nowNorm >= 1) { stop(); }
  }

  function playWave() {
    const crumbs = makeWave200();
    runner = compileCrumbs(crumbs, {
      scene,
      skyboxTex: opts.getSkyboxTexture(),
      findObjectByName: opts.findObjectByName,
      findBoneByPath: opts.findBoneByPath
    });
    playing = true;
    t0 = 0;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
    playing = false;
    runner = null;
    t0 = 0;
  }

  return { playWave, stop, isPlaying: () => playing };
}

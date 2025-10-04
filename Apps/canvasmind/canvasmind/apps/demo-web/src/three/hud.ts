export class Hud {
  fpsEl: HTMLElement;
  drawsEl: HTMLElement;
  assetsEl: HTMLElement;
  frames = 0;
  lastSec = performance.now();

  constructor(fpsId: string, drawsId: string, assetsId: string) {
    this.fpsEl = document.getElementById(fpsId)!;
    this.drawsEl = document.getElementById(drawsId)!;
    this.assetsEl = document.getElementById(assetsId)!;
  }

  tick(renderer: THREE.WebGLRenderer, assetCount: number, now: number) {
    this.frames++;
    if (now - this.lastSec >= 1000) {
      this.fpsEl.textContent = String(this.frames);
      this.frames = 0;
      this.lastSec = now;

      this.drawsEl.textContent = String(renderer.info.render.calls);
      renderer.info.reset();

      this.assetsEl.textContent = String(assetCount);
    }
  }
}

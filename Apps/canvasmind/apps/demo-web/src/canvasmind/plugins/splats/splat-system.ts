import * as THREE from "three";
import { loadSplatAsset, disposeSplatAsset, SplatAsset } from "./splat-loader";

export class SplatSystem {
  public group = new THREE.Group();
  private asset: SplatAsset | null = null;
  private opacity = 1.0;
  private quality: "low"|"med"|"high" = "med";

  constructor(private renderer: THREE.WebGLRenderer) {
    this.group.name = "CM_SplatsRoot";
  }

  async load(url: string) {
    await this.unload();
    this.asset = await loadSplatAsset(url, this.renderer);
    if (this.asset.kind === "points") {
      this.group.add(this.asset.obj);
      (this.asset.obj.material as THREE.PointsMaterial).transparent = true;
      (this.asset.obj.material as THREE.PointsMaterial).opacity = this.opacity;
    }
  }

  async unload() {
    if (!this.asset) return;
    disposeSplatAsset(this.asset, this.group);
    this.asset = null;
  }

  setOpacity(a: number) {
    this.opacity = Math.max(0, Math.min(1, a));
    if (this.asset?.kind === "points") {
      (this.asset.obj.material as THREE.PointsMaterial).opacity = this.opacity;
      (this.asset.obj.material as THREE.PointsMaterial).needsUpdate = true;
    }
  }

  setQuality(q: "low"|"med"|"high") { this.quality = q; /* hook to GS lib if available */ }

  // Called from boot.ts animate()
  render(camera: THREE.Camera) {
    if (!this.asset) return;

    if (this.asset.kind === "gs") {
      const cam = camera as THREE.PerspectiveCamera;
      const view = cam.matrixWorldInverse.elements;
      const proj = cam.projectionMatrix.elements;
      const w = this.renderer.domElement.width, h = this.renderer.domElement.height;
      this.asset.lib.draw(this.asset.handle, proj, view, w, h, { opacity: this.opacity, quality: this.quality });
    }
    // "points" path is drawn by Three automatically.
  }

  approxBytes(): number { return (this.asset as any)?.estMB ? ((this.asset as any).estMB * 1024 * 1024) : 0; }
}

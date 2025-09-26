import * as THREE from "three";
import type { CanvasMindContext } from "../init";

const MAX_INTERACTEES = 64;

class WorldField {
  renderer: THREE.WebGLRenderer;
  size: THREE.Vector2;
  rtPrev: THREE.WebGLRenderTarget;
  rtCurr: THREE.WebGLRenderTarget;
  rtNext: THREE.WebGLRenderTarget;
  quad: THREE.Mesh;
  scene: THREE.Scene;
  cam: THREE.OrthographicCamera;

  interactees: { uv: THREE.Vector2; radius: number; strength: number; vel: THREE.Vector2 }[] = [];

  constructor(renderer: THREE.WebGLRenderer, w = 512, h = 512) {
    this.renderer = renderer;
    this.size = new THREE.Vector2(w, h);

    const opts = {
      type: THREE.HalfFloatType,
      format: THREE.RedFormat,
      internalFormat: "R16F",
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
      stencilBuffer: false
    };

    this.rtPrev = new THREE.WebGLRenderTarget(w, h, opts);
    this.rtCurr = new THREE.WebGLRenderTarget(w, h, opts);
    this.rtNext = new THREE.WebGLRenderTarget(w, h, opts);

    this.scene = new THREE.Scene();
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial());
    this.scene.add(this.quad);
  }

  addInteractee(uv: [number, number], radius = 0.06, strength = 1.0, vel: [number, number] = [0, 0]) {
    this.interactees.push({ uv: new THREE.Vector2(...uv), radius, strength, vel: new THREE.Vector2(...vel) });
  }

  step(dt = 1 / 60) {
    // TODO: implement SetMax + Laplacian propagation
    // placeholder: just decay over time
    this.quad.material = new THREE.MeshBasicMaterial({ color: Math.random() * 0xffffff });
    this.renderer.setRenderTarget(this.rtNext);
    this.renderer.render(this.scene, this.cam);
    this.renderer.setRenderTarget(null);
    [this.rtPrev, this.rtCurr, this.rtNext] = [this.rtCurr, this.rtNext, this.rtPrev];
  }
}

export async function registerWorldField(ctx: CanvasMindContext) {
  const wf = new WorldField(ctx.renderer);
  ctx.dcwo.set("worldfield_main", {
    id: "worldfield_main",
    node: wf,
    context: {
      semantics: ["field", "wave", "heightmap"],
      constraints: { texSize: [512, 512], maxInteractees: MAX_INTERACTEES }
    },
    policy: { allow: { addInteractee: true, setParams: true } }
  });

  ctx.bus.on("worldfield.addInteractee", (p: any) =>
    wf.addInteractee(p.uv, p.radius, p.strength, [p.vx ?? 0, p.vy ?? 0])
  );

  ctx.tickers.push((dt) => wf.step(dt));
}

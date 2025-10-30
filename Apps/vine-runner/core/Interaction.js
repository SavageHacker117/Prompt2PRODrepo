import * as THREE from "three";

export class Interaction {
  constructor(engine) {
    this.engine = engine;
    this.ray = new THREE.Raycaster();
    this.tmp = new THREE.Vector2();
    engine.renderer.domElement.addEventListener("click", (e) => this.onClick(e));
  }

  onClick(e) {
    const rect = this.engine.renderer.domElement.getBoundingClientRect();
    this.tmp.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.tmp.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.ray.setFromCamera(this.tmp, this.engine.camera);
    const hits = this.ray.intersectObjects(this.engine.scene.children, true);
    for (const h of hits) {
      const owner = h.object.userData?.owner;
      if (owner && owner.type === "block") {
        this.engine.breakBlock(owner, h.point, h.face?.normal);
        return;
      }
    }
  }
}

import * as THREE from "three";

export class InstancingPool {
  private pools = new Map<string, THREE.InstancedMesh>();

  getOrCreate(key: string, proto: THREE.Mesh, countHint = 500) {
    let inst = this.pools.get(key);
    if (!inst) {
      inst = new THREE.InstancedMesh(proto.geometry, proto.material as THREE.Material, countHint);
      inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.pools.set(key, inst);
    }
    return inst;
  }

  addInstance(inst: THREE.InstancedMesh, matrix: THREE.Matrix4) {
    const index = inst.count;
    inst.setMatrixAt(index, matrix);
    inst.count = index + 1;
    inst.instanceMatrix.needsUpdate = true;
  }

  disposeAll(scene: THREE.Scene) {
    for (const inst of this.pools.values()) {
      scene.remove(inst);
      inst.geometry.dispose();
      (inst.material as any)?.dispose?.();
    }
    this.pools.clear();
  }
}

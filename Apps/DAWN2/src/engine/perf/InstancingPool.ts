// src/engine/perf/InstancingPool.ts
import * as THREE from "three";
import type { BudgetManager } from "./BudgetManager";

export type InstPoolEntry = {
  inst: THREE.InstancedMesh;
  count: number;
  limit: number;
  estMB: number;
  estTris: number;
};

/**
 * Simple instancing pool. In pass 3 you’ll:
 * - create one InstancingPool per scene
 * - feed it a BudgetManager
 * - swap repeated GLBs over to instanced meshes.
 */
export class InstancingPool {
  private pools = new Map<string, InstPoolEntry>();

  constructor(private budget?: BudgetManager) {}

  getOrCreate(
    key: string,
    proto: THREE.Mesh,
    trisEst: number,
    countHint = 1000
  ): InstPoolEntry {
    let entry = this.pools.get(key);
    if (!entry) {
      const inst = new THREE.InstancedMesh(
        proto.geometry,
        proto.material as THREE.Material,
        countHint
      );
      inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

      entry = {
        inst,
        count: 0,
        limit: countHint,
        estMB: Math.max(8, Math.round(trisEst / 2500)),
        estTris: trisEst,
      };
      this.pools.set(key, entry);

      if (this.budget) {
        this.budget.track({
          id: `inst_${key}`,
          kind: "instanced",
          estMB: entry.estMB,
          estTris: entry.estTris,
          node: inst,
          dispose: () => {
            try {
              inst.geometry.dispose();
              (inst.material as any)?.dispose?.();
            } catch {
              /* ignore */
            }
          },
        });
      }
    }
    return entry;
  }

  addInstance(entry: InstPoolEntry, matrix: THREE.Matrix4): boolean {
    if (entry.count >= entry.limit) return false;
    entry.inst.setMatrixAt(entry.count, matrix);
    entry.count += 1;
    entry.inst.count = entry.count;
    entry.inst.instanceMatrix.needsUpdate = true;
    return true;
  }

  disposeAll(scene: THREE.Scene) {
    for (const entry of this.pools.values()) {
      scene.remove(entry.inst);
      try {
        entry.inst.geometry.dispose();
        (entry.inst.material as any)?.dispose?.();
      } catch {
        /* ignore */
      }
    }
    this.pools.clear();
  }
}

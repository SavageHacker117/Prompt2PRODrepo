import * as THREE from "three";

export type Hazard = { aabb: THREE.Box3; type: "gas" | "ice" | "heat"; damage: number };

export function createHazards(): Hazard[] {
  // Phase A: no active hazards. Stub for later.
  return [];
}

export function testHazardHit(hazards: Hazard[], bounds: THREE.Box3): number {
  for (const h of hazards) if (h.aabb.intersectsBox(bounds)) return h.damage;
  return 0;
}

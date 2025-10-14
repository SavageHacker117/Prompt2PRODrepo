import * as THREE from "three";

export type Pickup = { aabb: THREE.Box3; kind: "battery" | "treads" | "drill"; value: number };

export function createPickups(): Pickup[] {
  // Phase A: none in world yet; scaffold only.
  return [];
}

export function testPickup(pickups: Pickup[], bounds: THREE.Box3): Pickup | null {
  const i = pickups.findIndex(p => p.aabb.intersectsBox(bounds));
  return i >= 0 ? pickups.splice(i, 1)[0] : null;
}

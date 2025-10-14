import * as THREE from "three";
import { Terrain } from "./terrain";
import type { Digger } from "../gameplay/digger";

export function createPhysics(terrain: Terrain) {
  const g = -30;                 // gravity (down)
  const flyAccel = 40;           // up/down when holding keys
  const walkAccel = 60;
  const maxHoriz = 12;
  const maxVert  = 18;

  const tmpBox = new THREE.Box3();
  const tmpV = new THREE.Vector3();

  return {
    step(digger: Digger, input: any, dt: number) {
      const v = digger.vel;
      const p = digger.group.position;

      // --- Horizontal
      if (input.pressed("KeyA")) v.x = Math.max(v.x - walkAccel * dt, -maxHoriz);
      if (input.pressed("KeyD")) v.x = Math.min(v.x + walkAccel * dt,  maxHoriz);
      if (!input.pressed("KeyA") && !input.pressed("KeyD")) v.x *= 0.86;

      // --- Vertical (fly)
      if (input.pressed("KeyW")) v.y = Math.min(v.y + flyAccel * dt,  maxVert);      // UP
      if (input.pressed("Space")) v.y = Math.max(v.y - flyAccel * dt, -maxVert);     // DOWN (drill)

      // gravity only when not pressing up/down
      if (!input.pressed("KeyW") && !input.pressed("Space")) v.y += g * dt * 0.25;

      // Integrate
      p.addScaledVector(v, dt);

      // --- Collision & ground snap (no bounce)
      const bounds = digger.getBounds(tmpBox);
      const foot = tmpV.set(p.x, bounds.min.y - 0.01, p.z);

      const onGround = terrain.isSolidAt(foot.x, foot.y, foot.z);
      if (onGround && v.y <= 0) {
        // snap to grid height so we fully rest
        const S = terrain.size.S;
        p.y = Math.ceil((p.y - bounds.min.y) / S) * S + (digger.height / 2);
        v.y = 0;
      }

      // X push-out
      const left = tmpV.set(bounds.min.x - 0.01, p.y, p.z);
      const right = tmpV.set(bounds.max.x + 0.01, p.y, p.z);
      if (terrain.isSolidAt(left.x, left.y, left.z))  { p.x += terrain.size.S * 0.5; v.x = 0; }
      if (terrain.isSolidAt(right.x, right.y, right.z)) { p.x -= terrain.size.S * 0.5; v.x = 0; }

      // Sleep small velocities to prevent shimmer
      if (onGround && Math.abs(v.x) < 0.02) v.x = 0;

      // Mining hook (from digger / App terrain pick)
      if (digger.consumeMineRequest) {
        const pick = digger.consumeMineRequest();
        if (pick) {
          const minedValue = terrain.mine(pick.key);
          return { minedValue };
        }
      }
      return null;
    }
  };
}

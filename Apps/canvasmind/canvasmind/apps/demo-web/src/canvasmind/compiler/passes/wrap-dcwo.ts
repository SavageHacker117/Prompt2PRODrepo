import type { CanvasMindContext } from "../../init";
import * as THREE from "three";

export function wrapAsDCWO(ctx: CanvasMindContext, id: string, node: THREE.Object3D, semantics: string[], provenance: any) {
  ctx.dcwo.set(id, {
    id,
    node,
    context: {
      semantics,
      provenance,
      constraints: {},
      acl: { roles: { ai: ["transform"], user: ["all"], system: ["all"] } }
    },
    policy: { allow: { transform: true } }
  });
}

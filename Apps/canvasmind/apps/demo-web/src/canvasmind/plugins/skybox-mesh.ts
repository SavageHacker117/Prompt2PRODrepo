import * as THREE from "three";
import { loadSkyboxEquirect, loadMeshGLTF } from "../../three/loaders";
import type { CanvasMindContext } from "../init";

export async function applySkyboxFromMCP(
  ctx: CanvasMindContext,
  choose: () => Promise<{ server_url: string; id: string; model?: string }>,
  prompt: string
) {
  const pick = await choose();
  const url = "https://threejs.org/examples/textures/2294472375_24a3b8ef46_o.jpg"; // mock
  const tex = await loadSkyboxEquirect(url);
  ctx.scene.background = tex;

  ctx.dcwo.set(`skybox_${Date.now()}`, {
    id: `skybox_${Date.now()}`,
    node: tex,
    context: {
      semantics: ["skybox", "background"],
      provenance: { server: pick.server_url, model: pick.model ?? "mock", prompt },
      constraints: { maxTexMemMB: 64 }
    },
    policy: { allow: { background: true } }
  });
}

export async function spawnMeshFromMCP(
  ctx: CanvasMindContext,
  choose: () => Promise<{ server_url: string; id: string; model?: string }>,
  parent: THREE.Group
) {
  const pick = await choose();
  const url = "https://threejs.org/examples/models/gltf/DamagedHelmet/glTF/DamagedHelmet.gltf"; // mock
  const node = await loadMeshGLTF(url);
  node.position.set((Math.random() * 2 - 1) * 2, 0, (Math.random() * 2 - 1) * 2);
  parent.add(node);

  ctx.dcwo.set(`mesh_${Date.now()}`, {
    id: `mesh_${Date.now()}`,
    node,
    context: {
      semantics: ["mesh", "prop"],
      provenance: { server: pick.server_url, model: pick.model ?? "mock" },
      constraints: { maxTris: 50000 }
    },
    policy: { allow: { transform: true } }
  });
}

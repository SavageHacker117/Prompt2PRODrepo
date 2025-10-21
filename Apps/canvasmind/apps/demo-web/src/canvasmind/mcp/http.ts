// apps/demo-web/src/canvasmind/mcp/http.ts
export async function callMCP<T>(
  serverUrl: string,
  endpoint: string,
  body: Record<string, unknown>,
  opts: { signal?: AbortSignal } = {}
): Promise<T> {
  const tryPost = async (url: string, extraHeaders: Record<string,string> = {}) => {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", ...extraHeaders },
        body: JSON.stringify(body),
        signal: opts.signal
      });
      if (res.ok) return (await res.json()) as T;
      return null;
    } catch {
      return null;
    }
  };

  // 1) direct:   <serverUrl>/<endpoint>
  const direct = `${serverUrl.replace(/\/$/, "")}/${endpoint}`;
  let data = await tryPost(direct);
  if (data) return data;

  // 2) gateway:  /api/mcp/proxy/<endpoint>  (with x-mcp-server header)
  const viaGateway = `/api/mcp/proxy/${encodeURIComponent(endpoint)}`;
  data = await tryPost(viaGateway, { "x-mcp-server": serverUrl });
  if (data) return data;

  // 3) last-resort local mocks — keep the UI usable in dev
  if (endpoint === "generate_skybox") {
    return {
      asset: { kind: "texture.equirect", urls: [
        "https://threejs.org/examples/textures/2294472375_24a3b8ef46_o.jpg"
      ], mime: "image/jpeg" },
      provenance: {
        server: "mock",
        model: "nebula-mock-v1",
        prompt: String((body as any)?.prompt ?? ""),
        seed: Number((body as any)?.seed ?? 0),
        ts: Date.now()
      },
      budget_hint: { tex_mem_mb_est: 32 }
    } as unknown as T;
  }
  if (endpoint === "generate_mesh") {
    return {
      asset: { kind: "model.gltf",
               url: "https://threejs.org/examples/models/gltf/DamagedHelmet/glTF/DamagedHelmet.gltf" },
      provenance: {
        server: "mock",
        model: "mesh-mock-v1",
        prompt: String((body as any)?.prompt ?? ""),
        seed: Number((body as any)?.seed ?? 0),
        ts: Date.now()
      },
      budget_hint: { tris_est: 20000 }
    } as unknown as T;
  }

  throw new Error(`MCP call failed (no route and no mock): ${direct}`);
}

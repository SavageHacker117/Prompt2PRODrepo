// src/canvasmind/mcp/client.ts
export type MCPItem = {
  id: string;
  name: string;
  server_url: string;
  tags: string[];
  capabilities: string[];
};

// Thin wrapper for calling MCP servers (proxy or direct)
export async function callMCP<T>(
  serverUrl: string,
  endpoint: string,
  body: Record<string, unknown>,
  opts: { signal?: AbortSignal } = {}
): Promise<T> {
  const direct = `${serverUrl.replace(/\/$/, "")}/${endpoint}`;
  const res = await fetch(direct, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: opts.signal
  }).catch(() => null);

  if (res && res.ok) return (await res.json()) as T;

  const viaGateway = `/api/mcp/proxy/${encodeURIComponent(endpoint)}`;
  const res2 = await fetch(viaGateway, {
    method: "POST",
    headers: { "content-type": "application/json", "x-mcp-server": serverUrl },
    body: JSON.stringify(body),
    signal: opts.signal
  });
  if (!res2.ok) throw new Error(`MCP call failed: ${res2.status} ${res2.statusText}`);
  return (await res2.json()) as T;
}

export async function fetchRegistry(): Promise<MCPItem[]> {
  try {
    const res = await fetch("/api/mcp/registry");
    if (!res.ok) throw new Error("Failed registry fetch");
    return (await res.json()) as MCPItem[];
  } catch {
    // Safe fallback so the UI still works during local dev
    return [
      { id: "nebula-skybox", name: "Mock Nebula Skybox", server_url: "/mcp/nebula", tags: ["skybox"], capabilities: ["generate_skybox"] },
      { id: "mesh-rock",     name: "Mock Rock Mesh",     server_url: "/mcp/mesh",   tags: ["mesh"],   capabilities: ["generate_mesh"] }
    ];
  }
}

export type MCPItem = {
  id: string;
  name: string;
  server_url: string;
  tags: string[];
  capabilities: string[];
};

export async function fetchRegistry(): Promise<MCPItem[]> {
  try {
    const res = await fetch("/api/mcp/registry");
    if (!res.ok) throw new Error("Failed registry fetch");
    return (await res.json()) as MCPItem[];
  } catch {
    // Minimal fallback so the app keeps working offline
    return [
      { id: "nebula-skybox", name: "Mock Nebula Skybox", server_url: "/mcp/nebula", tags: ["skybox"], capabilities: ["generate_skybox"] },
      { id: "mesh-rock",     name: "Mock Rock Mesh",     server_url: "/mcp/mesh",   tags: ["mesh"],   capabilities: ["generate_mesh"] }
    ];
  }
}

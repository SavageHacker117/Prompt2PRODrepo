// Thin wrapper for calling MCP servers (proxy or direct)
export async function callMCP<T>(
  serverUrl: string,
  endpoint: string,
  body: Record<string, unknown>,
  opts: { signal?: AbortSignal } = {}
): Promise<T> {
  // If routed through gateway, you might POST to /api/mcp/proxy/{endpoint}
  // For now, try direct first; fall back to gateway route if needed.
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

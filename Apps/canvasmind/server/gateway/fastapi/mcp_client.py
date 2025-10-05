import httpx, os
MCP_BASE = os.getenv("MCP_BASE_URL", "http://mcp:8080")

async def submit_generation(payload: dict, idem_key: str | None = None):
    headers = {"Idempotency-Key": idem_key} if idem_key else {}
    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.post(f"{MCP_BASE}/v1/generations", json=payload, headers=headers)
        r.raise_for_status()
        return r.json()

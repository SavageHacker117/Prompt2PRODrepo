# mcp/core/http.py
from __future__ import annotations
import httpx
from typing import Any, Dict, Optional

DEFAULT_TIMEOUT = httpx.Timeout(15.0, read=30.0)
DEFAULT_HEADERS = {"User-Agent": "CanvasMind-MCP/1.0 (+oss)"}

async def get_json(url: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT, headers=DEFAULT_HEADERS, follow_redirects=True) as c:
        r = await c.get(url, params=params)
        r.raise_for_status()
        return r.json()

async def download(url: str, dest_path: str) -> str:
    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT, headers=DEFAULT_HEADERS, follow_redirects=True) as c:
        r = await c.get(url)
        r.raise_for_status()
        with open(dest_path, "wb") as f:
            for chunk in r.iter_bytes():
                f.write(chunk)
    return dest_path

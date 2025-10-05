# mcp/providers/polyhaven.py
from __future__ import annotations
import os, json, asyncio
from pathlib import Path
from typing import Any, Dict, List, Literal, Tuple
from ..core.http import get_json, download
from ..core.safeio import ensure_dir, sanitize_name, unzip_safe

BASE = "https://api.polyhaven.com"  # public JSON API
ASSETS_DIR = Path(os.getenv("MCP_ASSETS_DIR", "./data/assets")).resolve()

Kind = Literal["texture","hdri","model"]

class PolyHaven:
    """
    Minimal client for Poly Haven API.
    Docs: https://api.polyhaven.com  (public, CC0 assets)
    """

    @staticmethod
    async def search(prompt: str, kind: Kind = "texture", limit: int = 10) -> List[Dict[str, Any]]:
        # naive keyword search using /assets endpoint (client-side filter by tags/name)
        # endpoints: /assets, /files/{id}, /info/{id}
        items = await get_json(f"{BASE}/assets")
        candidates: List[Dict[str, Any]] = []
        prompt_l = prompt.lower()
        for _id, meta in items.items():
            k = meta.get("category","")
            if kind == "texture" and k != "textures":  # API uses categories
                continue
            if kind == "hdri" and k != "hdris":
                continue
            if kind == "model" and k != "models":
                continue
            name = meta.get("name","").lower()
            tags = " ".join(meta.get("tags",[])).lower()
            score = (name.count(prompt_l) * 2) + (1 if prompt_l in tags else 0)
            # quick keyword heuristic
            for token in prompt_l.split():
                if token in name or token in tags:
                    score += 1
            if score > 0:
                meta2 = meta.copy()
                meta2["id"] = _id
                meta2["score"] = score
                candidates.append(meta2)
        candidates.sort(key=lambda x: x["score"], reverse=True)
        return candidates[:limit]

    @staticmethod
    async def best_match(prompt: str, kind: Kind) -> Dict[str, Any] | None:
        cands = await PolyHaven.search(prompt, kind=kind, limit=8)
        return cands[0] if cands else None

    @staticmethod
    async def resolve_files(asset_id: str) -> Dict[str, Any]:
        # Returns available files & variants for the asset
        return await get_json(f"{BASE}/files/{asset_id}")

    @staticmethod
    async def resolve_info(asset_id: str) -> Dict[str, Any]:
        return await get_json(f"{BASE}/info/{asset_id}")

    @staticmethod
    async def download_asset(asset_id: str, kind: Kind, variant: str | None = None) -> Tuple[str, Dict[str,Any]]:
        """
        Downloads the selected asset (ZIP or file) into ASSETS_DIR/{asset_id}/
        Returns (root_dir, provenance).
        """
        files = await PolyHaven.resolve_files(asset_id)
        info  = await PolyHaven.resolve_info(asset_id)
        out_dir = ensure_dir(ASSETS_DIR / sanitize_name(asset_id))
        prov = {
            "source": "polyhaven",
            "id": asset_id,
            "license": "CC0",
            "kind": kind,
            "info": info,
        }

        # choose a practical variant
        url = None
        if kind == "texture":
            # prefer 2k zip if available
            url = files.get("2k",{}).get("zip") or files.get("1k",{}).get("zip")
        elif kind == "hdri":
            # prefer 2k hdr
            url = files.get("2k",{}).get("hdr") or files.get("1k",{}).get("hdr")
        elif kind == "model":
            # prefer glb or blend
            url = files.get("glb") or files.get("blend") or files.get("fbx")

        if not url:
            # fallback: try any first string URL in the structure
            for v in files.values():
                if isinstance(v, str):
                    url = v
                    break
                if isinstance(v, dict):
                    for vv in v.values():
                        if isinstance(vv, str):
                            url = vv; break
                if url: break

        if not url:
            raise RuntimeError(f"No downloadable file found for {asset_id}")

        filename = out_dir / sanitize_name(Path(url).name)
        await download(url, str(filename))

        extracted: List[Path] = []
        if str(filename).lower().endswith(".zip"):
            allow = (".png",".jpg",".jpeg",".exr",".hdr",".glb",".gltf",".mtl",".obj")
            extracted = unzip_safe(filename, out_dir, allow_exts=allow)

        prov["files"] = [str(p) for p in (extracted if extracted else [filename])]
        return str(out_dir), prov

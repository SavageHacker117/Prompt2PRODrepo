# mcp/api/routes/assets.py
from __future__ import annotations
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict
from pathlib import Path

router = APIRouter(tags=["assets"])

# ---------- /assets/sign ----------

class SignRequest(BaseModel):
    purpose: str
    count: int = 1

class SignResponse(BaseModel):
    urls: List[str]

@router.post("/assets/sign", response_model=SignResponse)
async def sign_assets(req: SignRequest):
    """
    Mock pre-signed URLs to unblock frontends. Replace with S3 presign later.
    """
    urls = [f"https://mcp.local/upload/{i}" for i in range(req.count)]
    return SignResponse(urls=urls)

# ---------- /assets/normalize ----------

class NormalizeResponse(BaseModel):
    assets: Dict[str, str]  # kind -> absolute path

@router.get("/assets/normalize", response_model=NormalizeResponse)
async def normalize_folder(root_dir: str):
    """
    Walk a folder exported from Poly Haven (or elsewhere) and infer canonical PBR kinds:
    - pbr_albedo, pbr_normal, pbr_roughness, pbr_ao
    Returns a mapping kind -> absolute file path.
    """
    p = Path(root_dir)
    if not p.exists():
        raise HTTPException(404, "folder not found")

    mapping = {
        "albedo": "pbr_albedo",
        "basecolor": "pbr_albedo",
        "base_color": "pbr_albedo",
        "color": "pbr_albedo",
        "col": "pbr_albedo",
        "normal": "pbr_normal",
        "nrm": "pbr_normal",
        "rough": "pbr_roughness",
        "roughness": "pbr_roughness",
        "ao": "pbr_ao",
        "occlusion": "pbr_ao",
        "ambientocclusion": "pbr_ao",
    }

    out: Dict[str, str] = {}
    for fp in p.glob("**/*"):
        if not fp.is_file():
            continue
        name = fp.name.lower()
        for key, kind in mapping.items():
            if key in name:
                # prefer not to overwrite an already found map unless this file is higher-res
                if kind not in out or len(name) > len(Path(out[kind]).name):
                    out[kind] = str(fp.resolve())

    return NormalizeResponse(assets=out)

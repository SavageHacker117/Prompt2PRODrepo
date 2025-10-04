# FastAPI MCP gateway (mock) — minimal, matches the front-end expectations
from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Literal, Optional
import time

app = FastAPI(title="CanvasMind MCP Gateway", version="1.01")

class SkyboxRequest(BaseModel):
    prompt: Optional[str] = None
    seed: Optional[int] = 42
    format: Literal["equirect"] = "equirect"

class SkyboxOut(BaseModel):
    asset: dict
    provenance: dict
    budget_hint: dict | None = None

class MeshRequest(BaseModel):
    prompt: Optional[str] = "basalt boulder with wet sheen"
    seed: Optional[int] = 1337
    poly_limit: Optional[int] = 20000

class MeshOut(BaseModel):
    asset: dict
    provenance: dict
    budget_hint: dict | None = None

@app.get("/health")
def health():
    return {"ok": True, "ts": int(time.time())}

# --- Skybox generator (mock like front-end expects) ---
@app.post("/mcp/nebula/generate_skybox", response_model=SkyboxOut)
def generate_skybox(req: SkyboxRequest):
    url = "https://threejs.org/examples/textures/2294472375_24a3b8ef46_o.jpg"
    return SkyboxOut(
        asset={"kind": "texture.equirect", "urls": [url], "mime": "image/jpeg"},
        provenance={
            "server": "/mcp/nebula",
            "model": "nebula-mock-v1",
            "prompt": req.prompt,
            "seed": req.seed,
            "ts": int(time.time()*1000),
        },
        budget_hint={"tex_mem_mb_est": 32},
    )

# --- Mesh generator (mock) ---
@app.post("/mcp/mesh/generate_mesh", response_model=MeshOut)
def generate_mesh(req: MeshRequest):
    url = "https://threejs.org/examples/models/gltf/DamagedHelmet/glTF/DamagedHelmet.gltf"
    return MeshOut(
        asset={"kind": "model.gltf", "url": url},
        provenance={
            "server": "/mcp/mesh",
            "model": "mesh-mock-v1",
            "prompt": req.prompt,
            "seed": req.seed,
            "ts": int(time.time()*1000),
        },
        budget_hint={"tris_est": req.poly_limit or 20000},
    )

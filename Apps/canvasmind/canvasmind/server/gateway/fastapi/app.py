from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import time

app = FastAPI(title="CanvasMind Gateway")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

# ---- Models ----
class RegistryItem(BaseModel):
    id: str
    name: str
    server_url: str
    tags: List[str]
    capabilities: List[str]

REGISTRY = [
    RegistryItem(
        id="nebula-skybox", name="Nebula Skybox Generator (mock)",
        server_url="/mcp/nebula", tags=["skybox","texture"], capabilities=["generate_skybox"]
    ),
    RegistryItem(
        id="mesh-boulder", name="Basalt Boulder Mesh (mock)",
        server_url="/mcp/mesh", tags=["mesh","glb"], capabilities=["generate_mesh"]
    )
]

@app.get("/registry", response_model=List[RegistryItem])
def get_registry():
    return REGISTRY

# ---- MCP mocks ----
class SkyboxIn(BaseModel):
    prompt: Optional[str] = None
    seed: Optional[int] = 42
    format: Optional[str] = "equirect"

@app.post("/mcp/nebula/generate_skybox")
def gen_skybox(body: SkyboxIn):
    return {
        "asset": {
            "kind": "texture.equirect",
            "urls": ["https://threejs.org/examples/textures/2294472375_24a3b8ef46_o.jpg"],
            "mime": "image/jpeg"
        },
        "provenance": {
            "server": "/mcp/nebula",
            "model": "nebula-mock-v1",
            "prompt": body.prompt,
            "seed": body.seed,
            "ts": int(time.time() * 1000)
        },
        "budget_hint": { "tex_mem_mb_est": 32 }
    }

class MeshIn(BaseModel):
    prompt: Optional[str] = None
    seed: Optional[int] = 1337
    poly_limit: Optional[int] = 20000

@app.post("/mcp/mesh/generate_mesh")
def gen_mesh(body: MeshIn):
    return {
        "asset": {
            "kind": "model.gltf",
            "url": "https://threejs.org/examples/models/gltf/DamagedHelmet/glTF/DamagedHelmet.gltf"
        },
        "provenance": {
            "server": "/mcp/mesh",
            "model": "mesh-mock-v1",
            "prompt": body.prompt,
            "seed": body.seed,
            "ts": int(time.time() * 1000)
        },
        "budget_hint": { "tris_est": 20000 }
    }

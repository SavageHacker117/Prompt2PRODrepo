# mcp/core/schemas.py
from typing import Optional, Dict, List, Literal
from pydantic import BaseModel, Field

Pipeline = Literal["txt2img","img2img","inpaint","tile","texture","glb"]

class GenerationRequest(BaseModel):
    pipeline: Pipeline
    prompt: str
    negative_prompt: Optional[str] = None
    width: int = 1024
    height: int = 1024
    seed: Optional[int] = None
    steps: int = 28
    cfg: float = 6.5
    sampler: str = "dpmpp_2m_karras"
    style_preset: Optional[str] = None
    safety_profile: str = "strict"
    model: Optional[str] = None
    capabilities: Optional[Dict[str, object]] = None
    inputs: Optional[Dict[str, Optional[str]]] = None
    webhook_url: Optional[str] = None
    idempotency_key: Optional[str] = None
    tenant_id: str
    project_id: str
    user_context: Optional[Dict[str, object]] = None

class JobAccepted(BaseModel):
    job_id: str
    status: Literal["queued","running"] = "queued"
    estimate_ms: int = 0

class Asset(BaseModel):
    kind: Literal["image","texture","glb","pbr_albedo","pbr_normal","pbr_roughness","pbr_ao","thumb"]
    url: str

class JobStatus(BaseModel):
    job_id: str
    status: Literal["queued","running","succeeded","failed","canceled"]
    progress_pct: float = 0
    eta_ms: int = 0
    metrics: Dict[str, float] = Field(default_factory=dict)
    assets: List[Asset] = Field(default_factory=list)
    provenance_url: Optional[str] = None
    error: Optional[str] = None

class VariationRequest(BaseModel):
    asset_id: str
    prompt: str
    seed: Optional[int] = None

class UpscaleRequest(BaseModel):
    image_url: str
    factor: Literal[2,4] = 2

class RemixRequest(BaseModel):
    source_asset_id: Optional[str] = None
    style_ref_url: Optional[str] = None
    lora: Optional[str] = None

class ModelInfo(BaseModel):
    name: str
    provider: str
    pipelines: List[str]
    warm: bool = False
    constraints: Dict[str, object] = Field(default_factory=dict)

class ModelList(BaseModel):
    models: List[ModelInfo]

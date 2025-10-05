from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, List, Literal, Optional, Protocol, TypedDict

Pipeline = Literal["txt2img", "img2img", "inpaint", "tile", "texture", "glb"]

class GenerationRequest(TypedDict, total=False):
    pipeline: Pipeline
    prompt: str
    negative_prompt: Optional[str]
    width: int
    height: int
    seed: Optional[int]
    steps: int
    cfg: float
    sampler: str
    style_preset: Optional[str]
    safety_profile: str
    model: Optional[str]
    capabilities: Dict[str, object] | None
    inputs: Dict[str, Optional[str]] | None
    webhook_url: Optional[str]
    idempotency_key: Optional[str]
    tenant_id: str
    project_id: str
    user_context: Dict[str, object] | None

@dataclass
class CapabilitySpec:
    pipelines: List[Pipeline]
    max_px: int = 2048 * 2048
    supports_tile: bool = False
    warm: bool = False
    cost_per_1k_steps_usd: float | None = None

class Prepared(TypedDict):
    job_id: str
    workdir: str
    args: Dict[str, object]

class RawResult(TypedDict):
    job_id: str
    outputs: List[str]           # local file paths or URLs
    logs: str | None

class FinalAsset(TypedDict):
    kind: str
    path: str
    meta: Dict[str, object] | None

class FinalAssetSet(TypedDict):
    job_id: str
    assets: List[FinalAsset]
    provenance: Dict[str, object]

class AdapterMetrics(TypedDict):
    gpu_ms: int
    provider_cost_usd: float | None

class GenerationAdapter(Protocol):
    name: str
    capabilities: CapabilitySpec

    async def warmup(self) -> None: ...
    async def prepare(self, input: GenerationRequest) -> Prepared: ...
    async def execute(self, job: Prepared, abort_signal=None) -> RawResult: ...
    async def postprocess(self, raw: RawResult, ops: List[str] | None = None) -> FinalAssetSet: ...
    def report(self) -> AdapterMetrics: ...

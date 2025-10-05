from __future__ import annotations
import asyncio
from .adapter_base import CapabilitySpec, GenerationAdapter, GenerationRequest, Prepared, RawResult, FinalAssetSet

class TextureTilerAdapter(GenerationAdapter):
    """
    Tileable texture generator stub.
    Produces placeholders for PBR maps (albedo/normal/roughness/AO).
    """
    name = "texture_tiler"
    capabilities = CapabilitySpec(pipelines=["tile", "texture"], supports_tile=True, warm=False)

    def __init__(self) -> None:
        self._gpu_ms = 0

    async def warmup(self) -> None:
        await asyncio.sleep(0)

    async def prepare(self, input: GenerationRequest) -> Prepared:
        return {"job_id": "unknown", "workdir": "/tmp", "args": dict(input)}

    async def execute(self, job: Prepared, abort_signal=None) -> RawResult:
        await asyncio.sleep(0.15)
        outs = [
            "/tmp/albedo.png",
            "/tmp/normal.png",
            "/tmp/roughness.png",
            "/tmp/ao.png",
        ]
        return {"job_id": job["job_id"], "outputs": outs, "logs": "texture tiler placeholder"}

    async def postprocess(self, raw, ops=None) -> FinalAssetSet:
        kinds = ["pbr_albedo", "pbr_normal", "pbr_roughness", "pbr_ao"]
        assets = [{"kind": k, "path": p, "meta": {"tileable": True}} for k, p in zip(kinds, raw["outputs"])]
        return {"job_id": raw["job_id"], "assets": assets, "provenance": {"adapter": self.name}}

    def report(self):
        return {"gpu_ms": self._gpu_ms, "provider_cost_usd": None}

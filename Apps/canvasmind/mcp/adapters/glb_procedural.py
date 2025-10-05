from __future__ import annotations
import asyncio
from .adapter_base import CapabilitySpec, GenerationAdapter, GenerationRequest, Prepared, RawResult, FinalAssetSet

class GLBProceduralAdapter(GenerationAdapter):
    """
    Procedural GLB adapter (stub).
    Writes a placeholder file path that your pipeline can replace with a real exporter.
    """
    name = "glb_procedural"
    capabilities = CapabilitySpec(pipelines=["glb"], supports_tile=False, warm=False)

    def __init__(self) -> None:
        self._gpu_ms = 0

    async def warmup(self) -> None:
        await asyncio.sleep(0)

    async def prepare(self, input: GenerationRequest) -> Prepared:
        return {"job_id": "unknown", "workdir": "/tmp", "args": dict(input)}

    async def execute(self, job: Prepared, abort_signal=None) -> RawResult:
        await asyncio.sleep(0.1)
        # In a real impl: generate mesh + materials → export GLB.
        path = "/tmp/procedural.glb"
        return {"job_id": job["job_id"], "outputs": [path], "logs": "procedural GLB placeholder"}

    async def postprocess(self, raw, ops=None) -> FinalAssetSet:
        return {
            "job_id": raw["job_id"],
            "assets": [{"kind": "glb", "path": raw["outputs"][0], "meta": {"procedural": True}}],
            "provenance": {"adapter": self.name}
        }

    def report(self):
        return {"gpu_ms": self._gpu_ms, "provider_cost_usd": None}

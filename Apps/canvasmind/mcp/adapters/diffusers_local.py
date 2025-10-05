from __future__ import annotations
import asyncio
from .adapter_base import CapabilitySpec, GenerationAdapter, GenerationRequest, Prepared, RawResult, FinalAssetSet

class DiffusersLocalAdapter(GenerationAdapter):
    """
    Minimal stub for a local Diffusers-style adapter.
    This does NOT import heavy ML libs; it simulates latency and returns a fake image path.
    Swap with a real pipeline later.
    """
    name = "diffusers_local"
    capabilities = CapabilitySpec(pipelines=["txt2img", "img2img", "inpaint"], supports_tile=False, warm=True)

    def __init__(self) -> None:
        self._gpu_ms = 0

    async def warmup(self) -> None:
        # Place to spin up pipelines onto GPU
        await asyncio.sleep(0.01)

    async def prepare(self, input: GenerationRequest) -> Prepared:
        return {"job_id": "unknown", "workdir": "/tmp", "args": dict(input)}

    async def execute(self, job: Prepared, abort_signal=None) -> RawResult:
        await asyncio.sleep(0.2)  # simulate generation
        self._gpu_ms += 200
        return {"job_id": job["job_id"], "outputs": ["/tmp/fake_image.webp"], "logs": "simulated diffusers run"}

    async def postprocess(self, raw, ops=None) -> FinalAssetSet:
        return {
            "job_id": raw["job_id"],
            "assets": [{"kind": "image", "path": raw["outputs"][0], "meta": {"simulated": True}}],
            "provenance": {"adapter": self.name}
        }

    def report(self):
        return {"gpu_ms": self._gpu_ms, "provider_cost_usd": None}

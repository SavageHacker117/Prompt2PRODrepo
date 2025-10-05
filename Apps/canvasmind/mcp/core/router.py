# mcp/core/router.py
from __future__ import annotations
from typing import Dict
from ..adapters.adapter_base import GenerationRequest, GenerationAdapter
from ..adapters.diffusers_local import DiffusersLocalAdapter
from ..adapters.texture_tiler import TextureTilerAdapter
from ..adapters.glb_procedural import GLBProceduralAdapter

class ModelRouter:
    """
    Very small capability-based router.
    Expand with scoring (quality/latency/cost/safety) and warmness.
    """
    def __init__(self) -> None:
        self._adapters: Dict[str, GenerationAdapter] = {
            "diffusers_local": DiffusersLocalAdapter(),
            "texture_tiler": TextureTilerAdapter(),
            "glb_procedural": GLBProceduralAdapter(),
        }

    def choose(self, req: GenerationRequest) -> GenerationAdapter:
        explicit = req.get("model")
        if explicit and explicit in self._adapters:
            return self._adapters[explicit]

        # naive mapping by pipeline
        pipeline = req.get("pipeline")

        # NOTE: Poly Haven "fetch_external_*" pipelines are handled by REST endpoints.
        # We map to texture_tiler as a harmless default to keep flow unblocked if someone
        # accidentally calls /v1/generations with these pipelines.
        if pipeline in ("fetch_external_texture", "fetch_external_hdri", "fetch_external_model"):
            return self._adapters["texture_tiler"]

        if pipeline in ("txt2img", "img2img", "inpaint"):
            return self._adapters["diffusers_local"]

        if pipeline in ("tile", "texture"):
            return self._adapters["texture_tiler"]

        if pipeline == "glb":
            return self._adapters["glb_procedural"]

        return self._adapters["diffusers_local"]

router = ModelRouter()

from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Dict

router = APIRouter(tags=["models"])

class ModelInfo(BaseModel):
    name: str
    provider: str
    pipelines: List[str]
    warm: bool = False
    constraints: Dict[str, object] = {}

class ModelList(BaseModel):
    models: List[ModelInfo]

@router.get("/models", response_model=ModelList)
async def list_models():
    """
    Static registry snapshot until you wire the real adapter registry.
    """
    models = [
        ModelInfo(name="diffusers_local", provider="local", pipelines=["txt2img","img2img","inpaint"], warm=True),
        ModelInfo(name="texture_tiler", provider="local", pipelines=["tile","texture"], warm=False, constraints={"supports_tile": True}),
        ModelInfo(name="glb_procedural", provider="local", pipelines=["glb"], warm=False),
    ]
    return ModelList(models=models)

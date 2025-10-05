# mcp/api/routes/generations.py
from fastapi import APIRouter, Header, HTTPException
from ...core.schemas import GenerationRequest, JobAccepted, JobStatus, VariationRequest, UpscaleRequest, RemixRequest
from ...core import orchestrator, memory_store as db

router = APIRouter(tags=["generations"])

@router.post("/generations", response_model=JobAccepted, status_code=202)
async def create_generation(req: GenerationRequest, idempotency_key: str | None = Header(default=None, alias="Idempotency-Key")):
    return await orchestrator.submit(req)

@router.get("/generations/{job_id}", response_model=JobStatus)
async def get_generation(job_id: str):
    if not db.has(job_id): raise HTTPException(404, "job not found")
    return db.get(job_id)

@router.post("/variations", status_code=202)
async def create_variations(req: VariationRequest):
    return {"status": "not_implemented_yet"}

@router.post("/upscale", status_code=202)
async def upscale(req: UpscaleRequest):
    return {"status": "not_implemented_yet"}

@router.post("/remix", status_code=202)
async def remix(req: RemixRequest):
    return {"status": "not_implemented_yet"}

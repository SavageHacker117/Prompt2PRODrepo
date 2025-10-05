# mcp/core/orchestrator.py
import asyncio, uuid, random
from .schemas import GenerationRequest, JobAccepted, JobStatus, Asset
from . import memory_store as db

async def _run_job(job_id: str, req: GenerationRequest):
    # simulate work + result
    for p in (10, 35, 65, 100):
        await asyncio.sleep(0.3)
        jb = db.get(job_id)
        jb.progress_pct = p
        jb.status = "running" if p < 100 else "succeeded"
        db.put(jb)
    # pretend we produced an asset
    assets = []
    if req.pipeline in ("texture","tile"):
        assets = [
          Asset(kind="pbr_albedo", url=f"https://mcp.local/{job_id}/albedo.png"),
          Asset(kind="pbr_normal", url=f"https://mcp.local/{job_id}/normal.png"),
          Asset(kind="pbr_roughness", url=f"https://mcp.local/{job_id}/roughness.png"),
          Asset(kind="pbr_ao", url=f"https://mcp.local/{job_id}/ao.png"),
        ]
    elif req.pipeline == "glb":
        assets = [Asset(kind="glb", url=f"https://mcp.local/{job_id}/model.glb")]
    else:
        assets = [Asset(kind="image", url=f"https://mcp.local/{job_id}/image.webp")]
    jb = db.get(job_id)
    jb.assets = assets
    db.put(jb)

async def submit(req: GenerationRequest) -> JobAccepted:
    job_id = f"job_{uuid.uuid4().hex[:12]}"
    jb = JobStatus(job_id=job_id, status="queued", eta_ms=1500)
    db.put(jb)
    asyncio.create_task(_run_job(job_id, req))
    return JobAccepted(job_id=job_id, status="queued", estimate_ms=1500)

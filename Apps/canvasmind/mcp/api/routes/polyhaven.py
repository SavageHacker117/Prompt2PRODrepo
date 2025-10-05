# mcp/api/routes/polyhaven.py
from __future__ import annotations
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Any, Dict, List, Literal
from ...providers.polyhaven import PolyHaven, Kind
from ...telemetry.logger import event

router = APIRouter(tags=["polyhaven"])

class SearchResponse(BaseModel):
    items: List[Dict[str, Any]]

class FetchResponse(BaseModel):
    root_dir: str
    provenance: Dict[str, Any]

@router.get("/polyhaven/search", response_model=SearchResponse)
async def search_polyhaven(prompt: str = Query(..., min_length=2), kind: Kind = Query("texture")):
    items = await PolyHaven.search(prompt, kind=kind, limit=10)
    return SearchResponse(items=items)

@router.post("/polyhaven/fetch", response_model=FetchResponse)
async def fetch_polyhaven(prompt: str, kind: Kind = "texture"):
    best = await PolyHaven.best_match(prompt, kind)
    if not best:
        raise HTTPException(404, detail="no match")
    root, prov = await PolyHaven.download_asset(best["id"], kind=kind)
    event("polyhaven_fetch", id=best["id"], kind=kind)
    return FetchResponse(root_dir=root, provenance=prov)

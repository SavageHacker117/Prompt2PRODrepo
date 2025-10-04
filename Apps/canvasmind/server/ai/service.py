# server/ai/service.py
from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Dict, Any
from .policy_infer import PolicyInfer
from .telemetry_logger import TelemetryLogger

app = FastAPI(title="CanvasMind AI Service")

# lazy singletons
_policy = None
_logger = TelemetryLogger("telemetry.jsonl")

class ScoreReq(BaseModel):
    features: List[List[float]]  # [[f1..fD], ...]
    in_dim: int = 16
    model_path: str = "policy.pt"

class ScoreResp(BaseModel):
    scores: List[float]

class TelemetryEvt(BaseModel):
    prompt: str
    candidate: Dict[str, Any]
    chosen: bool = True
    dwell_time: float = 0.0

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/score", response_model=ScoreResp)
def score(req: ScoreReq):
    global _policy
    if _policy is None:
        _policy = PolicyInfer(req.model_path, in_dim=req.in_dim)
    scores = _policy.score_candidates(__import__("numpy").array(req.features, dtype=float)).tolist()
    return {"scores": scores}

@app.post("/telemetry")
def telemetry(evt: TelemetryEvt):
    _logger.log_event(evt.prompt, evt.candidate, evt.chosen, evt.dwell_time)
    return {"ok": True}

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

router = APIRouter(tags=["webhooks"])

class WebhookTestPayload(BaseModel):
    message: str = "ok"

@router.post("/webhooks/test")
async def webhooks_test(x_signature: str | None = Header(default=None), payload: WebhookTestPayload | None = None):
    """
    Basic signed webhook echo endpoint (signature not enforced yet).
    Extend to verify HMAC from Server A.
    """
    if x_signature is None:
        # accept but warn (dev mode)
        return {"ok": True, "warning": "no signature", "payload": payload.dict() if payload else {}}
    return {"ok": True, "signature": x_signature, "payload": payload.dict() if payload else {}}

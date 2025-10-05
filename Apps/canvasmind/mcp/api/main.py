# mcp/api/main.py
from fastapi import FastAPI
from .routes import generations, models, assets, webhooks
from .routes import polyhaven  # NEW

app = FastAPI(title="CanvasMind MCP API", version="0.1.0")

@app.get("/healthz")
async def healthz():
    return {"ok": True}

app.include_router(generations.router, prefix="/v1")
app.include_router(models.router, prefix="/v1")
app.include_router(assets.router, prefix="/v1")
app.include_router(webhooks.router, prefix="/v1")
app.include_router(polyhaven.router, prefix="/v1")  # NEW

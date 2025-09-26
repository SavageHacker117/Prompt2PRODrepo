from fastapi import FastAPI, Request

app = FastAPI(title="Telemetry Collector")

@app.post("/telemetry")
async def collect(req: Request):
    body = await req.json()
    print("Telemetry received:", body)
    return {"status": "ok"}

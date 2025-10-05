from fastapi.testclient import TestClient
from mcp.api.main import app

client = TestClient(app)

def test_health():
    r = client.get("/healthz")
    assert r.status_code == 200
    assert r.json().get("ok") is True

def test_models():
    r = client.get("/v1/models")
    assert r.status_code == 200
    assert "models" in r.json()

def test_sign_assets():
    r = client.post("/v1/assets/sign", json={"purpose":"reference","count":2})
    assert r.status_code == 200
    urls = r.json()["urls"]
    assert len(urls) == 2

# mcp/tests/test_polyhaven_integration.py
import os
import pytest
from fastapi.testclient import TestClient
from mcp.api.main import app

NET_OK = os.getenv("MCP_TEST_NET", "1") != "0"
client = TestClient(app)

@pytest.mark.skipif(not NET_OK, reason="network disabled (set MCP_TEST_NET=1 to enable)")
def test_polyhaven_fetch_and_normalize():
    # 1) Ask MCP to fetch a texture set for "grass"
    r = client.post("/v1/polyhaven/fetch", json={"prompt": "lush green grass", "kind": "texture"})
    assert r.status_code == 200, r.text
    data = r.json()
    root_dir = data["root_dir"]
    prov = data["provenance"]
    assert prov["source"] == "polyhaven"
    assert prov["license"] == "CC0"
    assert "id" in prov

    # 2) Normalize the folder into canonical PBR kinds
    r2 = client.get("/v1/assets/normalize", params={"root_dir": root_dir})
    assert r2.status_code == 200, r2.text
    assets = r2.json()["assets"]

    # 3) Smoke expectations: we should have at least an albedo texture
    assert "pbr_albedo" in assets

    # Optionally assert more maps if the chosen asset contains them
    # (Some PH textures include normal/roughness/AO; others are minimalist.)

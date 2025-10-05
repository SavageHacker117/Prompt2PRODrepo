import os
from pydantic import BaseModel

class Settings(BaseModel):
    app_name: str = "CanvasMind MCP"
    env: str = os.getenv("MCP_ENV", "dev")
    s3_endpoint: str = os.getenv("S3_ENDPOINT", "http://minio:9000")
    s3_bucket: str = os.getenv("S3_BUCKET", "canvasmind")
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    pg_dsn: str = os.getenv("PG_DSN", "postgresql://postgres:postgres@localhost:5432/mcp")  # optional
    oidc_issuer: str = os.getenv("OIDC_ISSUER", "")
    oidc_audience: str = os.getenv("OIDC_AUDIENCE", "mcp")
    webhook_secret: str = os.getenv("WEBHOOK_SECRET", "devsecret")

settings = Settings()

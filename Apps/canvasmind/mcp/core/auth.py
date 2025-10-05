from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

security = HTTPBearer(auto_error=False)

class Principal:
    def __init__(self, sub: str, tenant_id: str | None, roles: list[str]) -> None:
        self.sub = sub
        self.tenant_id = tenant_id
        self.roles = roles

async def get_principal(creds: HTTPAuthorizationCredentials = Depends(security)) -> Principal:
    """
    Minimal JWT stub compatible with Keycloak-style Bearer tokens.
    For now, this accepts any token and returns an anonymous principal.
    Wire a real JWKS verifier here (python-jose or authlib) against your Keycloak issuer.
    """
    if creds is None:
        # Anonymous dev principal; tighten in prod.
        return Principal(sub="anon", tenant_id=None, roles=["guest"])
    token = creds.credentials
    # TODO: decode/verify token via Keycloak JWKS; pull tenant_id and roles.
    return Principal(sub="bearer", tenant_id=None, roles=["user"])

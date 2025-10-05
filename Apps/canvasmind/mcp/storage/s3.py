from typing import List

def presign_uploads(purpose: str, count: int = 1) -> List[str]:
    """
    Return mock pre-signed upload URLs. Replace with aioboto3/boto3 presign.
    """
    return [f"https://mcp.local/upload/{purpose}/{i}" for i in range(count)]

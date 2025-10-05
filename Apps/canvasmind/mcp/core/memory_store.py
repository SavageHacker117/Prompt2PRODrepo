# mcp/core/memory_store.py
from typing import Dict
from .schemas import JobStatus
_store: Dict[str, JobStatus] = {}

def put(job: JobStatus): _store[job.job_id] = job
def get(job_id: str) -> JobStatus: return _store[job_id]
def has(job_id: str) -> bool: return job_id in _store

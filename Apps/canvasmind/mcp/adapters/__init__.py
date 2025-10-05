"""
Adapter registry namespace.

Each adapter must implement the GenerationAdapter interface from adapter_base.py.
"""
from .adapter_base import GenerationAdapter, CapabilitySpec, GenerationRequest

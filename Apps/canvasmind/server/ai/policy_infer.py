# canvasmind/server/ai/policy_infer.py
from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import List

import numpy as np


@dataclass
class PolicyConfig:
    # feature dimension we expect from the web client (keep 16 to match your boot.ts)
    input_dim: int = 16
    # fallback weights/bias if no checkpoint exists
    seed: int = 1337
    # optional path for a saved checkpoint
    ckpt_path: str = os.path.join(os.path.dirname(__file__), "policy_ckpt.json")


class PolicyInfer:
    """
    Lightweight scoring model with NumPy instead of torch.
    - Input: 2D list of floats [n_candidates, input_dim]
    - Output: list of floats "scores" (higher is better)
    - If a JSON checkpoint exists, load it; otherwise initialize seeded random weights.
    """

    def __init__(self, cfg: PolicyConfig | None = None):
        self.cfg = cfg or PolicyConfig()
        self.W, self.b = self._load_or_init()

    def _load_or_init(self):
        rng = np.random.default_rng(self.cfg.seed)
        W = rng.standard_normal((self.cfg.input_dim, 1)).astype(np.float32) * 0.1
        b = np.array([[0.0]], dtype=np.float32)

        if os.path.isfile(self.cfg.ckpt_path):
            try:
                with open(self.cfg.ckpt_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                W = np.array(data.get("W", W.tolist()), dtype=np.float32)
                b = np.array(data.get("b", b.tolist()), dtype=np.float32)
            except Exception as e:
                print("[policy_infer] failed to load ckpt, using defaults:", e)

        # sanity
        if W.shape != (self.cfg.input_dim, 1):
            raise ValueError(f"Checkpoint W has shape {W.shape}, expected ({self.cfg.input_dim}, 1)")
        if b.shape != (1, 1):
            raise ValueError(f"Checkpoint b has shape {b.shape}, expected (1, 1)")

        return W, b

    def score(self, X: List[List[float]]) -> List[float]:
        """
        X: list of candidates, each with input_dim features.
        returns: list of scalar scores.
        """
        if not X:
            return []
        A = np.array(X, dtype=np.float32)
        if A.ndim != 2 or A.shape[1] != self.cfg.input_dim:
            raise ValueError(f"Expected X shape (N,{self.cfg.input_dim}) but got {A.shape}")

        # simple linear: y = XW + b; then squeeze
        y = A @ self.W + self.b
        return y.squeeze(-1).astype(float).tolist()

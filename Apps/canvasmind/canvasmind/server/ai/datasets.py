import json
import torch
from torch.utils.data import Dataset

class TelemetryDataset(Dataset):
    """Takes JSONL telemetry and converts to features + targets."""
    def __init__(self, path: str, in_dim: int = 16):
        self.samples = []
        try:
            with open(path, "r", encoding="utf-8") as f:
                for line in f:
                    evt = json.loads(line)
                    # Feature engineering (stub: embed prompt len, dwell time, tags)
                    feat = [len(evt.get("prompt", "")) % 100, evt.get("dwell_time", 0.0)]
                    # pad to in_dim
                    feat = feat + [0] * (in_dim - len(feat))
                    label = 1.0 if evt.get("chosen", False) else 0.0
                    self.samples.append((feat[:in_dim], label))
        except FileNotFoundError:
            pass

    def __len__(self): return len(self.samples)
    def __getitem__(self, idx):
        feat, label = self.samples[idx]
        return torch.tensor(feat, dtype=torch.float32), torch.tensor(label, dtype=torch.float32)

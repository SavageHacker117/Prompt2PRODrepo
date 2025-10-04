import math, json, torch
from torch import nn, optim
from torch.optim.lr_scheduler import CosineAnnealingWarmRestarts
from pathlib import Path
from .datasets import TelemetryDataset

def normalized_weight_decay(lambda_norm: float, batch_size: int, total_samples: int, epochs: int):
    return lambda_norm * math.sqrt(batch_size / (total_samples * epochs))

class TinyPolicy(nn.Module):
    def __init__(self, in_dim: int, hid: int = 128):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(in_dim, hid), nn.ReLU(),
            nn.Linear(hid, hid), nn.ReLU(),
            nn.Linear(hid, 1)  # output score
        )
    def forward(self, x): return self.net(x).squeeze(-1)

def train_policy(
    telemetry_path: str = "telemetry.jsonl",
    out_path: str = "policy.pt",
    in_dim: int = 16,
    epochs: int = 30,
    batch_size: int = 128,
    base_lr: float = 3e-4,
    lambda_norm: float = 0.05,
):
    ds = TelemetryDataset(telemetry_path, in_dim)
    total_samples = len(ds)
    if total_samples == 0:
        print("[train_policy] No telemetry found, aborting.")
        return None

    wd = normalized_weight_decay(lambda_norm, batch_size, total_samples, epochs)
    model = TinyPolicy(in_dim).cuda()
    opt = optim.AdamW(model.parameters(), lr=base_lr, weight_decay=wd)
    sched = CosineAnnealingWarmRestarts(opt, T_0=max(1, epochs // 4), T_mult=2)
    loss_fn = nn.MSELoss()

    loader = torch.utils.data.DataLoader(ds, batch_size=batch_size, shuffle=True, drop_last=True)
    model.train()
    for epoch in range(epochs):
        for xb, yb in loader:
            xb, yb = xb.cuda(), yb.cuda()
            pred = model(xb)
            loss = loss_fn(pred, yb)
            opt.zero_grad(set_to_none=True)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step()
        sched.step(epoch)

    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    torch.save(model.state_dict(), out_path)
    print(f"[train_policy] Saved model to {out_path}")
    return out_path

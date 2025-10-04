# server/planner/learners/policy_train.py
import math, torch
from torch import nn, optim
from torch.optim.lr_scheduler import CosineAnnealingWarmRestarts

def normalized_weight_decay(lambda_norm: float, batch_size: int, total_samples: int, epochs: int):
    # λ = λ_norm * sqrt(b / (B*T))
    return lambda_norm * math.sqrt(batch_size / (total_samples * epochs))

class TinyPolicy(nn.Module):
    def __init__(self, in_dim, hid=128):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(in_dim, hid), nn.ReLU(),
            nn.Linear(hid, hid), nn.ReLU(),
            nn.Linear(hid, 1)  # score
        )
    def forward(self, x): return self.net(x)

def train_loop(ds, in_dim, epochs=50, batch_size=256, base_lr=3e-4, lambda_norm=0.05):
    model = TinyPolicy(in_dim).cuda()
    total_samples = len(ds)
    wd = normalized_weight_decay(lambda_norm, batch_size, total_samples, epochs)  # AdamW-style wd

    opt = optim.AdamW(model.parameters(), lr=base_lr, weight_decay=wd)  # <- decoupled WD
    sched = CosineAnnealingWarmRestarts(opt, T_0=max(1, epochs//4), T_mult=2)  # warm restarts

    loader = torch.utils.data.DataLoader(ds, batch_size=batch_size, shuffle=True, drop_last=True)
    loss_fn = nn.MSELoss()  # or BCEWithLogitsLoss, etc.

    model.train()
    for epoch in range(epochs):
        for xb, yb in loader:
            xb, yb = xb.cuda(), yb.cuda()
            pred = model(xb).squeeze(-1)
            loss = loss_fn(pred, yb)
            opt.zero_grad(set_to_none=True)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step()
        sched.step(epoch)  # cosine anneal + potential restart
    return model

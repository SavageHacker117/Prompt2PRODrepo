import json
from pathlib import Path
from datetime import datetime

class TelemetryLogger:
    def __init__(self, path="telemetry.jsonl"):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def log_event(self, prompt: str, candidate_meta: dict, chosen: bool, dwell_time: float):
        event = {
            "ts": datetime.utcnow().isoformat(),
            "prompt": prompt,
            "candidate": candidate_meta,
            "chosen": chosen,
            "dwell_time": dwell_time,
        }
        with self.path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(event) + "\n")

# mcp/core/safeio.py
from __future__ import annotations
import os, zipfile
from pathlib import Path
from typing import Iterable

def ensure_dir(p: str | Path) -> Path:
    path = Path(p)
    path.mkdir(parents=True, exist_ok=True)
    return path

def sanitize_name(name: str) -> str:
    keep = [c for c in name if c.isalnum() or c in ("-","_",".")]
    return "".join(keep) or "asset"

def unzip_safe(zip_path: str | Path, dest_dir: str | Path, allow_exts: Iterable[str] = ()) -> list[Path]:
    dest = ensure_dir(dest_dir)
    out: list[Path] = []
    with zipfile.ZipFile(zip_path, "r") as zf:
        for m in zf.infolist():
            # zip-slip protection
            target = dest.joinpath(m.filename).resolve()
            if not str(target).startswith(str(dest.resolve())):
                continue
            if m.is_dir():
                ensure_dir(target)
                continue
            if allow_exts and not any(str(m.filename).lower().endswith(ext) for ext in allow_exts):
                continue
            ensure_dir(target.parent)
            with zf.open(m, "r") as src, open(target, "wb") as dst:
                dst.write(src.read())
            out.append(target)
    return out

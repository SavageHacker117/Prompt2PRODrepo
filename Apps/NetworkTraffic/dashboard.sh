#!/usr/bin/env bash
# Example launcher (sanitized). No hardcoded HOME paths, no desktop env assumptions.
set -euo pipefail

APP_DIR="${APP_DIR:-$(pwd)}"
PY_ENV="${PY_ENV:-}"          # optional path to "bin/activate"
PORT="${PORT:-8080}"

echo "[+] APP_DIR=$APP_DIR"
[ -n "$PY_ENV" ] && { echo "[+] Activating venv: $PY_ENV"; source "$PY_ENV"; }

# Start Flask API (netmon.py) in background if present
if [ -f "$APP_DIR/netmon.py" ]; then
  echo "[+] Starting Flask API on :5001"
  ( cd "$APP_DIR" && python3 netmon.py ) &
else
  echo "[!] netmon.py not found in $APP_DIR (skipping API)"
fi

# Serve static files (dashboard.html/index.html) from APP_DIR
echo "[+] Serving static files from $APP_DIR on :$PORT"
( cd "$APP_DIR" && python3 -m http.server "$PORT" ) &

echo "[*] Open http://localhost:$PORT/dashboard.html in your browser."
wait

# Example System Dashboard

This is a **sanitized prototype** reworked into an **example app** for new developers.  
It shows how to combine a Python (Flask) backend with a simple HTML/JS dashboard.

---

## Features
- **Flask API (`netmon.py`)**
  - `/api/netstats` – live network traffic
  - `/api/sysstats` – CPU, memory, disk, swap, optional temperature
  - `/api/procs` – top processes
  - `/api/docker` – running Docker containers (if Docker installed)
  - `/api/benchmark` – optional CPU stress test (requires `stress-ng`)
- **Dashboard (`dashboard.html` + `dashboard.js`)**
  - Charts for network and CPU load
  - Live process and container lists
  - Benchmark buttons with safety checks
- **Lightweight launcher (`dashboard.sh`)**
  - Starts Flask API
  - Serves static HTML with `python3 -m http.server`

---

## Quickstart
```bash
# clone your repo
git clone https://github.com/YOURUSER/yourrepo.git
cd yourrepo

# optional: create a venv
python3 -m venv venv
source venv/bin/activate
pip install flask flask-cors psutil pyyaml

# run everything
./dashboard.sh
Then open http://localhost:8080/dashboard.html
.
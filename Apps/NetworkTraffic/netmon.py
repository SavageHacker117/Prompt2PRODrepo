from flask import Flask, jsonify, request
from flask_cors import CORS
import psutil, yaml, datetime, subprocess, os, json, shutil

CONFIG_FILE = os.environ.get('NETMON_CONFIG', 'config.yaml')
config = {}
try:
    with open(CONFIG_FILE, 'r') as f:
        config = yaml.safe_load(f) or {}
except Exception:
    config = {}

LOG_FILE = config.get('log_file', 'netmon.log')
DOCKER_BIN = shutil.which('docker')
STRESS_BIN = shutil.which('stress-ng')

app = Flask(__name__)
CORS(app)

BENCHMARK_PROCESS = None

def log(message: str) -> None:
    timestamp = datetime.datetime.now().isoformat()
    try:
        with open(LOG_FILE, 'a') as f:
            f.write(f"[{timestamp}] {message}\n")
    except Exception:
        pass

@app.get('/api/netstats')
def netstats():
    counters = psutil.net_io_counters(pernic=True)
    stats = {iface: {'bytes_sent': c.bytes_sent, 'bytes_recv': c.bytes_recv} for iface, c in counters.items()}
    log(f"NETSTATS {stats}")
    return jsonify(stats)

@app.get('/api/sysstats')
def sysstats():
    cpu_percent = psutil.cpu_percent(interval=0.2, percpu=True)
    mem = psutil.virtual_memory()
    disk = psutil.disk_usage('/')
    # Try to get CPU temperature (Linux only; needs lm-sensors)
    cpu_temp = None
    try:
        out = subprocess.check_output("sensors", shell=True, stderr=subprocess.DEVNULL).decode()
        for line in out.splitlines():
            if any(k in line for k in ("Package id 0", "Tctl:", "Core 0")) and '+' in line:
                cpu_temp = float(line.split('+')[1].split('°')[0])
                break
    except Exception:
        pass
    data = {
        "cpu_percent": cpu_percent,
        "mem_total": round(mem.total/1024/1024, 1),   # MB
        "mem_used": round(mem.used/1024/1024, 1),     # MB
        "disk_total": round(disk.total/1024/1024/1024, 2),  # GB
        "disk_used": round(disk.used/1024/1024/1024, 2),    # GB
        "cpu_temp": cpu_temp,
        "swap_used": round(psutil.swap_memory().used/1024/1024, 1),
        "swap_total": round(psutil.swap_memory().total/1024/1024, 1)
    }
    log(f"SYSSTATS {data}")
    return jsonify(data)

@app.get('/api/procs')
def procs():
    procs = []
    for p in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_info']):
        try:
            procs.append({
                'pid': p.info['pid'],
                'name': p.info['name'],
                'cpu_percent': p.info['cpu_percent'],
                'mem_mb': round(p.info['memory_info'].rss / 1024 / 1024, 1)
            })
        except Exception:
            continue
    top = sorted(procs, key=lambda x: -x['cpu_percent'])[:5]
    return jsonify(top)

@app.get('/api/docker')
def docker():
    if not DOCKER_BIN:
        log("DOCKER not available on PATH")
        return jsonify([])
    try:
        output = subprocess.check_output([DOCKER_BIN, 'ps', '--format', '{{json .}}'], stderr=subprocess.DEVNULL).decode()
        containers = []
        for line in output.splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                containers.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    except Exception:
        containers = []
    log(f"DOCKER {containers}")
    return jsonify(containers)

@app.post('/api/benchmark')
def benchmark():
    # Start a short CPU stress benchmark if stress-ng is installed.
    global BENCHMARK_PROCESS
    if BENCHMARK_PROCESS and BENCHMARK_PROCESS.poll() is None:
        return jsonify({"status": "already running"}), 409
    if not STRESS_BIN:
        return jsonify({"status": "unavailable"}), 501
    BENCHMARK_PROCESS = subprocess.Popen([STRESS_BIN, '--cpu', str(psutil.cpu_count()), '--timeout', '30'])
    return jsonify({"status": "started"})

@app.post('/api/benchmark/stop')
def stop_benchmark():
    global BENCHMARK_PROCESS
    if BENCHMARK_PROCESS and BENCHMARK_PROCESS.poll() is None:
        BENCHMARK_PROCESS.terminate()
        BENCHMARK_PROCESS = None
        return jsonify({"status": "terminated"})
    return jsonify({"status": "not running"}), 404

if __name__ == '__main__':
    print(f"NetMon API running. Logging to {LOG_FILE}. Config: {CONFIG_FILE}")
    app.run(host='0.0.0.0', port=5001)

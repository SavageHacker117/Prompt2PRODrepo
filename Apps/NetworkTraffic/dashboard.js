/* Example System Dashboard JS (sanitized)
   - Uses relative API paths so it works behind any reverse proxy.
   - No hardcoded localhost or ports; set window.API_BASE to override.
   - Adds basic resilience and avoids silent failures.
*/

(() => {
  const API_BASE = (window.API_BASE || "").replace(/\/$/, "");
  const get = (path) => fetch(`${API_BASE}${path}`, { cache: "no-store" }).then(r => r.json());

  let netChart, cpuChart;
  let netData = {labels:[], sent:[], recv:[]};
  let cpuData = {labels:[], usage:[]};
  let cpuOverheat = false;

  function makeNetChart() {
    const ctx = document.getElementById('netChart')?.getContext('2d');
    if (!ctx) return;
    netChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: netData.labels,
        datasets: [
          { label: 'Bytes Sent', data: netData.sent, borderColor: '#1ee3ff', fill: false },
          { label: 'Bytes Recv', data: netData.recv, borderColor: '#48ff77', fill: false }
        ]
      },
      options: {responsive:false, plugins:{legend:{labels:{color:'#f5f5f5'}}}, scales:{x:{ticks:{color:'#f5f5f5'}}, y:{ticks:{color:'#f5f5f5'}}}}
    });
  }

  function makeCPUChart() {
    const ctx = document.getElementById('cpuChart')?.getContext('2d');
    if (!ctx) return;
    cpuChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: cpuData.labels,
        datasets: [{ label: 'CPU Load Avg (1m)', data: cpuData.usage, backgroundColor: '#1ee3ff' } ]
      },
      options: {responsive:false, plugins:{legend:{labels:{color:'#f5f5f5'}}}, scales:{x:{ticks:{color:'#f5f5f5'}}, y:{ticks:{color:'#f5f5f5'}}}}
    });
  }

  async function fetchAndDisplay() {
    // Network
    try {
      const data = await get('/api/netstats');
      const pre = document.getElementById('netstats');
      if (pre) pre.textContent = JSON.stringify(data, null, 2);
      const iface = Object.keys(data || {}).find(i => !i.startsWith('lo')) || Object.keys(data || {})[0];
      if (iface && data[iface]) {
        const sent = data[iface].bytes_sent, recv = data[iface].bytes_recv;
        if (netData.labels.length > 20) { netData.labels.shift(); netData.sent.shift(); netData.recv.shift(); }
        netData.labels.push(new Date().toLocaleTimeString());
        netData.sent.push(sent); netData.recv.push(recv);
        if (netChart) netChart.update();
      }
    } catch {
      const pre = document.getElementById('netstats');
      if (pre) pre.textContent = "❌ Could not load /api/netstats";
    }

    // Node health
    try {
      const d = await get('/api/nodehealth');
      const el = document.getElementById('nodehealth');
      if (el) {
        el.innerHTML = [
          `<b>Uptime:</b> ${((d.uptime||0)/3600).toFixed(1)}h`,
          `<b>Memory:</b> ${((d.freemem||0)/1048576).toFixed(1)} MB free / ${((d.totalmem||0)/1048576).toFixed(1)} MB total`,
          `<b>CPUs:</b> ${d.cpus || 'n/a'}`,
          `<b>Host:</b> ${d.hostname || 'n/a'} (${d.platform || '-'}/${d.arch || '-'})`,
          `<b>User:</b> ${d.user || 'n/a'}`
        ].join('<br>');
      }
      if (cpuData.labels.length > 20) { cpuData.labels.shift(); cpuData.usage.shift(); }
      cpuData.labels.push(new Date().toLocaleTimeString());
      cpuData.usage.push((d.loadavg && d.loadavg[0]) || 0);
      if (cpuChart) cpuChart.update();
    } catch {
      const el = document.getElementById('nodehealth');
      if (el) el.innerHTML = "<span class='err'>❌ Node.js API not available</span>";
    }

    // System stats
    try {
      const d = await get('/api/sysstats');
      const el = document.getElementById('pythonstats');
      if (el) {
        el.innerHTML = [
          `<b>CPU:</b> ${Array.isArray(d.cpu_percent) ? d.cpu_percent.join(', ') : (d.cpu_percent ?? 'n/a')}%`,
          `<b>Mem Used:</b> ${d.mem_used} MB / ${d.mem_total} MB`,
          `<b>Disk Used:</b> ${d.disk_used} GB / ${d.disk_total} GB`,
          `<b>Swap Used:</b> ${d.swap_used} MB / ${d.swap_total} MB`
        ].join('<br>');
      }
      const tempSpan = document.getElementById('cpuTemp');
      if (tempSpan) tempSpan.textContent = (d.cpu_temp != null) ? `${d.cpu_temp}°C` : 'N/A';
      const alertSpan = document.getElementById('tempAlert');
      if (alertSpan) {
        if (d.cpu_temp && d.cpu_temp > 85) {
          cpuOverheat = true;
          alertSpan.innerHTML = "🔥 <span class='err'>WARNING: CPU Overheating!</span>";
          stopBenchmark();
        } else {
          cpuOverheat = false;
          alertSpan.innerHTML = "";
        }
      }
    } catch {
      const el = document.getElementById('pythonstats');
      if (el) el.innerHTML = "<span class='err'>❌ /api/sysstats not available</span>";
      const tempSpan = document.getElementById('cpuTemp');
      if (tempSpan) tempSpan.textContent = 'N/A';
    }

    // Top processes
    try {
      const procs = await get('/api/procs');
      const s = (procs || []).map(p => `${p.name} (${p.pid}) CPU:${p.cpu_percent}% MEM:${p.mem_mb}MB`).join("\n");
      const pre = document.getElementById('topProcs');
      if (pre) pre.textContent = s || 'No data';
    } catch {
      const pre = document.getElementById('topProcs');
      if (pre) pre.textContent = '❌';
    }

    // Docker
    try {
      const d = await get('/api/docker');
      const pre = document.getElementById('dockerstats');
      if (pre) pre.textContent = (Array.isArray(d) && d.length) ? JSON.stringify(d, null, 2) : "No running containers";
    } catch {
      const pre = document.getElementById('dockerstats');
      if (pre) pre.textContent = "❌ /api/docker not available";
    }
  }

  window.startBenchmark = () => {
    if (cpuOverheat) { alert("CPU too hot! Aborting benchmark."); return; }
    fetch(`${API_BASE}/api/benchmark`, {method: "POST"})
      .then(r => r.json())
      .then(data => {
        if (data.status === "started") alert("Benchmark started! Watch your stats!");
        else if (data.status === "already running") alert("Benchmark is already running.");
      })
      .catch(()=>alert("Benchmark endpoint not available."));
  };

  window.stopBenchmark = () => {
    fetch(`${API_BASE}/api/benchmark/stop`, {method: "POST"})
      .then(r=>r.json()).then(data=>{
        if (data.status === "terminated") alert("Benchmark stopped.");
      }).catch(()=>{});
  };

  window.addEventListener('load', () => {
    makeNetChart(); makeCPUChart(); fetchAndDisplay();
    setInterval(fetchAndDisplay, 2000);
  });
})();

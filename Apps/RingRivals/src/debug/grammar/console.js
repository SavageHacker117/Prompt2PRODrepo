// Tiny backtick console + command grammar + Hit Lab toggles
export function setupDebugConsole(ctx) {
  const root = document.createElement('div');
  root.id = 'devConsole';
  root.innerHTML = `
    <div class="dc-header">Dev Console <span class="dc-hint">(\` to toggle)</span></div>
    <div class="dc-output" id="dcOut"></div>
    <input class="dc-input" id="dcIn" placeholder="help · cam fight · follow player · fov 60 · arena gym · time 0.6 · overlay on · hitlab on · cpos · clook · reset" />
  `;
  document.body.appendChild(root);

  const out = root.querySelector('#dcOut');
  const input = root.querySelector('#dcIn');
  let visible = false; root.style.display = 'none';

  const log = (m)=>{ const d=document.createElement('div'); d.textContent=m; out.appendChild(d); out.scrollTop=out.scrollHeight; };

  const commands = {
    help() {
      return [
        'help',
        'cam [sweep|corners|fight]',
        'follow [player|cpu|none]',
        'fov <30..90>',
        'arena [stadium|gym|cyber]',
        'time <0.1..1.5>',
        'hud [on|off]',
        'reset',
        'probe [on|off|toggle]',
        'overlay [on|off|toggle]  (hitbox debug)',
        'hitlab [on|off|toggle|clear]',
        'lights [up|down]',
        'sep',
        'ko [player|cpu]',
        'where',
        'cpos [x y z]  (print if no args)',
        'clook [x y z] (lookAt; print if no args)',
        'cam.get'
      ].join('  ·  ');
    },

    cam([mode]) {
      const m = (mode || '').toLowerCase();
      if (m === 'fight') ctx.camCtrl?.setFightMode?.();
      else if (m === 'corners') ctx.camCtrl?.focusCorners?.();
      else ctx.camCtrl?.crowdSweep?.();
      return `camera: ${m || 'sweep'}`;
    },

    follow([who]) {
      const w = (who || '').toLowerCase();
      const t = w === 'cpu' ? ctx.cpu : w === 'player' ? ctx.player : null;
      ctx.camCtrl?.lockTo?.(t);
      return `follow: ${w || 'none'}`;
    },

    fov([v]) {
      const n = Math.max(30, Math.min(90, Number(v) || 55));
      ctx.camera.fov = n; ctx.camera.updateProjectionMatrix();
      return `fov=${n}`;
    },

    arena([name]) {
      const a = (name || 'stadium').toLowerCase();
      ctx.ring?.setArena?.(a);
      return `arena=${a}`;
    },

    time([s]) {
      window.__timescale = Math.max(0.1, Math.min(1.5, Number(s) || 1));
      return `time=${window.__timescale}`;
    },

    hud([flag]) {
      const on = (flag ?? 'on').toLowerCase() !== 'off';
      const hud = document.getElementById('hud'); if (hud) hud.style.display = on ? 'block' : 'none';
      return `hud=${on?'on':'off'}`;
    },

    reset() {
      ctx.fight?.startBout?.();
      ctx.camCtrl?.lockTo?.(ctx.player);
      ctx.tools.hitLab?.clear?.();
      return 'reset: bout restarted';
    },

    probe([flag]) {
      const f = (flag ?? 'toggle').toLowerCase();
      if (f === 'on') ctx.tools.camProbe.enable();
      else if (f === 'off') ctx.tools.camProbe.disable();
      else ctx.tools.camProbe.toggle();
      return `probe=${f}`;
    },

    overlay([flag]) {
      const f = (flag ?? 'toggle').toLowerCase();
      if (f === 'on') ctx.tools.overlay.set(true);
      else if (f === 'off') ctx.tools.overlay.set(false);
      else ctx.tools.overlay.toggle();
      return `overlay=${f}`;
    },

    hitlab([flag]) {
      const f = (flag ?? 'toggle').toLowerCase();
      if (f === 'clear') { ctx.tools.hitLab?.clear?.(); return 'hitlab cleared'; }
      if (f === 'on') ctx.tools.hitLab?.show?.(true);
      else if (f === 'off') ctx.tools.hitLab?.show?.(false);
      else ctx.tools.hitLab?.toggle?.();
      return `hitlab=${f}`;
    },

    lights([dir]) {
      const d = (dir || 'up').toLowerCase();
      d === 'up' ? ctx.tools.sdebug.brighten() : ctx.tools.sdebug.dim();
      return `lights=${d}`;
    },

    sep()   { ctx.tools.fighters.separateOnce(); return 'separated'; },
    where() {
      const ap = ctx.player?.root?.position, bp = ctx.cpu?.root?.position;
      return `player (${ap?.x?.toFixed(2)}, ${ap?.z?.toFixed(2)}) · cpu (${bp?.x?.toFixed(2)}, ${bp?.z?.toFixed(2)})`;
    },

    ko([who]) {
      const w = (who || 'cpu').toLowerCase();
      const t = w === 'player' ? ctx.player : ctx.cpu;
      if (t) t.health = 0;
      return `ko ${w}`;
    },

    // camera pose helpers
    'cpos': (args)=>{
      if (!args.length){
        const p = ctx.camera.position;
        return `cpos = ${p.x.toFixed(2)} ${p.y.toFixed(2)} ${p.z.toFixed(2)}`;
      }
      const [x,y,z] = args.map(Number);
      if ([x,y,z].every(Number.isFinite)) ctx.camera.position.set(x,y,z);
      ctx.camera.updateProjectionMatrix();
      return commands.cpos([]);
    },
    'clook': (args)=>{
      if (!args.length){ return 'clook = (use clook x y z)'; }
      const [x,y,z] = args.map(Number);
      if ([x,y,z].every(Number.isFinite)) ctx.camera.lookAt(x,y,z);
      return `clook -> ${x} ${y} ${z}`;
    },
    'cam.get': ()=>{
      const p = ctx.camera.position;
      return `cam.pos ${p.x.toFixed(3)} ${p.y.toFixed(3)} ${p.z.toFixed(3)}`;
    }
  };

  const history=[]; let hi=-1;

  const run = (line)=>{
    const [cmd, ...args] = line.trim().split(/\s+/);
    const fn = commands[cmd];
    if (!fn) { log(`? unknown: ${cmd}`); return; }
    try { const r = fn(args); if (r!==undefined) log(String(r)); } catch(e){ log('! '+(e?.message||e)); }
  };

  addEventListener('keydown', (e)=>{
    if (e.key==='`' && !e.metaKey && !e.ctrlKey) {
      visible = !visible; root.style.display = visible?'block':'none'; if (visible) input.focus(); e.preventDefault();
    }
    if (!visible) return;
    if (e.key==='Enter')     { history.push(input.value); hi=history.length; run(input.value); input.value=''; }
    if (e.key==='Escape')    { visible=false; root.style.display='none'; }
    if (e.key==='ArrowUp')   { hi=Math.max(0,hi-1); input.value = history[hi] ?? ''; e.preventDefault(); }
    if (e.key==='ArrowDown') { hi=Math.min(history.length,hi+1); input.value = history[hi] ?? ''; e.preventDefault(); }
  });

  return { log, expose:(k,v)=>ctx[k]=v };
}

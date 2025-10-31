// Debug/ops verbs the console can call.
// NOTE: expects window.__s2w = { worldGen, materials, cameraController, dayNite, weather }

function ctx() {
  const c = (typeof window !== 'undefined' && window.__s2w) ? window.__s2w : null;
  if (!c || !c.worldGen) throw new Error('SPLATS2: window.__s2w missing (worldGen/materials not registered).');
  return c;
}

const api = {
  help() {
    return [
      'help                          – this help',
      'seed <text>                   – regenerate world from grammar or fallback',
      'lod <low|med|high>            – splat LOD tier',
      'rose.bake                     – bake /assets/modelsGLB/rose.glb → rose.splats.json',
      'rose.spawn                    – placeholder (loader not wired yet)',
      'weather <clear|rain|snow>     – toggle weather (if available)',
      'time <HH:MM|hours>            – set day-night clock (if available)',
      'ui <on|off>                   – toggle UI root (#ui-root)',
      'prof                          – toggle simple FPS overlay'
    ].join('\n');
  },

  // Tries grammar->spec->pipeline; falls back to worldGen.seedFromPrompt
  async seed(text) {
    const c = ctx();
    const prompt = String(text || '');

    // Try grammar parse (optional)
    let spec = null;
    try {
      const mod = await import('./userPromptsLang.js');
      const parsePrompt = mod.parsePrompt ?? mod.default;
      if (typeof parsePrompt === 'function') spec = parsePrompt(prompt);
    } catch (e) {
      console.warn('[seed] grammar not available:', e?.message ?? e);
    }

    if (spec) {
      try {
        const { buildPipelineField } = await import('../terrain/pipeline/TerrainPipeline.js');
        const field = buildPipelineField(c.worldGen.seed, spec, null);
        c.worldGen.splatField = field;
        c.worldGen.invalidateAll();
        return 'World reseeded from parsed spec.';
      } catch (e) {
        console.warn('[seed] pipeline path failed, falling back:', e?.message ?? e);
      }
    }

    // Fallback path
    await c.worldGen.seedFromPrompt(prompt);
    return 'World reseeded (fallback).';
  },

  async lod(level) {
    const c = ctx();
    const map = {
      low: 'low', lo: 'low', l: 'low',
      med: 'medium', mid: 'medium', m: 'medium',
      hi: 'high', high: 'high', h: 'high'
    };
    const target = map[String(level || 'med').toLowerCase()] || 'medium';
    if (typeof c.materials.setSplatQuality === 'function') {
      c.materials.setSplatQuality(target);
    } else {
      c.materials.splatQuality = target;
      if (typeof c.materials.rebuild === 'function') c.materials.rebuild();
    }
    return `LOD set to ${target}`;
  },

  async ['rose.bake']() {
    try {
      const { bakeGLBToSplatsJSON } = await import('../splats/SplatBaker.js');
      const url = '/assets/modelsGLB/rose.glb';
      const out = await bakeGLBToSplatsJSON(url, { samplesPerTri: 6, radius: 0.008 });
      const blob = new Blob([JSON.stringify(out)], { type: 'application/json' });
      const a = Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(blob),
        download: 'rose.splats.json'
      });
      document.body.appendChild(a); a.click(); a.remove();
      return `Baked ${out.points?.length ?? 0} splats → rose.splats.json`;
    } catch (e) {
      console.error('[rose.bake] failed:', e);
      return 'rose.bake: SplatBaker not available or bake failed.';
    }
  },

  async ['rose.spawn']() {
    return 'rose.spawn: loader not wired yet (add a JSON splat loader and call it here).';
  },

  async weather(kind) {
    try {
      const mod = await import('../atmosphere/weather.js');
      if (typeof mod.setWeather === 'function') { mod.setWeather(kind || 'clear'); return `weather=${kind}`; }
    } catch {}
    const c = window.__s2w;
    if (c && c.weather && typeof c.weather.set === 'function') { c.weather.set(kind || 'clear'); return `weather=${kind}`; }
    return 'weather: no weather system available.';
  },

  async time(hhmm) {
    const c = ctx();
    let hours = 12;
    if (/^\d+(\.\d+)?$/.test(hhmm)) hours = parseFloat(hhmm);
    else if (/^\d{1,2}:\d{2}$/.test(hhmm)) { const [H, M] = hhmm.split(':').map(Number); hours = H + (M/60); }

    try {
      const mod = await import('../atmosphere/dayNnite.js');
      const setter = mod.setClock || mod.setTime;
      if (typeof setter === 'function') { setter(hours); return `time=${hours.toFixed(2)}h`; }
    } catch {}
    if (c.dayNite && typeof c.dayNite.setTime === 'function') { c.dayNite.setTime(hours); return `time=${hours.toFixed(2)}h`; }
    return 'time: no day/night controller available.';
  },

  ui(flag) {
    const root = document.querySelector('#ui-root');
    if (!root) return 'ui: #ui-root not found.';
    root.style.display = (/off/i.test(flag)) ? 'none' : '';
    return `ui=${/off/i.test(flag) ? 'off' : 'on'}`;
  },

  prof() {
    let node = document.querySelector('#fps');
    if (!node) {
      node = document.createElement('div');
      node.id = 'fps';
      Object.assign(node.style, { position: 'fixed', left: '8px', bottom: '8px', color: '#0f0', font: '12px monospace', opacity: .9, zIndex: 1e6 });
      document.body.appendChild(node);
      let last = performance.now(), frames = 0;
      const loop = (t) => { frames++; if (t - last > 500) { node.textContent = `${Math.round(frames * 1000 / (t - last))} fps`; frames = 0; last = t; } requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
      return 'prof on';
    } else {
      node.remove();
      return 'prof off';
    }
  }
};

// ---- command runner ---------------------------------------------------------

function resolveKey(name) {
  const lower = name.toLowerCase();
  return Object.keys(api).find(k => k.toLowerCase() === lower) || null;
}

export async function runCommand(line) {
  const raw = (line || '').trim();
  if (!raw) return '';

  // Support exact dotted command (e.g., "rose.bake")
  if (api[raw]) {
    const h = api[raw];
    return (typeof h === 'function') ? h() : (typeof h.run === 'function' ? h.run() : '');
  }

  const [cmd, ...rest] = raw.split(/\s+/);
  const key = resolveKey(cmd);
  if (!key) return `Unknown: ${cmd}. Try 'help'.`;
  return api[key](rest.join(' ')); // returns string or Promise<string>
}

export default { runCommand };

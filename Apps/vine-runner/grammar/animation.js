// grammar/animation.js
import * as THREE from 'three';

export function registerAnimationGrammar(dbg, engine, _levels, extras = {}) {
  // Avoid duplicate registration if your DebugConsole tracks commands
  try {
    if (dbg.commands && typeof dbg.commands.has === 'function' && dbg.commands.has('anim')) {
      return;
    }
  } catch (_) {}

  const getPanel = () => extras.animPanel || window.__animPanel || null;

  const listFromPlayer = () => {
    const p = engine?.player;
    if (!p) return [];
    const names = new Set();

    // Prefer actions, keeps friendly clip names
    if (p.actions && typeof p.actions === 'object') {
      for (const k of Object.keys(p.actions)) {
        const a = p.actions[k];
        if (a && typeof a.getClip === 'function') {
          names.add(a.getClip().name || k);
        } else {
          names.add(k);
        }
      }
    }
    return [...names];
  };

  dbg.extend(
    'anim',
    (args) => {
      const panel = getPanel();
      const sub = (args[0] || '').toLowerCase();

      if (!sub || sub === 'help') {
        return [
          'anim toggle             — show/hide panel',
          'anim list               — list available clips',
          'anim play <name>        — play (immediate)',
          'anim fade <name> [t]    — crossfade to clip over t seconds (default 0.25)',
          'anim stop [name]        — stop current or named clip',
          'anim speed <v>          — set mixer speed (timeScale 0..3)',
          'anim weight <v>         — set selected action weight (0..1)',
          'anim loop <on|off>      — set selected action looping',
          'anim current            — show current selected clip'
        ];
      }

      if (!panel) return 'Animation panel not ready';

      if (sub === 'toggle') { panel.toggle(); return 'anim panel toggled'; }
      if (sub === 'list')   {
        const l = typeof panel.list === 'function' ? panel.list() : listFromPlayer();
        return l.length ? l : '(no clips)';
      }

      if (sub === 'play') {
        const name = args.slice(1).join(' ');
        if (!name) return 'usage: anim play <name>';
        return panel.play(name) ? `playing ${name}` : 'clip not found';
      }

      if (sub === 'fade') {
        if (args.length < 2) return 'usage: anim fade <name> [duration]';
        // last arg might be duration; detect & split cleanly
        const last = args[args.length - 1];
        const dur  = Number(last);
        const name = isFinite(dur) ? args.slice(1, -1).join(' ') : args.slice(1).join(' ');
        const t    = isFinite(dur) ? Math.max(0, dur) : 0.25;
        if (!name) return 'usage: anim fade <name> [duration]';
        return panel.fadeTo(name, t) ? `fading to ${name} (${t.toFixed(2)}s)` : 'clip not found';
      }

      if (sub === 'stop') {
        const name = args.slice(1).join(' ') || undefined;
        return panel.stop(name) ? 'stopped' : 'nothing to stop';
      }

      if (sub === 'speed') {
        const v = Number(args[1]);
        if (!isFinite(v)) return 'usage: anim speed <0..3>';
        const s = Math.max(0, Math.min(3, v));
        if (engine.player?.mixer) engine.player.mixer.timeScale = s;
        return `speed ${engine.player?.mixer?.timeScale ?? s}`;
      }

      if (sub === 'weight') {
        const v = Number(args[1]);
        if (!isFinite(v)) return 'usage: anim weight <0..1>';
        const w = Math.max(0, Math.min(1, v));
        const a = panel._getSelectedAction?.();
        if (!a) return 'no selected action';
        a.enabled = true;
        a.setEffectiveWeight(w);
        return `weight ${w.toFixed(2)}`;
      }

      if (sub === 'loop') {
        const on = (args[1] || 'on').toLowerCase() !== 'off';
        const a = panel._getSelectedAction?.();
        if (!a) return 'no selected action';
        a.setLoop(on ? THREE.LoopRepeat : THREE.LoopOnce, on ? Infinity : 1);
        a.clampWhenFinished = !on;
        return `loop ${on ? 'on' : 'off'}`;
      }

      if (sub === 'current') {
        const a = panel._getSelectedAction?.();
        return a?.getClip?.().name || '(none selected)';
      }

      return 'Unknown anim subcommand (try "anim help")';
    },
    'Animation tooling commands (type "anim help").'
  );
}

// grammar/puppet.js
export function registerPuppetGrammar(dbg, _engine, _levels, extras = {}) {
  // Prefer explicit extras, fall back to globals set by main
  const host  = extras.scriptHost  || window.motion?.runtime  || window.__scriptHost;
  const panel = extras.puppetPanel || window.motion?.panel    || window.__puppetPanel;
  if (!host) return;

  const handler = (args) => {
    const sub = (args[0] || '').toLowerCase();

    if (!sub || sub === 'help') {
      return [
        'scripts ui / toggle        — show/hide Scripts panel',
        'scripts list               — list scripts',
        'scripts scan               — scan for skeleton/bones',
        'scripts bones [filter]     — list bones (optional filter)',
        'scripts start <name>       — play a script',
        'scripts stop [name|all]    — stop a named script or all',
        'scripts new <name>         — create a new empty script',
        'scripts del <name>         — delete a script',
        'scripts rename <old> <new> — rename a script',
        'scripts suggest            — suggest a good bone for “wave”',
        'scripts dock [on|off]      — dock/undock Anim panel (if supported)',
      ];
    }

    if (sub === 'ui' || sub === 'toggle') { panel?.toggle?.(); return 'scripts panel toggled'; }
    if (sub === 'list')   { return host.list().join('\n') || '(none)'; }
    if (sub === 'scan')   { const r = host.scanForSkeleton(); return r.ok ? `bones: ${r.count}` : 'no skeleton'; }

    if (sub === 'bones')  {
      if (!host.skeleton) host.scanForSkeleton();
      const filter = (args.slice(1).join(' ') || '').toLowerCase();
      const names = Array.from(host.boneMap?.keys?.() || []);
      const out = names.filter(n => !filter || n.toLowerCase().includes(filter));
      return out.length ? out.join('\n') : '(no bones)';
    }

    if (sub === 'start')  {
      const n = args.slice(1).join(' ');
      if (!n) return 'usage: scripts start <name>';
      return host.start(n) ? `started ${n}` : 'no such script';
    }

    if (sub === 'stop')   {
      const n = (args.slice(1).join(' ') || '').toLowerCase();
      if (!n || n === 'all') { host.clear?.(); return 'stopped all'; }
      host.stop(n);
      return `stopped ${n}`;
    }

    if (sub === 'new') {
      const n = args.slice(1).join(' ');
      if (!n) return 'usage: scripts new <name>';
      host.add(n, { name:n, target:'', loop:true, mode:'offset',
        frames:[{t:0,rot:[0,0,0]},{t:1,rot:[0,0,0]}] });
      host.saveToStorage?.();
      return `created ${n}`;
    }

    if (sub === 'del' || sub === 'delete') {
      const n = args.slice(1).join(' ');
      if (!n) return 'usage: scripts del <name>';
      host.remove(n);
      return `deleted ${n}`;
    }

    if (sub === 'rename') {
      const [o, n] = [args[1], args[2]];
      if (!o || !n) return 'usage: scripts rename <old> <new>';
      return host.rename(o, n) ? `renamed to ${n}` : 'rename failed';
    }

    if (sub === 'suggest') {
      const b = host.suggestBone?.('wave');
      return b || '(no suggestion available)';
    }

    if (sub === 'dock') {
      const v = (args[1] || '').toLowerCase();
      if (panel?._dockAnim) { panel._dockAnim(v ? v === 'on' : undefined); return 'dock toggled'; }
      return '(dock not supported by current UI)';
    }

    return 'Unknown "scripts" subcommand (try "scripts help")';
  };

  dbg.extend('scripts', handler, 'Motion scripts runtime (type "scripts help").');
  dbg.extend('script',  handler, 'Motion scripts runtime (type "scripts help").');
}

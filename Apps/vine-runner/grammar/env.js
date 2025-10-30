// grammar/env.js
export function registerEnvGrammar(dbg, _engine, _levels, extras = {}) {
  const host = extras.scriptHost || window.motion?.runtime || window.__scriptHost;
  if (!host) return;

  dbg.extend('env', (args) => {
    const sub = (args[0]||'').toLowerCase();

    if (!sub || sub==='help') {
      return [
        'env list                 — list running env programs',
        'env run <name>           — run env program from panel storage',
        'env stop [name|all]      — stop one or all',
      ];
    }

    if (sub==='list')   return host.listEnv().join('\n') || '(none)';
    if (sub==='stop')  { host.stopEnv(args[1] || null); return 'stopped.'; }
    if (sub==='run')   {
      const name = args[1]; if(!name) return 'usage: env run <name>';
      // Panel stores code/params in localStorage under envScripts.v1
      const all = JSON.parse(localStorage.getItem('envScripts.v1') || '{}');
      const rec = all[name];
      if (!rec) return 'no such env program';
      return host.runEnv(name, rec.code, rec.params).then(()=>`ran ${name}`).catch(e=>e.message);
    }

    return 'Unknown env subcommand (try "env help")';
  }, 'Procedural environment commands (type "env help").');
}

// Minimal in-game console (toggle with backtick ` )
import { runCommand } from './debugCmds.js';

export function attachDevConsole(){
  const wrap = document.createElement('div');
  wrap.id = 'dev-console';
  Object.assign(wrap.style, {
    position:'fixed', left:'12px', top:'12px', width:'520px',
    background:'rgba(10,12,16,.85)', color:'#dbe4ff', padding:'10px',
    borderRadius:'10px', boxShadow:'0 10px 30px rgba(0,0,0,.4)',
    display:'none', zIndex:99999, backdropFilter:'blur(4px)'
  });

  wrap.innerHTML = `
    <div style="font:600 12px/1.2 Inter,system-ui">SPLATS 2 DEV CONSOLE</div>
    <pre id="dc-out" style="max-height:200px;overflow:auto;margin:6px 0 8px;font:12px/1.4 ui-monospace"></pre>
    <input id="dc-in" placeholder="type 'help'…" style="width:100%;background:#0b1220;color:#cbd5e1;border:1px solid #1f2a44;border-radius:8px;padding:8px 10px;font:12px ui-monospace" />
  `;
  document.body.appendChild(wrap);

  const out = wrap.querySelector('#dc-out');
  const input = wrap.querySelector('#dc-in');

  function print(s){ out.textContent = (String(s)+'\n'+out.textContent).slice(0,8000); }

  input.addEventListener('keydown', async (e)=>{
    if(e.key!=='Enter') return;
    const line = input.value; input.value='';
    print('> '+line);
    try{
      const res = await runCommand(line);
      print(res ?? '');
    }catch(err){ print('ERR: '+(err?.message ?? err)); }
  });

  // Toggle with backtick `
  window.addEventListener('keydown', (e)=>{
    if(e.key === '`'){
      wrap.style.display = (wrap.style.display==='none')?'block':'none';
      if (wrap.style.display === 'block') input.focus();
      e.preventDefault();
    }
  });

  // initial hint
  setTimeout(()=>print("Try: help | seed mountains with 2 rivers, west coast | lod high | rose.bake"), 200);
}

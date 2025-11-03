// debug/hitDebugger.js
import * as THREE from 'three';

export class HitDebugger {
  constructor({ scene }) {
    this.scene = scene;
    this.enabled = true;

    // running totals
    this.stats = {
      player: { hits: 0, xp: 0 },
      cpu:    { hits: 0, xp: 0 },
    };

    // very small rules engine: each rule returns {ok, dmgMul, xp}
    // evaluated in order; first rule with ok=true is applied.
    this.rules = [
      // blocked = no damage, tiny XP for the attacker for "touch"
      (hit) => hit.blocked ? { ok:true, dmgMul:0.0, xp:1 } : { ok:false },
      // head gets a bonus
      (hit) => hit.contact === 'head'
        ? { ok:true, dmgMul:1.25, xp:6 }
        : { ok:false },
      // body default
      (hit) => ({ ok:true, dmgMul:1.0, xp:4 }),
    ];

    this._buildPanel();
  }

  // ------- UI --------
  _buildPanel() {
    const css = `
      .hitlab { position:fixed; bottom:12px; right:12px; width:420px; height:240px;
                background:#0b0f17e6; border:1px solid #1f2734; border-radius:10px; color:#cfe3ff;
                font:12px/1.4 ui-monospace,Consolas,monospace; display:flex; overflow:hidden; z-index:99999; }
      .hitlab.hidden{ display:none; }
      .hitlab .col { flex:1; display:flex; flex-direction:column; }
      .hitlab .title { padding:8px 10px; background:#121826; border-bottom:1px solid #1f2734; font-weight:700; }
      .hitlab .list { flex:1; overflow:auto; padding:8px 10px; }
      .hitlab .row { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .hitlab .rules small { opacity:.8 }
      .hitlab .footer { padding:6px 10px; border-top:1px solid #1f2734; display:flex; gap:10px; }
      .hitlab button { background:#1b2434; color:#d6e4ff; border:1px solid #2a3550; border-radius:6px; padding:4px 8px; cursor:pointer; }
      .hitlab .stat { margin-left:auto; }
    `;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    const root = document.createElement('div');
    root.className = 'hitlab';
    root.innerHTML = `
      <div class="col">
        <div class="title">Hit Log</div>
        <div class="list" id="hl-log"></div>
        <div class="footer">
          <button id="hl-clear">clear</button>
          <span class="stat" id="hl-stat"></span>
        </div>
      </div>
      <div class="col rules">
        <div class="title">Rules</div>
        <div class="list" id="hl-rules"></div>
        <div class="footer">
          <button id="hl-addRule">add body</button>
          <button id="hl-addRuleH">add head</button>
          <button id="hl-toggle">hide</button>
        </div>
      </div>
    `;
    document.body.appendChild(root);
    this.dom = { root, log: root.querySelector('#hl-log'), rules: root.querySelector('#hl-rules'), stat: root.querySelector('#hl-stat') };

    root.querySelector('#hl-clear').onclick = () => { this.dom.log.innerHTML=''; };
    root.querySelector('#hl-toggle').onclick  = () => this.toggle();
    root.querySelector('#hl-addRule').onclick = () => {
      // example extra rule: body bonus
      this.rules.unshift((h)=> h.contact==='body' ? ({ok:true,dmgMul:1.15, xp:5}) : ({ok:false}));
      this._renderRules();
    };
    root.querySelector('#hl-addRuleH').onclick = () => {
      // example extra rule: hard headshot
      this.rules.unshift((h)=> h.contact==='head' ? ({ok:true,dmgMul:1.5, xp:8}) : ({ok:false}));
      this._renderRules();
    };

    this._renderRules();
    this._renderStats();
  }

  _renderRules(){
    const rows = this.rules.map((fn,i)=>`<div class="row"><small>#${i+1}</small> custom rule</div>`);
    this.dom.rules.innerHTML = rows.join('') || '<div class="row">no rules</div>';
  }
  _renderStats(){
    const s=this.stats;
    this.dom.stat.textContent = `P: ${s.player.hits} hits · ${s.player.xp} xp   |   CPU: ${s.cpu.hits} hits · ${s.cpu.xp} xp`;
  }

  toggle(flag){
    if (flag===undefined) this.enabled=!this.enabled; else this.enabled=!!flag;
    this.dom.root.classList.toggle('hidden', !this.enabled);
    return this.enabled;
  }

  // ------- external API --------
  listRules(){ return this.rules.length; }
  clearRules(){ this.rules.length = 0; this._renderRules(); }
  addRule(fn){ this.rules.unshift(fn); this._renderRules(); }

  // called by the game when a contact is detected
  onHit(hit){
    // hit = {attacker, defender, attackerName, defenderName, side, contact, blocked, base, powerBeforeRules, time}
    // evaluate rules
    let applied = { ok:true, dmgMul:1.0, xp:4 };
    for (const r of this.rules){
      const res = r(hit);
      if (res && res.ok){ applied = res; break; }
    }
    const finalDmg = Math.max(0, hit.base * applied.dmgMul);

    // book-keeping: HP/XP changes (HP was already applied by caller if !blocked)
    const who = hit.attacker.isPlayer ? 'player' : 'cpu';
    this.stats[who].hits++;
    this.stats[who].xp += applied.xp|0;
    this._renderStats();

    // UI line
    const row = document.createElement('div');
    row.className = 'row';
    row.textContent =
      `${(hit.time/1000).toFixed(2)}s ${hit.attackerName} ${hit.side} -> ${hit.defenderName} ${hit.contact}` +
      (hit.blocked ? '  [BLOCKED]' : `  [${finalDmg.toFixed(1)} dmg]`) +
      `  +${applied.xp|0}xp`;
    this.dom.log.appendChild(row);
    this.dom.log.scrollTop = this.dom.log.scrollHeight;
  }
}

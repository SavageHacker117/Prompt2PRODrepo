// src/ui/PlayerID.js
export class PlayerID {
  constructor({ playerName='Player', cpuName='CPU', progress }){
    this.progress = progress;
    const root = document.createElement('div');
    root.className = 'playerIDs';
    root.innerHTML = `
      <div class="playerCard left" id="pidL">
        <div class="name" id="pidL_name">${playerName}</div>
        <div class="row"><div class="level" id="pidL_lvl">Lv 1</div><div class="stat" id="pidL_stat"></div></div>
        <div class="badges" id="pidL_badges"></div>
      </div>
      <div class="playerCard right" id="pidR">
        <div class="name" id="pidR_name">${cpuName}</div>
        <div class="row"><div class="stat" id="pidR_stat"></div><div class="level" id="pidR_lvl">Lv 1</div></div>
        <div class="badges" id="pidR_badges"></div>
      </div>
    `;
    document.body.appendChild(root);
    this.dom = {
      L_name: document.getElementById('pidL_name'),
      L_lvl: document.getElementById('pidL_lvl'),
      L_stat: document.getElementById('pidL_stat'),
      L_badges: document.getElementById('pidL_badges'),
      R_name: document.getElementById('pidR_name'),
      R_lvl: document.getElementById('pidR_lvl'),
      R_stat: document.getElementById('pidR_stat'),
      R_badges: document.getElementById('pidR_badges'),
    };
  }

  _renderBadges(el, buffs=[]){
    el.innerHTML = '';
    const map = { SPEED:'S', DAMAGE:'D', GUARD:'G', STAM:'E' };
    buffs.slice(0,6).forEach(b=>{
      const d = document.createElement('div'); d.className='badge'; d.textContent = map[b] ?? '?'; el.appendChild(d);
    });
  }

  update({ playerName='Player', cpuName='CPU', playerBuffs=[], cpuBuffs=[] }={}){
    const P = this.progress.get(playerName), C = this.progress.get(cpuName);
    this.dom.L_name.textContent = playerName;
    this.dom.R_name.textContent = cpuName;
    this.dom.L_lvl.textContent  = `Lv ${P.lvl}`;
    this.dom.R_lvl.textContent  = `Lv ${C.lvl}`;
    this.dom.L_stat.textContent = `${P.hits} hits • ${P.kos} KO • ${P.rounds} rnds`;
    this.dom.R_stat.textContent = `${C.hits} hits • ${C.kos} KO • ${C.rounds} rnds`;
    this._renderBadges(this.dom.L_badges, playerBuffs);
    this._renderBadges(this.dom.R_badges, cpuBuffs);
  }
}

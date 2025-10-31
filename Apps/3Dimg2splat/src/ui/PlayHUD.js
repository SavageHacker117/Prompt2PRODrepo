// src/ui/PlayHUD.js
export class PlayHUD {
  constructor() {
    this.root = document.createElement('div');
    this.root.id = 'hud';
    this.root.className = 'hud';
    this.root.innerHTML = `
      <span>Mode: <b id="hudMode">Edit</b></span>
      <span class="hud-health">
        HP <span class="hp-bar"><span class="hp-fill" id="hpFill" style="width:100%"></span></span>
      </span>
      <span class="hud-pad">
        <span class="gp-led" id="gpLed"></span>
        <span class="gp-label" id="gpLbl">No pad</span>
      </span>
    `;
    document.body.appendChild(this.root);
  }
  show(){ this.root.classList.add('show'); }
  hide(){ this.root.classList.remove('show'); }
  setMode(m){ this.root.querySelector('#hudMode').textContent = m; }
  setGamepadInfo(info){
    const led = this.root.querySelector('#gpLed');
    const lbl = this.root.querySelector('#gpLbl');
    led.classList.toggle('on', !!info?.connected);
    lbl.textContent = info?.connected ? (info.id || 'Controller') : 'No pad';
  }
}

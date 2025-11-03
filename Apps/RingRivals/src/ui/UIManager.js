export class UIManager {
  constructor() {
    this.hud = document.getElementById('hud');
    this.clockEl = document.getElementById('clock');
    this.pNameEl = document.getElementById('pName');
    this.oNameEl = document.getElementById('oName');

    // fancy bars
    this.pBar = document.getElementById('pBar');
    this.oBar = document.getElementById('oBar');
    this.pFill = document.getElementById('pFill');
    this.oFill = document.getElementById('oFill');
    this.pLoss = document.getElementById('pLoss');
    this.oLoss = document.getElementById('oLoss');
    this.pShield = document.getElementById('pShield');
    this.oShield = document.getElementById('oShield');
    this.pLabel = document.getElementById('pLabel');
    this.oLabel = document.getElementById('oLabel');

    this.centerIntro = document.getElementById('centerIntro');
    this.roundInfo = document.getElementById('roundInfo');

    this.menu = document.getElementById('mainMenu');
    this.startBtn = document.getElementById('startBtn');
    this._arena = 'stadium';

    this.menu.classList.add('active');
    this.menu.querySelectorAll('[data-arena]').forEach(el=>{
      el.addEventListener('click', ()=> { this._arena = el.getAttribute('data-arena'); });
    });

    // trailing damage memory
    this._pLossV = 1; this._oLossV = 1;
    this._lastT = performance.now();
  }

  wireMenus({ start, pickArena }) {
    this.startBtn.addEventListener('click', ()=>{
      this.menu.classList.remove('active');
      pickArena?.(this._arena);
      start?.();
    });
  }

  setCenterText(t) {
    this.centerIntro.innerText = t || '';
    this.centerIntro.style.opacity = t ? 1 : 0;
  }

  showIntro(text) {
    this.centerIntro.innerText = text;
    this.centerIntro.style.opacity = 1;
    setTimeout(()=> this.centerIntro.style.opacity = 0, 2200);
  }
  flashIntro(text) { this.showIntro(text); }

  /** Update core HUD + HP bars (with delayed damage trail) */
  update({ pName, oName, clock, pHealth, oHealth, round }) {
    const now = performance.now();
    const dt = Math.max(0.001, (now - this._lastT) / 1000);
    this._lastT = now;

    // names/clock/round
    this.pNameEl.textContent = pName;    this.pLabel.textContent = pName?.toUpperCase() || 'PLAYER';
    this.oNameEl.textContent = oName;    this.oLabel.textContent = oName?.toUpperCase() || 'CPU';
    this.clockEl.textContent = clock;
    this.roundInfo.textContent = `Round ${round}`;

    const clamp01 = (v)=> Math.max(0, Math.min(1, v));
    const p = clamp01(pHealth ?? 1);
    const o = clamp01(oHealth ?? 1);

    // Immediate fill
    this.pFill.style.width = `${p*100}%`;
    this.oFill.style.width = `${o*100}%`;

    // Damage trail decays to current value
    if (this._pLossV < p) this._pLossV = p;
    if (this._oLossV < o) this._oLossV = o;
    const decay = 0.8;
    this._pLossV += (p - this._pLossV) * Math.min(1, dt / decay);
    this._oLossV += (o - this._oLossV) * Math.min(1, dt / decay);
    this.pLoss.style.width = `${this._pLossV*100}%`;
    this.oLoss.style.width = `${this._oLossV*100}%`;

    // low-health pulse
    this.pBar.classList.toggle('low', p < 0.25);
    this.oBar.classList.toggle('low', o < 0.25);
  }

  /** Optional visual for temporary shields */
  setShield({ player=0, cpu=0 } = {}) {
    const showP = Math.max(0, Math.min(1, player));
    const showO = Math.max(0, Math.min(1, cpu));
    this.pShield.style.width = `${showP*100}%`;
    this.pShield.style.opacity = showP > 0 ? .8 : 0;
    this.oShield.style.width = `${showO*100}%`;
    this.oShield.style.opacity = showO > 0 ? .8 : 0;
  }
}

// core/HUD.js
// Top HUD: Level / Score / HP bar + Gamepad indicator

export class HUD {
  constructor(rootEl) {
    this.root = rootEl;

    // Reuse existing spans if present, else create
    this.elLevel = document.getElementById('hudLevel') || this._mkSpan();
    this.elScore = document.getElementById('hudScore') || this._mkSpan();

    // HP
    this.healthWrap = document.getElementById('hudHealth') || this._mkSpan();
    this.healthWrap.id = 'hudHealth';
    this.healthWrap.classList.add('hud-health');

    const hpLabel = document.createElement('span');
    hpLabel.textContent = 'HP';

    this.hpBar = document.createElement('div');
    this.hpBar.className = 'hp-bar';

    this.hpFill = document.createElement('div');
    this.hpFill.className = 'hp-fill';
    this.hpBar.appendChild(this.hpFill);

    this.healthWrap.appendChild(hpLabel);
    this.healthWrap.appendChild(this.hpBar);

    // Gamepad indicator
    this.padWrap = document.getElementById('hudPad') || this._mkSpan();
    this.padWrap.id = 'hudPad';
    this.padWrap.className = 'hud-pad';

    this.padDot = document.createElement('span');
    this.padDot.className = 'pad-dot';

    this.padText = document.createElement('span');
    this.padText.className = 'pad-text';
    this.padText.textContent = 'No Pad';

    this.padWrap.appendChild(this.padDot);
    this.padWrap.appendChild(this.padText);

    // Ensure mounted
    if (!this.root.contains(this.elLevel)) this.root.appendChild(this.elLevel);
    if (!this.root.contains(this.elScore)) this.root.appendChild(this.elScore);
    if (!this.root.contains(this.healthWrap)) this.root.appendChild(this.healthWrap);
    if (!this.root.contains(this.padWrap)) this.root.appendChild(this.padWrap);
  }

  _mkSpan() {
    const s = document.createElement('span');
    return s;
  }

  setVisible(v) {
    this.root.classList.toggle('show', !!v);
  }

  update({ levelIndex, totalLevels, score, hpPct }) {
    if (typeof levelIndex === 'number' && typeof totalLevels === 'number') {
      this.elLevel.textContent = `Level ${levelIndex + 1}/${totalLevels}`;
    }
    if (typeof score === 'number') {
      this.elScore.textContent = `Score ${score}`;
    }
    if (typeof hpPct === 'number') {
      const pct = Math.max(0, Math.min(1, hpPct));
      this.hpFill.style.width = `${Math.round(pct * 100)}%`;

      // simple green->yellow->red ramp
      const r = pct < 0.5 ? 255 : Math.round(255 * (1 - (pct - 0.5) * 2));
      const g = pct > 0.5 ? 255 : Math.round(255 * (pct * 2));
      this.hpFill.style.background = `rgb(${r},${g},80)`;
    }
  }

  /** Update gamepad status dot + label */
  setPadStatus({ connected = false, index = null, name = '' } = {}) {
    const on = !!connected;
    this.padWrap.classList.toggle('on', on);
    this.padDot.classList.toggle('on', on);
    this.padText.textContent = on ? `Pad ${index ?? 0}` : 'No Pad';
    if (name) this.padText.title = name;
  }
}

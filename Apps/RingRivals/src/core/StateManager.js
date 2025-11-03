export class StateManager {
  constructor() {
    this._k = 'three-boxing-state-v1';
    this.state = this._load() || {
      wins: 0,
      losses: 0,
      settings: { postFX: true, crowdSize: 1.0, music: 0.7, sfx: 1.0 }
    };
  }
  _load() { try { return JSON.parse(localStorage.getItem(this._k)); } catch { return null; } }
  _save() { localStorage.setItem(this._k, JSON.stringify(this.state)); }
  setSetting(k, v) { this.state.settings[k] = v; this._save(); }
  record(win) { win ? this.state.wins++ : this.state.losses++; this._save(); }
}

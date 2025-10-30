// core/GameState.js
export class GameState {
  constructor() {
    this.maxHP = 100;
    this.hp = this.maxHP;

    this.invuln = 0;              // seconds of temporary invulnerability
    this.scoreTotal = 0;          // only increases on level complete
    this.levelScore = 0;          // per-level accumulation
  }

  resetForRun() {
    this.hp = this.maxHP;
    this.invuln = 0;
    this.scoreTotal = 0;
    this.levelScore = 0;
  }

  resetForLevel() {
    this.invuln = 0;
    this.levelScore = 0;
  }

  tick(dt) {
    if (this.invuln > 0) this.invuln -= dt;
  }

  damage(n = 10) {
    if (this.invuln > 0) return false; // ignored due to i-frames
    this.hp = Math.max(0, this.hp - n);
    this.invuln = 0.6;                 // brief i-frames after a hit
    return this.hp > 0;
  }

  heal(n = 10) {
    this.hp = Math.min(this.maxHP, this.hp + n);
  }

  setHP(n) {
    this.hp = Math.max(0, Math.min(this.maxHP, n));
  }

  hpPct() {
    return this.hp / this.maxHP;
  }
}

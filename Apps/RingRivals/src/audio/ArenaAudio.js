import * as THREE from 'three';

export class ArenaAudio {
  constructor(camera) {
    this.listener = new THREE.AudioListener();
    camera.add(this.listener);

    this.loader = new THREE.AudioLoader();
    this.base = new THREE.Audio(this.listener);
    this.cheer = new THREE.Audio(this.listener);
    this.boo   = new THREE.Audio(this.listener);
    this.pa    = new THREE.Audio(this.listener);
    this.bell  = new THREE.Audio(this.listener);

    this._intensity = 0;
  }

  async _tryLoad(url, audio) {
    return new Promise((resolve) => {
      this.loader.load(url, buffer => { audio.setBuffer(buffer); resolve(true); },
        undefined, () => resolve(false));
    });
  }

  async loadDefaultClips() {
    // Load placeholders if present; fail gracefully if missing
    const results = await Promise.all([
      this._tryLoad('/audio/crowd_base.mp3', this.base),
      this._tryLoad('/audio/crowd_cheer.mp3', this.cheer),
      this._tryLoad('/audio/crowd_boo.mp3', this.boo),
      this._tryLoad('/audio/pa_intro.mp3', this.pa),
      this._tryLoad('/audio/bell_ding.mp3', this.bell),
    ]);

    if (results[0]) { this.base.setLoop(true).setVolume(0.35).play(); }
    if (results[1]) { this.cheer.setLoop(true).setVolume(0.0).play(); }
    if (results[2]) { this.boo.setLoop(true).setVolume(0.0).play(); }
  }

  setIntensity(v) {
    this._intensity = Math.max(0, Math.min(1, v));
    if (this.cheer.buffer) this.cheer.setVolume(0.05 + 0.6*this._intensity);
    if (this.base.buffer) this.base.setVolume(0.25 + 0.25*this._intensity);
  }

  onIntro()  { if (this.pa.buffer) this.pa.setVolume(.8).play(); }
  onBell()   { if (this.bell.buffer) this.bell.setVolume(1).play(); }
  onBigHit() { if (this.cheer.buffer) this.cheer.setVolume(0.8).play(); }
  onKnockDown() { if (this.cheer.buffer) this.cheer.setVolume(1).play(); }
  onBoo() { if (this.boo.buffer) { this.boo.setVolume(0.8).play(); setTimeout(()=> this.boo.setVolume(0.0), 1200); } }
}

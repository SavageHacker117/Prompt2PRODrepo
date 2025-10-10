// src/game/anim.js
import * as THREE from 'three';

// --- Asset Monitor (simple) ---
export const AssetMonitor = {
  loaded: new Set(),
  failed: new Set(),
  listeners: new Set(),
  notify(){ this.listeners.forEach(fn=>fn()); }
};
const loadingMgr = new THREE.LoadingManager();
loadingMgr.onProgress = (url)=>{ AssetMonitor.loaded.add(url); AssetMonitor.notify(); };
loadingMgr.onError    = (url)=>{ AssetMonitor.failed.add(url); AssetMonitor.notify(); };

// use ONE loader so we can see what comes in
const sharedTextureLoader = new THREE.TextureLoader(loadingMgr);

// Lightweight sprite-sequence animation
export class SpriteSequence {
  constructor(scene, urls, {
    fps = 20,
    loop = false,
    scale = 1,
    position = new THREE.Vector3(0,0,0),
    rotation = 0,
    onComplete = null,
    textureLoader = sharedTextureLoader,   // << use monitored loader
    transparent = true,
    depthTest = false,
    renderOrder = 10,
  } = {}) {
    this.scene = scene;
    this.urls = urls;
    this.fps = fps;
    this.loop = loop;
    this.scale = scale;
    this.rotation = rotation;
    this.onComplete = onComplete;
    this.textureLoader = textureLoader;
    this.textures = [];
    this.time = 0;
    this.frame = 0;
    this.done = false;

    this.material = new THREE.SpriteMaterial({ transparent, depthTest, opacity: 1.0 });
    this.sprite = new THREE.Sprite(this.material);
    this.sprite.position.copy(position);
    this.sprite.scale.setScalar(scale);
    this.sprite.renderOrder = renderOrder;

    this.urls.forEach((u, i) => {
      this.textureLoader.load(u, (tx) => {
        tx.colorSpace = THREE.SRGBColorSpace;
        tx.generateMipmaps = true;
        tx.needsUpdate = true;
        this.textures[i] = tx;
        if (i === 0) {
          this.material.map = tx;
          this.material.needsUpdate = true;
          if (!this.sprite.parent) this.scene.add(this.sprite);
        }
      });
    });
  }

  setPosition(x,y,z=0){ this.sprite.position.set(x,y,z); }
  setScale(s){ this.sprite.scale.setScalar(s); }

  update(dt) {
    if (this.done || this.textures.length === 0) return;
    this.time += dt;
    const frameTime = 1/this.fps;
    while (this.time >= frameTime) {
      this.time -= frameTime;
      this.frame++;
      if (this.frame >= this.urls.length) {
        if (this.loop) {
          this.frame = 0;
        } else {
          this.finish();
          return;
        }
      }
      const tx = this.textures[this.frame];
      if (tx) {
        this.material.map = tx;
        this.material.needsUpdate = true;
      }
    }
  }

  finish() {
    if (this.done) return;
    this.done = true;
    if (this.sprite && this.sprite.parent) this.scene.remove(this.sprite);
    this.material.dispose();
    this.textures.forEach(t=>t.dispose?.());
    if (this.onComplete) this.onComplete();
  }
}

export class EffectsManager {
  constructor(scene) {
    this.scene = scene;
    this.effects = new Set();
  }
  spawn(urls, opts={}) {
    const fx = new SpriteSequence(this.scene, urls, opts);
    this.effects.add(fx);
    fx.onComplete = () => {
      this.effects.delete(fx);
      if (opts.onComplete) opts.onComplete();
    };
    return fx;
  }
  update(dt) {
    this.effects.forEach(fx => fx.update(dt));
  }
  clear() {
    this.effects.forEach(fx => fx.finish());
    this.effects.clear();
  }
}

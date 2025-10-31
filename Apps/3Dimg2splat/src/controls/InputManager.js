import * as THREE from 'three';

export class InputManager {
  /**
   * @param {object} opts
   * @param {THREE.Scene=} opts.scene           // optional, for ghost preview
   * @param {HTMLCanvasElement} opts.canvas
   * @param {THREE.PerspectiveCamera} opts.camera
   * @param {THREE.WebGLRenderer} opts.renderer
   * @param {object} opts.worldGen
   * @param {object} opts.worldState
   */
  constructor({ scene = null, canvas, camera, renderer, worldGen, worldState }) {
    this.scene = scene;
    this.canvas = canvas;
    this.camera = camera;
    this.renderer = renderer;
    this.worldGen = worldGen;
    this.worldState = worldState;

    this.enabled = true;
    this.raycaster = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this._mouse = { x: 0, y: 0 };

    // Default hotbar
    if (!this.worldState.hotbar || !Array.isArray(this.worldState.hotbar) || this.worldState.hotbar.length === 0) {
      this.worldState.hotbar = ['grass','dirt','stone','wood','brick','glass','water','sand','iron','custom1'];
    }
    if (!this.worldState.currentMaterial) this.worldState.currentMaterial = this.worldState.hotbar[0];
    this.hotIndex = 0;

    // Optional ghost preview
    this.previewGroup = null;
    if (this.scene) {
      const cubeGeo = new THREE.BoxGeometry(1, 1, 1);
      const cubeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false });
      const cube = new THREE.Mesh(cubeGeo, cubeMat);
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002)),
        new THREE.LineBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.95, depthTest: false })
      );
      const g = new THREE.Group();
      g.add(cube); g.add(edges);
      g.visible = false;
      this.scene.add(g);
      this.previewGroup = g;
      this.previewCube = cube;
    }

    // Events
    this._onPointerDown = (e) => this.onPointerDown(e);
    this._onPointerMove = (e) => this.onPointerMove(e);
    this._onContext = (e) => { if (e.target === this.canvas) e.preventDefault(); };
    this._onKey = (e) => this.onKeyDown(e);

    window.addEventListener('keydown', this._onKey, { passive: true });
    this.canvas.addEventListener('pointerdown', this._onPointerDown);
    this.canvas.addEventListener('pointermove', this._onPointerMove);
    this.canvas.addEventListener('contextmenu', this._onContext);
  }

  dispose() {
    window.removeEventListener('keydown', this._onKey);
    this.canvas.removeEventListener('pointerdown', this._onPointerDown);
    this.canvas.removeEventListener('pointermove', this._onPointerMove);
    this.canvas.removeEventListener('contextmenu', this._onContext);
    if (this.previewGroup && this.scene) this.scene.remove(this.previewGroup);
  }

  enable(){ this.enabled = true; }
  disable(){ this.enabled = false; if (this.previewGroup) this.previewGroup.visible = false; }

  onKeyDown(e){
    if (!this.enabled) return;
    if (/^Digit[0-9]$/.test(e.code)) {
      const n = (e.code === 'Digit0') ? 9 : (parseInt(e.code.slice(5), 10) - 1);
      if (n >= 0 && n < this.worldState.hotbar.length) {
        this.hotIndex = n;
        this.worldState.currentMaterial = this.worldState.hotbar[n];
        // Tint preview to match material (if available)
        const mat = this.worldGen?.materials?.get?.(this.worldState.currentMaterial);
        if (mat && this.previewCube) this.previewCube.material.color.copy(mat.color);
      }
    }
  }

  onPointerMove(e){
    if (!this.enabled) return;
    this._mouse.x = e.clientX; this._mouse.y = e.clientY;
    this._updateRayFromPointer(e);
    const hit = this.worldGen.raycastBlock(this.raycaster);
    if (!this.previewGroup) return;

    if (hit) {
      // Place on the terrain surface if we’re hovering water
      const yTarget = (hit.mat === 'water') ? (hit.surface + 1) : (hit.wy + 1);
      this.previewGroup.position.set(hit.wx + 0.5, yTarget + 0.5, hit.wz + 0.5);
      // Match held material color
      const held = this.worldState.currentMaterial || this.worldState.hotbar[this.hotIndex];
      const mat = this.worldGen?.materials?.get?.(held);
      if (mat && this.previewCube) this.previewCube.material.color.copy(mat.color);
      this.previewGroup.visible = true;
    } else {
      this.previewGroup.visible = false;
    }
  }

  onPointerDown(e){
    if (!this.enabled) return;
    if (e.target !== this.canvas) return;

    this._updateRayFromPointer(e);
    const hit = this.worldGen.raycastBlock(this.raycaster);
    if (!hit) return;

    if (e.button === 0) {
      // Place on top of surface; if we hit water, snap to terrain top
      const held = this.worldState.currentMaterial || this.worldState.hotbar[this.hotIndex] || 'grass';
      const yTarget = (hit.mat === 'water') ? (hit.surface + 1) : (hit.wy + 1);
      this.worldGen.placeBlock(hit.wx, yTarget, hit.wz, held);
    } else if (e.button === 2) {
      // Remove what we actually hit (can be water or solid)
      this.worldGen.removeBlock(hit.wx, hit.wy, hit.wz);
    }
  }

  _updateRayFromPointer(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.ndc.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
  }
}

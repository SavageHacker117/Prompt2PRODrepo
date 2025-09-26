import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export type ViewportBundle = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  root: THREE.Group;
};

export function initViewport(canvas: HTMLCanvasElement): ViewportBundle {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0f18);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
  camera.position.set(5, 3, 7);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 1, 0);
  controls.update();

  // Lighting
  const light = new THREE.DirectionalLight(0xffffff, 2);
  light.position.set(5, 10, 6);
  scene.add(light, new THREE.AmbientLight(0xffffff, 0.4));

  // Helpers
  const grid = new THREE.GridHelper(20, 20, 0x334155, 0x1f2937);
  scene.add(grid);

  const root = new THREE.Group();
  scene.add(root);

  function onResize() {
    const w = canvas.clientWidth || canvas.getBoundingClientRect().width;
    const h = window.innerHeight * 0.75;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", onResize);
  onResize();

  return { renderer, scene, camera, controls, root };
}

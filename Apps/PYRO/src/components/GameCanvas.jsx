import React, { useRef, useEffect } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader.js";

import { CausticsProjector } from "../graphics/CausticsProjector.js";
import { DEFAULT_SETTINGS } from "./HUD.jsx";

const texLoader = new THREE.TextureLoader();
function loadTex(url, { repeat = 1, wrapRepeat = false, linearMip = true } = {}) {
  const t = texLoader.load(url);
  if (wrapRepeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); }
  if (linearMip) { t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = 4; }
  return t;
}
function loadTexList(urls, opts = {}) { return urls.map(u => loadTex(u, opts)); }

export default function GameCanvas({
  // level is accepted but not required for this baseline boot
  level, shots = 3, settings = {},
  addShots = () => {}, onComplete = () => {}, onFail = () => {}, onConsumeShot = () => {},
  onSceneReady = () => {}
}) {
  const mountRef = useRef(null);
  const apiRef = useRef({
    velocity: new THREE.Vector3(),
    shotsLeft: shots,
    ghostTimer: 0,
    guideMult: 1,
    ballRadius: 0.35,
    maxSpeed: 26,
    hasLaunched: false,
  });

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // ---------- renderer / camera / scene ----------
    const W = mount.clientWidth || window.innerWidth;
    const H = mount.clientHeight || window.innerHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = loadTex("/assets/textures/env/sky_gradient.png");
    const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 300);
    camera.position.set(0, 6, 12);
    onSceneReady(scene);

    const ambient = new THREE.AmbientLight(0xffffff, 0.6); scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 0.9); dir.position.set(6, 10, 4); scene.add(dir);

    // ---------- post FX ----------
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(W, H), 0.85, 0.8, 0.0);
    composer.addPass(bloomPass);
    const fxaaPass = new ShaderPass(FXAAShader);
    fxaaPass.material.uniforms.resolution.value.set(1 / W, 1 / H);
    composer.addPass(fxaaPass);

    // ---------- simple environment (always visible) ----------
    const env = new THREE.Group(); scene.add(env);
    const texGrass = loadTex("/assets/textures/env/grass_dirt_blend.png", { wrapRepeat: true, repeat: 4 });
    const texLava  = loadTex("/assets/textures/env/lava_ground.png", { wrapRepeat: true, repeat: 3 });
    const texBricks= loadTex("/assets/textures/env/bricks_wall.png", { wrapRepeat: true, repeat: 2 });

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 40),
      new THREE.MeshStandardMaterial({ map: texGrass, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; env.add(ground);

    const room = new THREE.Mesh(new THREE.BoxGeometry(40, 20, 30),
      new THREE.MeshStandardMaterial({ map: texBricks, side: THREE.BackSide, roughness: 1 }));
    room.position.y = 10; env.add(room);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 24),
      new THREE.MeshStandardMaterial({ map: texLava, roughness: .9, emissive: 0x180601, emissiveIntensity: 0.25 }));
    floor.rotation.x = -Math.PI / 2; env.add(floor);

    // ---------- gameplay nodes ----------
    const bricks = []; // none in this baseline; we’re just proving the boot path
    const torches = []; const flames = []; // same
    const powerups = []; // same

    // ---------- fireball ----------
    const ball = new THREE.Group(); scene.add(ball);
    ball.position.set(0, 5, 0);

    let mixer = null, ballModel = null, modelBaseMax = 1;
    const ballCollider = new THREE.Mesh(
      new THREE.SphereGeometry(apiRef.current.ballRadius, 16, 16),
      new THREE.MeshBasicMaterial({ visible: false })
    ); ball.add(ballCollider);

    new GLTFLoader().load(
      "/assets/models/Fireball.glb",
      (gltf) => {
        ballModel = gltf.scene;
        ballModel.traverse(n => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
        const box = new THREE.Box3().setFromObject(ballModel);
        const size = new THREE.Vector3(); box.getSize(size);
        modelBaseMax = Math.max(size.x, size.y, size.z) || 1;
        const target = apiRef.current.ballRadius * 2;
        const scale = target / modelBaseMax;
        ballModel.scale.setScalar(scale);
        ball.add(ballModel);
        if (gltf.animations?.length) {
          mixer = new THREE.AnimationMixer(ballModel);
          gltf.animations.forEach(clip => mixer.clipAction(clip).play());
        }
      },
      undefined,
      (err) => { console.warn("Fireball.glb load failed (collider-only projectile will be used).", err); }
    );

    // ---------- trail ----------
    function makeParticleTexture() {
      const S = 64, c = document.createElement("canvas"); c.width = S; c.height = S;
      const ctx = c.getContext("2d");
      const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
      g.addColorStop(0, "rgba(255,240,180,1)");
      g.addColorStop(0.3, "rgba(255,160,40,0.9)");
      g.addColorStop(1, "rgba(255,80,0,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
      const t = new THREE.CanvasTexture(c); t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter;
      return t;
    }
    const TRAIL_COUNT = 140;
    const trailGeom = new THREE.BufferGeometry();
    const tPos = new Float32Array(TRAIL_COUNT * 3);
    for (let i = 0; i < tPos.length; i++) tPos[i] = 9999;
    trailGeom.setAttribute("position", new THREE.BufferAttribute(tPos, 3));
    const trail = new THREE.Points(
      trailGeom,
      new THREE.PointsMaterial({
        size: 0.3, map: makeParticleTexture(), transparent: true,
        depthWrite: false, blending: THREE.AdditiveBlending
      })
    );
    scene.add(trail);
    let tIndex = 0;
    function pushTrail(p) {
      if (!({ ...DEFAULT_SETTINGS, ...settings }.trail)) return;
      tPos[tIndex * 3 + 0] = p.x; tPos[tIndex * 3 + 1] = p.y; tPos[tIndex * 3 + 2] = p.z;
      tIndex = (tIndex + 1) % TRAIL_COUNT;
      trailGeom.attributes.position.needsUpdate = true;
    }

    // ---------- guide line ----------
    const guideGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const guide = new THREE.Line(guideGeo, new THREE.LineBasicMaterial({ color: 0xffd84d }));
    guide.visible = false; scene.add(guide);

    // ---------- physics & helpers ----------
    const gravity = new THREE.Vector3(0, -9.8, 0);
    function clampSpeed() {
      const v = apiRef.current.velocity, sp = v.length();
      if (sp > apiRef.current.maxSpeed) v.multiplyScalar(apiRef.current.maxSpeed / sp);
    }

    // ---------- caustics ----------
    const causticTextures = loadTexList([
      "/assets/textures/caustics/caustic_01.png",
      "/assets/textures/caustics/caustic_02.png",
      "/assets/textures/caustic_03.png",
    ], { wrapRepeat: true });
    let caustics = null;
    const getBallMatrixWorld = () => ball?.matrixWorld;
    function ensureCaustics(enabled) {
      if (enabled && !caustics && getBallMatrixWorld) {
        caustics = new CausticsProjector({
          scene, getSourceMatrixWorld: getBallMatrixWorld,
          size: 6, intensity: 0.65, speed: 0.6, textures: causticTextures
        });
      } else if (!enabled && caustics) {
        caustics.dispose(); caustics = null;
      }
    }

    // ---------- inputs (single block) ----------
    const raycaster = new THREE.Raycaster(), mouse = new THREE.Vector2();
    let dragging = false, dragStart3D = new THREE.Vector3(), dragStart2D = new THREE.Vector2();

    function setPointer(e) {
      const r = renderer.domElement.getBoundingClientRect();
      mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    }
    function pickBall(e) {
      setPointer(e); raycaster.setFromCamera(mouse, camera);
      const hit = raycaster.intersectObject(ballCollider, false);
      return hit.length ? hit[0] : null;
    }
    function pointerDown(e) {
      const hit = pickBall(e);
      if (!hit) return;
      dragging = true;
      dragStart3D.copy(hit.point);
      dragStart2D.set(e.clientX, e.clientY);
      guide.visible = true;
    }
    function pointerMove(e) {
      if (!dragging) return;
      setPointer(e); raycaster.setFromCamera(mouse, camera);
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -ball.position.y);
      const p = new THREE.Vector3(); raycaster.ray.intersectPlane(plane, p);
      const aim = new THREE.Vector3().subVectors(dragStart3D, p);
      const len = Math.min(9 * apiRef.current.guideMult, aim.length());
      const dir = aim.normalize().multiplyScalar(len);
      guide.geometry.setFromPoints([ball.position.clone(), ball.position.clone().add(dir)]);
    }
    function pointerUp(e) {
      if (!dragging) return;
      dragging = false; guide.visible = false;
      const dx = e.clientX - dragStart2D.x;
      const dy = e.clientY - dragStart2D.y;
      const mag = Math.sqrt(dx * dx + dy * dy);
      const power = Math.min(14, mag * 0.06);
      if (power > 0.15) {
        const dir2 = new THREE.Vector2(-dx, dy).normalize();
        const vx = dir2.x * power;
        const vz = dir2.y * power;
        apiRef.current.velocity.set(vx, Math.max(4, power * 0.6), vz);
        apiRef.current.hasLaunched = true;
        clampSpeed();
        onConsumeShot();
      }
    }
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    window.addEventListener("pointermove", pointerMove);
    window.addEventListener("pointerup", pointerUp);

    // ---------- WASD free-cam ----------
    const keys = Object.create(null);
    function onKey(ev) { keys[ev.key.toLowerCase()] = ev.type === "keydown"; }
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    const up = new THREE.Vector3(0, 1, 0);
    function updateCamera(dt) {
      const speed = (keys["shift"] ? 14 : 7) * dt;
      const forward = new THREE.Vector3(); camera.getWorldDirection(forward); forward.y = 0; forward.normalize();
      const right = new THREE.Vector3().crossVectors(forward, up).negate();
      if (keys["w"]) camera.position.addScaledVector(forward, speed);
      if (keys["s"]) camera.position.addScaledVector(forward, -speed);
      if (keys["a"]) camera.position.addScaledVector(right, -speed);
      if (keys["d"]) camera.position.addScaledVector(right, speed);
      if (keys[" "]) camera.position.y += speed;
      if (keys["control"]) camera.position.y -= speed;
    }

    // ---------- resize ----------
    function onResize() {
      const w = mount.clientWidth || window.innerWidth;
      const h = mount.clientHeight || window.innerHeight;
      renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
      composer.setSize(w, h);
      fxaaPass.material.uniforms.resolution.value.set(1 / w, 1 / h);
    }
    window.addEventListener("resize", onResize);

    // ---------- lifecycle ----------
    function resetBall() {
      apiRef.current.velocity.set(0, 0, 0);
      apiRef.current.ghostTimer = 0;
      apiRef.current.guideMult = 1;
      apiRef.current.hasLaunched = false;
      ballCollider.geometry.dispose();
      ballCollider.geometry = new THREE.SphereGeometry(apiRef.current.ballRadius, 16, 16);
      if (ballModel) {
        const target = apiRef.current.ballRadius * 2;
        const s = target / modelBaseMax;
        ballModel.scale.setScalar(s);
      }
      ball.position.set(0, 5, 0);
      guide.visible = false;
    }

    requestAnimationFrame(() => { window.FLSLoader?.hide?.(); });

    let rafId = 0; let lit = 0;
    function tick() {
      rafId = requestAnimationFrame(tick);
      const now = performance.now() / 1000;
      const dt = Math.min(0.033, tick._last ? now - tick._last : 0.016);
      tick._last = now;

      const sNow = { ...DEFAULT_SETTINGS, ...settings };
      ensureCaustics(sNow.caustics);
      trail.visible = !!sNow.trail;
      bloomPass.enabled = !!sNow.bloom;
      bloomPass.strength = Number.isFinite(sNow.bloomStrength) ? sNow.bloomStrength : DEFAULT_SETTINGS.bloomStrength;

      updateCamera(dt);
      if (mixer) mixer.update(dt);
      if (apiRef.current.velocity.lengthSq() > 0.0001) pushTrail(ball.position);

      // physics
      if (apiRef.current.velocity.lengthSq() > 0.00001) {
        apiRef.current.velocity.addScaledVector(gravity, dt);
        clampSpeed();
        ball.position.addScaledVector(apiRef.current.velocity, dt);

        if (ball.position.y <= 0 + apiRef.current.ballRadius) {
          ball.position.y = 0 + apiRef.current.ballRadius;
          apiRef.current.velocity.y *= -0.45;
          apiRef.current.velocity.multiplyScalar(0.989);
        }
        if (Math.abs(ball.position.x) > 12) { ball.position.x = Math.sign(ball.position.x) * 12; apiRef.current.velocity.x *= -0.55; }
        if (Math.abs(ball.position.z) > 6) { ball.position.z = Math.sign(ball.position.z) * 6; apiRef.current.velocity.z *= -0.55; }
      }

      // win/lose (baseline: no torches; win requires at least 1 launch then stop)
      if (apiRef.current.hasLaunched &&
          apiRef.current.velocity.length() < 0.15 &&
          ball.position.y <= (0 + apiRef.current.ballRadius + 0.01)) {
        if (apiRef.current.shotsLeft <= 0) { cancelAnimationFrame(rafId); onFail(); return; }
        apiRef.current.shotsLeft -= 1; resetBall();
      }

      if (caustics) caustics.update(dt);
      composer.render();
    }

    apiRef.current.shotsLeft = shots;
    resetBall();
    const start = requestAnimationFrame(tick);

    // ---------- cleanup ----------
    return () => {
      cancelAnimationFrame(start);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      window.removeEventListener("pointermove", pointerMove);
      window.removeEventListener("pointerup", pointerUp);
      if (caustics) caustics.dispose();
      mount.removeChild(renderer.domElement);
      composer?.passes?.splice(0, composer.passes.length);
      renderer.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shots, settings, addShots, onComplete, onFail, onConsumeShot, onSceneReady]);

  return <div ref={mountRef} style={{ width: "100%", height: "100%" }} />;
}

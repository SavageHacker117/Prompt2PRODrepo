import React, { useRef, useEffect, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";

import { CausticsProjector } from "@/graphics/CausticsProjector.js";
import { DEFAULT_SETTINGS } from "@/components/HUD.jsx";
import { useGame } from "@/context/GameContext.jsx";

// ---- Dev auto-index (Vite dev) ----
const MODEL_URLS = (() => {
  try {
    const mod = import.meta.glob("/src/assets/models/*.glb", { query: "?url", import: "default", eager: true });
    return Object.fromEntries(Object.entries(mod).map(([k, v]) => [k.split("/").pop(), v]));
  } catch { return {}; }
})();

const texLoader = new THREE.TextureLoader();
function loadTex(url, { repeat = 1, wrapRepeat = false, linearMip = true } = {}) {
  const t = texLoader.load(url);
  if (wrapRepeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); }
  if (linearMip) { t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = 4; }
  return t;
}
function loadTexList(urls, opts = {}) { return urls.map(u => loadTex(u, opts)); }

// tiny helper
const tmpV3 = new THREE.Vector3();

export default function GameCanvas({
  level, shots = 5, settings = {},
  addShots = () => {}, onComplete = () => {}, onFail = () => {}, onConsumeShot = () => {},
  onSceneReady = () => {}
}) {
  const mountRef = useRef(null);
  const { setSettings } = useGame();

  // Model Lab state (dev overlay)
  const [spawned, setSpawned] = useState([]); // [{name,url,mesh}]

  const apiRef = useRef({
    velocity: new THREE.Vector3(), // fireball velocity
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

    // keep canvas *under* HUD
    mount.style.position = "absolute";
    mount.style.inset = "0";
    mount.style.zIndex = 1;

    const W = mount.clientWidth || window.innerWidth;
    const H = mount.clientHeight || window.innerHeight;

    // ---------- renderer / scene / camera ----------
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.domElement.style.touchAction = "none";
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

    // ---------- environment ----------
    const env = new THREE.Group(); scene.add(env);
    const texGrass  = loadTex("/assets/textures/env/grass_dirt_blend.png", { wrapRepeat: true, repeat: 4 });
    const texLava   = loadTex("/assets/textures/env/lava_ground.png", { wrapRepeat: true, repeat: 3 });
    const texBricks = loadTex("/assets/textures/env/bricks_wall.png", { wrapRepeat: true, repeat: 2 });

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 40),
      new THREE.MeshStandardMaterial({ map: texGrass, roughness: 1 }));
    ground.rotation.x = -Math.PI/2; env.add(ground);

    const room = new THREE.Mesh(new THREE.BoxGeometry(40, 20, 30),
      new THREE.MeshStandardMaterial({ map: texBricks, side: THREE.BackSide, roughness: 1 }));
    room.position.y = 10; env.add(room);

    const lava = new THREE.Mesh(new THREE.PlaneGeometry(40, 24),
      new THREE.MeshStandardMaterial({ map: texLava, roughness: .9, emissive: 0x180601, emissiveIntensity: 0.25 }));
    lava.rotation.x = -Math.PI/2; env.add(lava);

    // ---------- goals (torches) ----------
    const goals = new THREE.Group(); scene.add(goals);
    const torches = [];
    const goalMatLit = new THREE.MeshStandardMaterial({ color:0xffc84d, emissive:0xffa000, emissiveIntensity:1.2 });
    const goalMatOff = new THREE.MeshStandardMaterial({ color:0x33220a, emissive:0x000000, emissiveIntensity:0.0 });
    const torchPositions = [ [-6,1.2,0], [0,2.0,-3], [6,1.2,0] ];
    for (const [x,y,z] of torchPositions) {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.2,0.5,16), goalMatOff.clone());
      base.position.set(x, y-0.35, z);
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), goalMatOff.clone());
      flame.position.set(x, y, z);
      flame.userData = { lit:false };
      goals.add(base, flame);
      torches.push(flame);
    }

    // ---------- orbit controls ----------
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.minDistance = 3;
    controls.maxDistance = 36;

    // ---------- transform controls (gizmo) ----------
    const tControls = new TransformControls(camera, renderer.domElement);
    tControls.visible = false;
    tControls.addEventListener("dragging-changed", e => {
      controls.enabled = !e.value; // disable orbit while dragging gizmo
    });
    scene.add(tControls);

    // ---------- fireball ----------
    const ball = new THREE.Group(); scene.add(ball);
    ball.position.set(0, 5, 0);

    const emissiveTargets = []; // materials on fireball model
    let mixerBall = null, ballModel = null, modelBaseMax = 1;

    const ballCollider = new THREE.Mesh(
      new THREE.SphereGeometry(apiRef.current.ballRadius, 16, 16),
      new THREE.MeshBasicMaterial({ visible:false })
    ); ball.add(ballCollider);

    new GLTFLoader().load(
      "/assets/models/Fireball.glb",
      (gltf) => {
        ballModel = gltf.scene;
        ballModel.traverse(n => {
          if (n.isMesh) {
            n.castShadow = n.receiveShadow = true;
            const m = n.material;
            if (m && "emissive" in m) {
              m.emissive = new THREE.Color(0xffa000);
              m.emissiveIntensity = 0.6;
              emissiveTargets.push(m);
            }
          }
        });
        const box = new THREE.Box3().setFromObject(ballModel);
        const size = new THREE.Vector3(); box.getSize(size);
        modelBaseMax = Math.max(size.x, size.y, size.z) || 1;
        const s = (apiRef.current.ballRadius * 2) / modelBaseMax;
        ballModel.scale.setScalar(s);
        ball.add(ballModel);
        if (gltf.animations?.length) {
          mixerBall = new THREE.AnimationMixer(ballModel);
          gltf.animations.forEach(clip => mixerBall.clipAction(clip).play());
        }
      },
      undefined,
      (err) => { console.warn("Fireball.glb load failed (collider-only projectile).", err); }
    );

    // ---------- trail ----------
    function makeParticleTexture() {
      const S = 64, c = document.createElement("canvas"); c.width = S; c.height = S;
      const ctx = c.getContext("2d");
      const g = ctx.createRadialGradient(S/2,S/2,0,S/2,S/2,S/2);
      g.addColorStop(0, "rgba(255,240,180,1)");
      g.addColorStop(0.3, "rgba(255,160,40,0.9)");
      g.addColorStop(1, "rgba(255,80,0,0)");
      ctx.fillStyle = g; ctx.fillRect(0,0,S,S);
      const t = new THREE.CanvasTexture(c); t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter;
      return t;
    }
    const TRAIL_COUNT = 140;
    const trailGeom = new THREE.BufferGeometry();
    const tPos = new Float32Array(TRAIL_COUNT*3); for (let i=0;i<tPos.length;i++) tPos[i]=9999;
    trailGeom.setAttribute("position", new THREE.BufferAttribute(tPos,3));
    const trail = new THREE.Points(
      trailGeom,
      new THREE.PointsMaterial({ size:0.3, map:makeParticleTexture(), transparent:true, depthWrite:false, blending:THREE.AdditiveBlending })
    );
    scene.add(trail);
    let tIndex = 0;
    function pushTrail(p){
      if (!({ ...DEFAULT_SETTINGS, ...settings }.trail)) return;
      tPos[tIndex*3+0]=p.x; tPos[tIndex*3+1]=p.y; tPos[tIndex*3+2]=p.z;
      tIndex=(tIndex+1)%TRAIL_COUNT;
      trailGeom.attributes.position.needsUpdate = true;
    }

    // ---------- guide line (fireball) ----------
    const guideGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3() ]);
    const guide = new THREE.Line(guideGeo, new THREE.LineBasicMaterial({ color:0xffd84d }));
    guide.visible = false; scene.add(guide);

    // ---------- physics helpers ----------
    const gravity = new THREE.Vector3(0, -9.8, 0);
    const clampSpeed = () => {
      const v=apiRef.current.velocity, sp=v.length();
      if(sp>apiRef.current.maxSpeed) v.multiplyScalar(apiRef.current.maxSpeed/sp);
    };

    // ---------- caustics ----------
    const causticTextures = loadTexList([
      "/assets/textures/caustics/caustic_01.png",
      "/assets/textures/caustics/caustic_02.png",
      "/assets/textures/caustics/caustic_03.png",
    ], { wrapRepeat: true });
    let caustics = null;
    const ensureCaustics = (enabled) => {
      if (enabled && !caustics) {
        caustics = new CausticsProjector({ scene, getSourceMatrixWorld: () => ball.matrixWorld, size:6, intensity:0.65, speed:0.6, textures:causticTextures });
      } else if (!enabled && caustics) {
        caustics.dispose(); caustics = null;
      }
    };

    // ---------- inputs (fireball + selection) ----------
    const raycaster = new THREE.Raycaster(), mouse = new THREE.Vector2();
    let dragging=false, dragStart3D=new THREE.Vector3(), dragStart2D=new THREE.Vector2();
    let ctrlKeyDown = false;

    const setPointer = (e) => {
      const r = renderer.domElement.getBoundingClientRect();
      mouse.set(((e.clientX - r.left)/r.width)*2 - 1, -((e.clientY - r.top)/r.height)*2 + 1);
    };
    const pickBall = (e) => {
      setPointer(e); raycaster.setFromCamera(mouse, camera);
      const hit = raycaster.intersectObject(ballCollider, false);
      return hit.length ? hit[0] : null;
    };

    // selection for transform controls (Ctrl+Click)
    function pickSceneObject(e) {
      setPointer(e);
      raycaster.setFromCamera(mouse, camera);
      // pick from spawned objects + character + gun, but not the fireball collider
      const pickables = [...spawnedNodes, ...(characterRoot ? [characterRoot] : []), ...(gun ? [gun] : [])];
      const hits = raycaster.intersectObjects(pickables, true);
      if (hits.length) {
        const selected = hits[0].object;
        // find topmost root kept in spawnedNodes or characterRoot
        let root = selected;
        while (root.parent && !spawnedNodes.includes(root) && root !== characterRoot && root !== gun) root = root.parent;
        tControls.attach(root);
        tControls.visible = true;
      } else {
        tControls.detach();
        tControls.visible = false;
      }
    }

    function pointerDown(e){
      if (ctrlKeyDown) { pickSceneObject(e); return; }

      const hit = pickBall(e);
      if (!hit) return;
      dragging=true; guide.visible=true; controls.enabled = false;
      dragStart3D.copy(hit.point); dragStart2D.set(e.clientX,e.clientY);
    }
    function pointerMove(e){
      if(!dragging) return;
      setPointer(e); raycaster.setFromCamera(mouse, camera);
      const plane = new THREE.Plane(new THREE.Vector3(0,1,0), -ball.position.y);
      const p = new THREE.Vector3(); raycaster.ray.intersectPlane(plane, p);
      const aim = new THREE.Vector3().subVectors(dragStart3D, p);
      const len = Math.min(9*apiRef.current.guideMult, aim.length());
      const dir = aim.normalize().multiplyScalar(len);
      guide.geometry.setFromPoints([ball.position.clone(), ball.position.clone().add(dir)]);
    }
    function pointerUp(e){
      if(!dragging) return;
      dragging=false; guide.visible=false; controls.enabled = true;
      const dx = e.clientX - dragStart2D.x;
      const dy = e.clientY - dragStart2D.y;
      const mag = Math.sqrt(dx*dx + dy*dy);
      const power = Math.min(14, mag * 0.06);
      if (power > 0.15) {
        const dir2 = new THREE.Vector2(-dx, dy).normalize();
        const vx = dir2.x * power;
        const vz = dir2.y * power;
        apiRef.current.velocity.set(vx, Math.max(4, power*0.6), vz);
        apiRef.current.hasLaunched = true;
        clampSpeed();
        onConsumeShot();
      }
    }
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    window.addEventListener("pointermove", pointerMove);
    window.addEventListener("pointerup", pointerUp);

    // ---------- keyboard ----------
    const keys = Object.create(null);
    function onKey(ev){
      const k = ev.key.toLowerCase();
      keys[k] = ev.type === "keydown";
      ctrlKeyDown = ev.ctrlKey;
      if(k === "r" && ev.type === "keydown"){ resetBall(); }
      if(k === "1" && ev.type === "keydown"){ tControls.setMode("translate"); }
      if(k === "2" && ev.type === "keydown"){ tControls.setMode("rotate"); }
      if(k === "3" && ev.type === "keydown"){ tControls.setMode("scale"); }
      if(k === "escape" && ev.type === "keydown"){ tControls.detach(); tControls.visible=false; }
      if(k === " " && ev.type === "keydown"){ characterJump(); }
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);

    // ---------- character (rose) + simple controller ----------
    const loader = new GLTFLoader();
    let characterRoot = null;
    let mixerChar = null;
    const charState = { speed: 0, run: 0, onGround: true, vy: 0, facing: 0 };
    const actions = { idle:null, walk:null, run:null, jump:null };
    const clips = {};

    function findBone(root, names=["RightHand","Hand.R","mixamorigRightHand","hand_r","r_hand"]) {
      let found = null;
      root.traverse(n => {
        if (found || !n.isBone) return;
        const nm = (n.name||"").toLowerCase();
        for (const t of names) if (nm.includes(t.toLowerCase())) { found = n; break; }
      });
      return found;
    }

    loader.load(MODEL_URLS["rose.glb"] || "/src/assets/models/rose.glb", (g) => {
      characterRoot = g.scene || g.scenes?.[0];
      characterRoot.position.set(-2, 0, 1);
      characterRoot.traverse(n => { if (n.isMesh) { n.castShadow = n.receiveShadow = true; } });
      scene.add(characterRoot);

      mixerChar = new THREE.AnimationMixer(characterRoot);
      (g.animations||[]).forEach(clip => { clips[clip.name.toLowerCase()] = clip; });

      // pick best matches
      actions.idle = mixerChar.clipAction(clips["idle"] || clips["tpose"] || clips[Object.keys(clips)[0]] || new THREE.AnimationClip("idle", -1, []));
      actions.walk = mixerChar.clipAction(clips["walk"] || clips["walking"] || clips["move"] || actions.idle.getClip());
      actions.run  = mixerChar.clipAction(clips["run"] || clips["running"] || actions.walk.getClip());
      actions.jump = mixerChar.clipAction(clips["jump"] || clips["jumping"] || actions.idle.getClip());

      actions.idle.enabled = actions.walk.enabled = actions.run.enabled = actions.jump.enabled = true;
      actions.idle.play();

      controls.target.copy(characterRoot.position);
    });

    // ---------- gun (M4) and bullets ----------
    let gun = null, muzzle = new THREE.Object3D();
    const bulletPool = [];
    const MAX_BULLETS = 60;

    function makeBullet() {
      const geo = new THREE.SphereGeometry(0.06, 12, 12);
      const mat = new THREE.MeshBasicMaterial({ color: 0xff9933, emissive: 0xff6600 });
      const m = new THREE.Mesh(geo, mat);
      m.visible = false;
      m.userData = { vel: new THREE.Vector3(), life: 0 };
      scene.add(m);
      bulletPool.push(m);
      return m;
    }
    for (let i=0;i<MAX_BULLETS;i++) makeBullet();

    function shoot() {
      if (!gun) return;
      // pick a bullet
      const b = bulletPool.find(x => !x.visible) || bulletPool[0];
      // get muzzle world pos & forward
      muzzle.updateWorldMatrix(true, true);
      const pos = new THREE.Vector3().setFromMatrixPosition(muzzle.matrixWorld);
      // forward from gun
      const fwd = new THREE.Vector3(0,0,-1).applyQuaternion(muzzle.getWorldQuaternion(new THREE.Quaternion())).normalize();

      b.position.copy(pos);
      b.userData.vel.copy(fwd).multiplyScalar(12);
      b.userData.life = 2.5;
      b.visible = true;
    }

    function attachGunToCharacter(root) {
      loader.load(MODEL_URLS["M4Colt.glb"] || MODEL_URLS["M4Colt.glb".toLowerCase()] || "/src/assets/models/M4Colt.glb", (g2) => {
        gun = g2.scene;
        gun.scale.setScalar(0.6);
        gun.rotation.set(0, Math.PI, 0);

        const hand = findBone(root) || root;
        hand.add(gun);
        gun.position.set(0.05, -0.05, -0.1);

        // create a simple muzzle child to get a clean world transform
        muzzle.position.set(0, 0, -0.45);
        gun.add(muzzle);
      });
    }

    // after character loads, attach gun
    const watcher = setInterval(() => {
      if (characterRoot && !gun) {
        attachGunToCharacter(characterRoot);
        clearInterval(watcher);
      }
    }, 200);

    // click to shoot (without stealing fireball drag)
    renderer.domElement.addEventListener("click", (e) => {
      if (dragging || ctrlKeyDown) return; // ignore if we just launched or selecting
      shoot();
    });

    // ---------- Model Lab spawn helpers ----------
    const spawnedNodes = [];
    function spawnModel(name, url){
      const count = spawnedNodes.filter(o => o.userData?.srcName === name).length;
      if (count >= 30) return;
      loader.load(url, (g) => {
        const o = g.scene || g.scenes?.[0];
        if (!o) return;
        o.traverse(n => { if (n.isMesh) { n.castShadow = n.receiveShadow = true; } });
        o.position.set((Math.random()-0.5)*14, 0, (Math.random()-0.5)*8);
        o.scale.setScalar(1);
        o.userData.srcName = name;
        scene.add(o);
        spawnedNodes.push(o);
        setSpawned(arr => [...arr, { name, url, mesh:o }]);
      });
    }
    function clearModel(name){
      for (let i = spawnedNodes.length-1; i>=0; i--){
        const o = spawnedNodes[i];
        if (name && o.userData?.srcName !== name) continue;
        scene.remove(o);
        spawnedNodes.splice(i,1);
      }
      setSpawned(arr => name ? arr.filter(x => x.name !== name) : []);
    }

    // ---------- lifecycle ----------
    function resetBall(){
      apiRef.current.velocity.set(0,0,0);
      apiRef.current.ghostTimer = 0;
      apiRef.current.guideMult = 1;
      apiRef.current.hasLaunched = false;
      ballCollider.geometry.dispose();
      ballCollider.geometry = new THREE.SphereGeometry(apiRef.current.ballRadius, 16, 16);
      if (ballModel) {
        const s = (apiRef.current.ballRadius * 2) / (Math.max(1e-6, modelBaseMax));
        ballModel.scale.setScalar(s);
      }
      ball.position.set(0, 5, 0);
      guide.visible = false;
    }

    requestAnimationFrame(() => { window.FLSLoader?.hide?.(); });

    let lit = 0;
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const now = performance.now()/1000;
      const dt = Math.min(0.033, tick._last ? now - tick._last : 0.016);
      tick._last = now;

      const sNow = { ...DEFAULT_SETTINGS, ...settings };
      ensureCaustics(sNow.caustics);
      trail.visible = !!sNow.trail;
      bloomPass.enabled = !!sNow.bloom;
      bloomPass.strength = Number.isFinite(sNow.bloomStrength) ? sNow.bloomStrength : DEFAULT_SETTINGS.bloomStrength;
      renderer.toneMappingExposure = sNow.exposure;

      for (const m of emissiveTargets) { m.emissiveIntensity = sNow.fireballGlow; }

      if (mixerBall) mixerBall.update(dt);
      if (mixerChar) mixerChar.update(dt);

      // --- character controller ---
      if (characterRoot) {
        const move = new THREE.Vector2(
          (keys["d"]?1:0) - (keys["a"]?1:0),
          (keys["w"]?1:0) - (keys["s"]?1:0)
        );
        const running = keys["shift"] ? 1 : 0;
        const targetSpeed = move.length() > 0 ? (running ? 3.8 : 1.8) : 0;
        charState.speed = THREE.MathUtils.damp(charState.speed, targetSpeed, 6, dt);
        charState.run   = THREE.MathUtils.damp(charState.run, running, 6, dt);

        // face direction of travel (based on camera xz)
        if (move.length() > 0) {
          const camDir = new THREE.Vector3();
          camera.getWorldDirection(camDir); camDir.y = 0; camDir.normalize();
          const right = tmpV3.crossVectors(camDir, new THREE.Vector3(0,1,0)).negate();
          const dir = camDir.multiplyScalar(move.y).add(right.multiplyScalar(move.x)).normalize();
          const yaw = Math.atan2(dir.x, dir.z);
          characterRoot.rotation.y = THREE.MathUtils.damp(characterRoot.rotation.y, yaw, 8, dt);
          characterRoot.position.addScaledVector(dir, charState.speed * dt);
          controls.target.copy(characterRoot.position);
        }

        // jump/gravity
        if (!charState.onGround) {
          charState.vy -= 9.2*dt;
          characterRoot.position.y += charState.vy*dt;
          if (characterRoot.position.y <= 0) {
            characterRoot.position.y = 0;
            charState.vy = 0;
            charState.onGround = true;
          }
        }

        // blend animations
        if (actions.idle) {
          const isMoving = charState.speed > 0.2;
          const isRunning = charState.run > 0.5 && isMoving;
          const aIdle = actions.idle, aWalk = actions.walk, aRun = actions.run;
          if (isRunning) {
            aRun.enabled = true; aRun.play(); aRun.setEffectiveWeight(1);
            aWalk.setEffectiveWeight(0); aIdle.setEffectiveWeight(0);
          } else if (isMoving) {
            aWalk.enabled = true; aWalk.play(); aWalk.setEffectiveWeight(1);
            aRun.setEffectiveWeight(0); aIdle.setEffectiveWeight(0);
          } else {
            aIdle.enabled = true; aIdle.play(); aIdle.setEffectiveWeight(1);
            aWalk.setEffectiveWeight(0); aRun.setEffectiveWeight(0);
          }
        }
      }

      // bullets
      for (const b of bulletPool) {
        if (!b.visible) continue;
        b.position.addScaledVector(b.userData.vel, dt);
        b.userData.life -= dt;
        if (b.userData.life <= 0) { b.visible = false; continue; }

        // torch hits
        for (const flame of torches) {
          if (!flame.userData.lit && flame.position.distanceTo(b.position) < 0.35) {
            flame.userData.lit = true;
            flame.material.copy(goalMatLit);
            b.visible = false;
            break;
          }
        }
      }

      controls.update();
      if (apiRef.current.velocity.lengthSq() > 0.0001) pushTrail(ball.position);

      // --- fireball physics ---
      if (apiRef.current.velocity.lengthSq() > 0.00001) {
        apiRef.current.velocity.addScaledVector(gravity, dt);
        clampSpeed();
        ball.position.addScaledVector(apiRef.current.velocity, dt);

        if (ball.position.y <= 0 + apiRef.current.ballRadius) {
          ball.position.y = 0 + apiRef.current.ballRadius;
          apiRef.current.velocity.y *= -0.45;
          apiRef.current.velocity.multiplyScalar(0.989);
        }
        if (Math.abs(ball.position.x) > 12) { ball.position.x = Math.sign(ball.position.x)*12; apiRef.current.velocity.x *= -0.55; }
        if (Math.abs(ball.position.z) > 6)  { ball.position.z = Math.sign(ball.position.z)*6;  apiRef.current.velocity.z *= -0.55; }
      }

      // torch goals for fireball too (close pass lights it)
      for (const flame of torches) {
        if (!flame.userData.lit && flame.position.distanceTo(ball.position) < (0.6 + apiRef.current.ballRadius*0.25)) {
          flame.userData.lit = true;
          flame.material.copy(goalMatLit);
          lit++;
        }
      }

      // lifecycle (shots) — simple demo logic
      if (apiRef.current.hasLaunched &&
          apiRef.current.velocity.length() < 0.15 &&
          ball.position.y <= (0 + apiRef.current.ballRadius + 0.01)) {
        if (lit >= Math.max(1, torches.length)) { onComplete((apiRef.current.shotsLeft-1)*10); return; }
        if (apiRef.current.shotsLeft <= 0) { onFail(); return; }
        apiRef.current.shotsLeft -= 1; resetBall();
      }

      if (caustics) caustics.update(dt);
      composer.render();
    };

    apiRef.current.shotsLeft = shots;
    resetBall();
    const start = requestAnimationFrame(tick);

    // dev: hook buttons
    const onSpawn = (e) => spawnModel(e.detail.name, e.detail.url);
    const onClear = (e) => clearModel(e.detail.name);
    window.addEventListener("PYRO_SPAWN_MODEL", onSpawn);
    window.addEventListener("PYRO_CLEAR_MODEL", onClear);

    // jumping
    function characterJump() {
      if (!characterRoot || !charState.onGround) return;
      charState.onGround = false;
      charState.vy = 4.2;
      if (actions.jump) { actions.jump.reset().setLoop(THREE.LoopOnce, 1).fadeIn(0.05).play().clampWhenFinished = true; }
    }

    // cleanup
    return () => {
      window.removeEventListener("PYRO_SPAWN_MODEL", onSpawn);
      window.removeEventListener("PYRO_CLEAR_MODEL", onClear);
      cancelAnimationFrame(start); cancelAnimationFrame(raf);
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
  }, [shots, settings, addShots, onComplete, onFail, onConsumeShot, onSceneReady, level]);

  // Model Lab overlay
  const s = { ...DEFAULT_SETTINGS, ...settings };
  const showLab = !!s.showModelLab;

  return (
    <>
      <div ref={mountRef} style={{ width:"100%", height:"100%" }} />
      {showLab && (
        <div
          style={{
            position:"absolute", right:12, top:12, zIndex:25,
            width:300, maxHeight:420, overflow:"auto",
            background:"rgba(0,0,0,.55)", border:"1px solid rgba(255,255,255,.1)", borderRadius:8, padding:10,
            color:"#cfd8e3", fontFamily:"system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif"
          }}
          onPointerDown={e=>e.stopPropagation()} onWheel={e=>e.stopPropagation()}
        >
          <div style={{fontWeight:600, marginBottom:8}}>Model Lab (auto-index)</div>
          {Object.keys(MODEL_URLS).length === 0 ? (
            <div style={{fontSize:12, opacity:.8}}>
              No models under <code>src/assets/models/*.glb</code>.<br/>
              Tip: copy GLBs (e.g. <code>rose.glb</code>, <code>M4Colt.glb</code>) into that folder during dev.
            </div>
          ) : (
            Object.entries(MODEL_URLS).map(([name, url]) => (
              <div key={name} style={{display:"flex", alignItems:"center", gap:8, margin:"6px 0"}}>
                <div style={{flex:1, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{name}</div>
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent("PYRO_SPAWN_MODEL",{ detail:{ name, url } }))}
                  style={{background:"#1e2b3b", color:"#cfd8e3", border:"1px solid #2b3b50", borderRadius:6, padding:"3px 8px", cursor:"pointer"}}
                >Spawn</button>
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent("PYRO_CLEAR_MODEL",{ detail:{ name } }))}
                  style={{background:"#2b1e1e", color:"#e3cfcf", border:"1px solid #503b3b", borderRadius:6, padding:"3px 8px", cursor:"pointer"}}
                >Clear</button>
              </div>
            ))
          )}
          <hr style={{border:"none", borderTop:"1px solid rgba(255,255,255,.1)", margin:"8px 0"}}/>
          <div style={{fontSize:12, opacity:.8, lineHeight:1.5}}>
            <b>Tips</b><br/>
            • Ctrl+Click to select an object, then use gizmo (1=Move, 2=Rotate, 3=Scale).<br/>
            • Click to shoot from the gun. Space = Jump, Shift = Run.<br/>
            • Left-drag fireball to launch (Orbit disables while dragging).<br/>
          </div>
        </div>
      )}
    </>
  );
}

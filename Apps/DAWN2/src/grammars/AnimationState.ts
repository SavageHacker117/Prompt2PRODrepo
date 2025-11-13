type KeyState = { [k:string]: boolean };
const keys: KeyState = {};

export function initPlayerControls(){
  const ap = (window as any).__animPanel || {};
  const eng = (window as any).__engine || {};

  // Map your real clip names here
  const CLIP = {
    idle:     'Idle',
    breathe:  'Breathe',
    walk:     'Walk',
    jog:      'Jog',
    run:      'Run',
    aim:      'Aim',
    fire:     'Fire',
    reload:   'Reload',
    jump:     'Jump',
    fall:     'Fall',
    land:     'Land',
    turnL:    'TurnLeft',
    turnR:    'TurnRight',
  };

  // helpers
  const setLoop = (on:boolean)=> ap.loop?.(on ? 'on' : 'off');
  const playOnce = (name:string)=>{ setLoop(false); ap.play?.(name); };
  const fadeTo   = (name:string, t=0.2)=>{ setLoop(true); ap.fadeTo?.(name, t); };

  // ───────── input
  function onKey(e: KeyboardEvent, down: boolean){
    keys[e.code] = down;
  }

  function onMouse(e: MouseEvent, down: boolean){
    if (e.button === 2) { // right -> aim
      if (down) fadeTo(CLIP.aim);
      else      updateLocomotion(); // release aim -> back to locomotion
    }
    if (e.button === 0 && keys['MouseRight']) { // left while aiming -> fire
      if (down) playOnce(CLIP.fire);
    }
  }

  window.addEventListener('keydown', (e)=> onKey(e, true));
  window.addEventListener('keyup',   (e)=> onKey(e, false));
  window.addEventListener('mousedown', (e)=> onMouse(e, true));
  window.addEventListener('mouseup',   (e)=> onMouse(e, false));

  // ───────── locomotion state
  function moving(): boolean {
    return !!(keys['KeyW']||keys['KeyA']||keys['KeyS']||keys['KeyD']);
  }

  function locomotionClip(): string {
    if (!moving()) return CLIP.breathe;
    if (keys['ShiftLeft']||keys['ShiftRight']) return CLIP.run;
    if (keys['AltLeft']||keys['AltRight']) return CLIP.walk; // slower walk with Alt
    return CLIP.jog;
  }

  function updateLocomotion(){
    if (keys['MouseRight']) return; // stay in aim while held
    fadeTo(locomotionClip());
  }

  // ───────── movement system (XZ)
  let enabled = true;
  let speedBase = 2.5;

  function desiredSpeed(): number {
    if (!moving()) return 0;
    if (keys['ShiftLeft']||keys['ShiftRight']) return speedBase * 1.8;
    if (keys['AltLeft']||keys['AltRight']) return speedBase * 0.6;
    return speedBase;
  }

  const sys = {
    update(dt: number, state?: any){
      if (!enabled) return;
      const root: any = (eng.activeActor?.object) || eng.selected;
      if (!root) return;

      // orient & move relative to camera yaw
      const cam: any = (window as any).__camera;
      const yaw = cam ? Math.atan2(cam.position.x - root.position.x, cam.position.z - root.position.z) : 0;

      const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
      const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0), fwd).negate();

      const v = new THREE.Vector3();
      if (keys['KeyW']) v.add(fwd);
      if (keys['KeyS']) v.sub(fwd);
      if (keys['KeyA']) v.sub(right);
      if (keys['KeyD']) v.add(right);

      const sp = desiredSpeed();
      if (v.lengthSq() > 0) {
        v.normalize().multiplyScalar(sp * dt);
        root.position.add(v);
        // rotate actor to face travel direction (smooth)
        const targetYaw = Math.atan2(v.x, v.z);
        root.rotation.y += (targetYaw - root.rotation.y) * Math.min(1, dt * 10);
      }

      // update locomotion anim if needed
      updateLocomotion();
    }
  }

  // register into engine systems so the App tick calls it
  (eng.systems ||= new Set()).add(sys);

  // expose controls on engine
  eng.movement = {
    enabled,
    enable(v: boolean){ enabled = v; this.enabled = v; updateLocomotion(); },
    setSpeed(v: number){ speedBase = Math.max(0.1, v); },
  };

  // start state
  fadeTo(CLIP.breathe, 0.001);

  // disposer
  return () => {
    window.removeEventListener('keydown', (e)=> onKey(e, true));
    window.removeEventListener('keyup',   (e)=> onKey(e, false));
    window.removeEventListener('mousedown', (e)=> onMouse(e, true));
    window.removeEventListener('mouseup',   (e)=> onMouse(e, false));
    (eng.systems as Set<any>)?.delete(sys);
    delete eng.movement;
  }
}

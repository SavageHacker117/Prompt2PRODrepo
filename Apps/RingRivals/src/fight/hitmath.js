// Gloves-only → (head|torso) hits, with generous margins, speed/forward check,
// per-glove cooldown, block awareness, and an optional "Hit Lab" panel.
//
// If you pass a `hitLab` with `.log(evt)`, we use it.
// Otherwise we create a tiny fallback panel for quick debugging.
//
// Event fields sent to onHit/hitLab.log:
//  { ts, by, aIsPlayer, target, side, part, power, blocked, aHP, dHP, aXP, pos }

import * as THREE from 'three';

const TARGET_INFLATE = 0.08;   // extra forgiveness on targets
const GLOVE_INFLATE  = 0.05;   // extra forgiveness on gloves
const MIN_SPEED      = 0.7;    // m/s-ish to count as a punch when not in anim
const COOLDOWN_S     = 0.25;   // per glove cooldown

// per-attacker state (glove prev positions + cooldowns)
const ST = new WeakMap();
function stFor(boxer){
  let s = ST.get(boxer);
  if (!s){
    s = { prevL:new THREE.Vector3(), prevR:new THREE.Vector3(), cdL:0, cdR:0 };
    ST.set(boxer, s);
  }
  return s;
}

const tmpV = new THREE.Vector3();
const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();

// ---- math helpers ----
function distPointSeg(p, a, b){
  const ab = tmpB.copy(b).sub(a);
  const denom = Math.max(1e-6, ab.lengthSq());
  const t = Math.max(0, Math.min(1, tmpA.copy(p).sub(a).dot(ab) / denom));
  const closest = tmpA.copy(a).add(ab.multiplyScalar(t));
  return p.distanceTo(closest);
}
function sphereVsCapsule(p, r, A, B, R){ return distPointSeg(p, A, B) <= (r+R); }
function sphereVsSphere(p1,r1,p2,r2){ return p1.distanceTo(p2) <= (r1+r2); }

/* ---------------- Fallback Hit Lab (only if no external logger) ---------------- */
let _fallback; // created lazily
function fallbackLab(){
  if (_fallback) return _fallback;

  const el = document.createElement('div');
  el.style.cssText = `
    position:fixed; right:14px; bottom:16px; z-index:20;
    background:#0b0f1a; color:#d7e1ff; padding:10px 14px; border-radius:10px;
    box-shadow:0 10px 30px rgba(0,0,0,.35); font:13px/1.4 system-ui,Segoe UI,Roboto;
  `;
  el.innerHTML = `<b>Hit Lab</b><div id="hlP"></div><div id="hlC"></div>`;
  document.body.appendChild(el);

  let pHits=0, pBlocks=0, cHits=0, cBlocks=0;
  const $p = el.querySelector('#hlP');
  const $c = el.querySelector('#hlC');
  const render = () => {
    $p.textContent = `PLAYER: ${pHits} hits, ${pBlocks} blocked`;
    $c.textContent = `CPU: ${cHits} hits, ${cBlocks} blocked`;
  };
  render();

  _fallback = {
    log(evt){
      if (evt.aIsPlayer) { evt.blocked ? pBlocks++ : pHits++; }
      else               { evt.blocked ? cBlocks++ : cHits++; }
      render();
    }
  };
  return _fallback;
}

/* ---------------- main entry ---------------- */
export function applyHitDetection({ attacker, defender, overlay, onHit, hitLab }) {
  const logger = hitLab?.log ? hitLab : fallbackLab();

  const aVol = attacker.getHitVolumes();
  const dVol = defender.getHitVolumes();

  // show overlay wire volumes if enabled
  if (overlay?.on && overlay.updateVolumes) overlay.updateVolumes(aVol, dVol);

  const st = stFor(attacker);

  // dt using per-call now (two calls per frame: player→cpu & cpu→player)
  const now = performance.now()*0.001;
  attacker.__hd_prevT ??= now;
  const dt = Math.max(1/120, Math.min(0.1, now - attacker.__hd_prevT));
  attacker.__hd_prevT = now;

  // glove world speeds + “is moving toward opponent” heuristic
  const fpL = aVol.fistL.p, fpR = aVol.fistR.p;
  const speedL = fpL.distanceTo(st.prevL) / dt;
  const speedR = fpR.distanceTo(st.prevR) / dt;

  const targ = defender.getChestWorldPos();
  const fwdL = tmpV.copy(fpL).sub(st.prevL).normalize().dot( tmpA.copy(targ).sub(fpL).normalize() );
  const fwdR = tmpV.copy(fpR).sub(st.prevR).normalize().dot( tmpA.copy(targ).sub(fpR).normalize() );

  st.prevL.copy(fpL); st.prevR.copy(fpR);
  st.cdL = Math.max(0, st.cdL - dt);
  st.cdR = Math.max(0, st.cdR - dt);

  const tryHit = (side)=>{
    const isLeft = side==='L';
    const fist = isLeft ? aVol.fistL : aVol.fistR;
    const speed = isLeft ? speedL : speedR;
    const fwd   = isLeft ? fwdL   : fwdR;
    const cd    = isLeft ? st.cdL : st.cdR;

    // Use extension (1 - punch) so the hit window is when the glove is OUT
    const pVal = (isLeft ? attacker.anim?.punchL : attacker.anim?.punchR) ?? 1;
    const extension = 1 - pVal; // 0 = tucked, 1 = fully extended
    const animOK = extension > 0.35;

    if (cd>0) return false;
    if (!animOK && (speed < MIN_SPEED || fwd < 0.1)) return false;

    const fistR = fist.r + GLOVE_INFLATE;

    const hitTorso = sphereVsCapsule(
      fist.p, fistR,
      dVol.torso.a, dVol.torso.b, dVol.torso.r + TARGET_INFLATE
    );
    const hitHead  = sphereVsSphere(
      fist.p, fistR,
      dVol.head.p,  dVol.head.r + TARGET_INFLATE
    );

    if (!hitTorso && !hitHead) return false;

    const blocked = defender.isBlockingActive?.() === true;

    // damage scales a bit with speed; head slightly stronger
    const base = hitHead ? 10 : 7;
    const power = base + Math.min(6, speed*0.8);

    if (!blocked) {
      defender.wasHit?.(power);
      attacker.xp = (attacker.xp || 0) + (hitHead ? 3 : 2);
    } else {
      attacker.stamina = Math.max(0, (attacker.stamina || 0) - 1.5);
    }

    if (isLeft) st.cdL = COOLDOWN_S; else st.cdR = COOLDOWN_S;

    const event = {
      ts: now,
      by: attacker.name,
      aIsPlayer: !!attacker.isPlayer,
      target: defender.name,
      side,
      part: hitHead ? 'head' : 'torso',
      power,
      blocked,
      aHP: attacker.health,
      dHP: defender.health,
      aXP: attacker.xp || 0,
      pos: fist.p.clone(),
    };

    logger.log?.(event);
    onHit && onHit(event);
    return true;
  };

  tryHit('L');
  tryHit('R');
}

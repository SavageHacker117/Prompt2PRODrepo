// scripts/wave.js
// Simple procedural wave animation for the right arm/hand.
// Hot-reload friendly: ScriptHost will recreate it on file change.

export function create(ctx) {
  // pick likely right arm chain
  const pick = (names) => {
    const lower = names.map(n => n.toLowerCase());
    const find = (...cands) =>
      ctx.bones.find(b => {
        const n = b.name.toLowerCase();
        return cands.some(c => n.includes(c));
      }) || null;

    // heuristics for common exporters
    const shoulder = find('rightshoulder','shoulder.r','r_shoulder','upperarm.r','armature|rightshoulder');
    const upper    = find('rightarm','upperarm.r','upperarm','r_arm');
    const fore     = find('rightforearm','forearm.r','lowerarm','r_forearm');
    const hand     = find('r_hand','hand.r','r_wrist','righthand','right_wrist');

    return { shoulder: shoulder||upper, upper, fore, hand };
  };

  const chain = pick(ctx.bones.map(b => b.name));
  const targets = [chain.upper, chain.fore, chain.hand].filter(Boolean);

  // remember initial rotations
  const rest = new Map();
  for (const b of targets) rest.set(b, b.quaternion.clone());

  let t = 0;
  let amp = 0.35;   // radians
  let speed = 2.5;  // Hz-ish

  return {
    start() {
      // nothing
    },
    update(dt) {
      t += dt * speed * Math.PI * 2;
      const s = Math.sin(t);
      const s2 = Math.sin(t * 0.5);

      // gentle bend in Z, small twist in X
      targets.forEach((b, i) => {
        const r = rest.get(b).clone();
        // incremental: apply small offsets from rest
        const dqZ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1), amp * s * (0.6 + 0.2*i));
        const dqX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0), 0.12 * s2 * (1 - 0.3*i));
        r.multiply(dqZ).multiply(dqX);
        b.quaternion.copy(r);
        b.updateMatrixWorld(true);
      });
    },
    stop() {
      // restore rest pose
      targets.forEach(b => {
        const r = rest.get(b);
        if (r) b.quaternion.copy(r);
        b.updateMatrixWorld(true);
      });
    }
  };
}

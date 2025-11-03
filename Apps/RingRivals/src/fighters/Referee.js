import * as THREE from 'three';

export class Referee {
  constructor(){
    this.root = new THREE.Group();

    // white shirt
    const shirt = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.26, 0.6, 6, 10),
      new THREE.MeshStandardMaterial({ color:0xffffff, roughness:.6, metalness:.05 })
    );
    shirt.position.y = 1.0; shirt.castShadow = true;

    // black pants
    const pants = new THREE.Mesh(
      new THREE.CylinderGeometry(0.23, 0.23, 0.55, 14),
      new THREE.MeshStandardMaterial({ color:0x1a1a1a, roughness:.5, metalness:.05 })
    );
    pants.position.y = 0.55; pants.castShadow = true;

    // head
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 16, 16),
      new THREE.MeshStandardMaterial({ color:0xf0d0b0, roughness:.7 })
    );
    head.position.y = 1.55; head.castShadow = true;

    // short hair cap (no hat)
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.21, 16, 16, 0, Math.PI*2, 0, Math.PI/2),
      new THREE.MeshStandardMaterial({ color:0x222222, roughness:.6, metalness:.1, side:THREE.DoubleSide })
    );
    hair.position.set(0, 1.61, 0);
    hair.scale.set(1,0.6,1);

    // glasses
    const ring = (r)=> new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.015, 8, 18),
      new THREE.MeshStandardMaterial({ color:0x111111, metalness:.9, roughness:.2 })
    );
    const gL = ring(0.07), gR = ring(0.07);
    gL.position.set(-0.08, 1.55, 0.18); gR.position.set(0.08, 1.55, 0.18);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.06,0.01,0.01),
      new THREE.MeshStandardMaterial({ color:0x111111, metalness:.9, roughness:.2 }));
    bridge.position.set(0, 1.55, 0.18);

    // black bow tie
    const bowGeo = new THREE.BoxGeometry(0.06,0.02,0.01);
    const bowMat = new THREE.MeshStandardMaterial({ color:0x000000, metalness:.2, roughness:.4 });
    const bowL = new THREE.Mesh(bowGeo, bowMat), bowR = bowL.clone(), knot = new THREE.Mesh(new THREE.BoxGeometry(0.02,0.02,0.012), bowMat);
    bowL.position.set(-0.05, 1.32, 0.22); bowR.position.set(0.05, 1.32, 0.22); knot.position.set(0,1.32,0.22);

    this.root.add(pants, shirt, head, hair, gL, gR, bridge, bowL, bowR, knot);
  }

  // winner-biased pacing: hover near midpoint, bias toward current leader (higher HP).
  update(dt, player, opponent){
    const p = player.root.position, o = opponent.root.position;
    const mid = new THREE.Vector3().addVectors(p,o).multiplyScalar(0.5);
    const dir = new THREE.Vector3().subVectors(o,p).setY(0).normalize();

    const toward = (player.health >= opponent.health) ? player.root.position : opponent.root.position;

    // base spot a bit behind the exchange
    const base = new THREE.Vector3().copy(mid).addScaledVector(dir, -1.6);

    // soft bias towards the leader + gentle lateral sway
    const winnerBias = new THREE.Vector3().subVectors(toward, mid).multiplyScalar(0.35);
    const lateral = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(Math.sin(performance.now()*0.0016)*0.5);

    const target = base.add(winnerBias).add(lateral);
    target.y = 1.22;

    // smooth
    const a = 1 - Math.exp(-dt*5);
    this.root.position.lerp(target, a);
    this.root.lookAt(mid.x,1.35,mid.z);
  }
}

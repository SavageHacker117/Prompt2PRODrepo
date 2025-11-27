// 3rd-person (3 variants) + 1st-person from head bone. Hotkeys: '8' cycles 3P, '7' toggles 1P.
import * as THREE from 'three';

type Mode = '3p-left' | '3p-center' | '3p-right' | '1p';
const ORDER: Mode[] = ['3p-left','3p-center','3p-right'];

export class CameraRig {
  cam: THREE.Camera;
  target: THREE.Object3D | null = null;
  mode: Mode = '3p-center';
  shoulder = 0; // -1 left, 0 center, +1 right
  offsets = {
    // tuned for 16:9; tweak live then persist in localStorage if you like
    third: new THREE.Vector3(0, 1.55, -3.6), // y = height over hips
    first: new THREE.Vector3(0.00, 1.60, 0.08)
  };
  headNames = /(Head|head|mixamorigHead)/;

  constructor(cam: THREE.Camera) {
    this.cam = cam;
    window.addEventListener('keydown', (e) => {
      if (e.key === '8') this.cycle3p();
      if (e.key === '7') this.toggle1p();
    });
  }

  attach(o: THREE.Object3D) { this.target = o; }

  private cycle3p() {
    if (this.mode === '1p') this.mode = '3p-left';
    else {
      const i = ORDER.indexOf(this.mode);
      this.mode = ORDER[(i + 1) % ORDER.length] as Mode;
    }
    this.shoulder = this.mode === '3p-left' ? -1 : this.mode === '3p-right' ? +1 : 0;
  }

  private toggle1p() { this.mode = (this.mode === '1p') ? '3p-center' : '1p'; }

  private headBone(): THREE.Object3D | null {
    if (!this.target) return null;
    let found: THREE.Object3D | null = null;
    this.target.traverse((n) => { if (!found && this.headNames.test(n.name)) found = n; });
    return found;
  }

  update(dt: number) {
    if (!this.target) return;
    const t = this.target;
    const up = new THREE.Vector3(0,1,0);

    if (this.mode === '1p') {
      const head = this.headBone() || t;
      const wp = new THREE.Vector3();
      head.getWorldPosition(wp);
      const off = this.offsets.first.clone().applyQuaternion(t.getWorldQuaternion(new THREE.Quaternion()));
      this.cam.position.lerp(wp.add(off), 1);
      this.cam.lookAt(wp.add(new THREE.Vector3(0,0.05,0)).add(t.getWorldDirection(new THREE.Vector3())));
      return;
    }

    // 3rd-person chase
    const pivot = t.position.clone();
    const basis = new THREE.Matrix4().extractRotation(t.matrixWorld);
    const right = new THREE.Vector3(1,0,0).applyMatrix4(basis);
    const back  = new THREE.Vector3(0,0,1).applyMatrix4(basis);
    const upv   = new THREE.Vector3(0,1,0).applyMatrix4(basis);

    const shoulderOffset = right.clone().multiplyScalar(this.shoulder * 0.6);
    const desired = pivot.clone()
      .add(upv.multiplyScalar(this.offsets.third.y))
      .add(back.multiplyScalar(this.offsets.third.z))
      .add(shoulderOffset);

    this.cam.position.lerp(desired, Math.min(1, dt * 8));
    this.cam.lookAt(pivot.add(new THREE.Vector3(0,1.4,0)));
    (this.cam as any).up = up;
  }
}

// BoneRuntime.ts
import * as THREE from 'three';

export type BoneCallbackInfo = {
  bone: THREE.Bone;
  worldPos: THREE.Vector3;
  worldQuat: THREE.Quaternion;
  worldScale: THREE.Vector3;
  dt: number;
};

type Entry = { bones: THREE.Bone[]; cb: (info: BoneCallbackInfo) => void };

export class BoneRuntime {
  root: THREE.Object3D;
  private entries: Entry[] = [];
  private _v = new THREE.Vector3();
  private _q = new THREE.Quaternion();
  private _s = new THREE.Vector3();

  constructor(root: THREE.Object3D) {
    this.root = root;
  }

  /** Run callback for all bones whose name includes namePart (case-insensitive) */
  add(namePart: string, cb: (info: BoneCallbackInfo) => void): this {
    const bones: THREE.Bone[] = [];
    const lc = namePart.toLowerCase();
    this.root.traverse(o => {
      const isBone = (o as any).isBone === true;
      if (isBone && o.name.toLowerCase().includes(lc)) bones.push(o as THREE.Bone);
    });
    if (bones.length) this.entries.push({ bones, cb });
    return this;
  }

  /** Attach an Object3D to the first bone whose name includes namePart */
  attachObject(namePart: string, object3D: THREE.Object3D): THREE.Object3D | null {
    const lc = namePart.toLowerCase();
    let bone: THREE.Bone | null = null;
    this.root.traverse(o => {
      if (!bone && (o as any).isBone && o.name.toLowerCase().includes(lc)) bone = o as THREE.Bone;
    });
    if (!bone) return null;
    bone.add(object3D);
    object3D.position.set(0, 0, 0);
    return object3D;
  }

  update(dt: number) {
    for (const e of this.entries) {
      for (const b of e.bones) {
        b.updateWorldMatrix(true, false);
        b.matrixWorld.decompose(this._v, this._q, this._s);
        e.cb({ bone: b, worldPos: this._v, worldQuat: this._q, worldScale: this._s, dt });
      }
    }
  }
}

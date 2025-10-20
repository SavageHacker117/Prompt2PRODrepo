import * as THREE from "three";

export type RoadParams = {
  width?: number;            // meters
  bankAngleDeg?: number;     // constant bank (positive tilts right)
  uvTiling?: number;         // how many UV repeats per 1m along
};

export function defaultRoadParams(): Required<RoadParams> {
  return { width: 7, bankAngleDeg: 5, uvTiling: 0.05 };
}

export function frameWithBank(
  pos: THREE.Vector3,
  tangent: THREE.Vector3,
  bankAngleDeg: number
) {
  const up = new THREE.Vector3(0, 1, 0);
  const n = up.clone().cross(tangent).normalize(); // binormal-ish
  const b = n.clone().applyAxisAngle(tangent, THREE.MathUtils.degToRad(bankAngleDeg));
  const finalUp = tangent.clone().cross(b).normalize();
  return { right: b.normalize(), up: finalUp.normalize() };
}

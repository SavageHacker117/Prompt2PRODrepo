import * as THREE from 'three'

export function lerp(a: number, b: number, t: number) { return a + (b - a) * t }

export function eulerLerp(a: THREE.Euler, b: THREE.Euler, t: number): THREE.Euler {
  // convert to quats to avoid gimbal issues
  const qa = new THREE.Quaternion().setFromEuler(a)
  const qb = new THREE.Quaternion().setFromEuler(b)
  const q = new THREE.Quaternion().slerpQuaternions(qa, qb, t)
  return new THREE.Euler().setFromQuaternion(q)
}

export function findSegment<T extends { t: number }>(arr: T[], t: number) {
  if (arr.length === 0) return [null, null, 0] as const
  if (arr.length === 1) return [arr[0], arr[0], 0] as const
  let i = 0
  while (i < arr.length - 1 && arr[i + 1].t < t) i++
  const a = arr[i], b = arr[Math.min(i + 1, arr.length - 1)]
  const span = Math.max(1e-5, b.t - a.t)
  const tt = Math.min(1, Math.max(0, (t - a.t) / span))
  return [a, b, tt] as const
}

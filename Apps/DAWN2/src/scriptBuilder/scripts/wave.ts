import * as THREE from 'three'

export type WaveProc = {
  start: () => void
  update: (dt: number) => void
  stop: () => void
}

export function createWave(root: THREE.Object3D): WaveProc {
  const bones: THREE.Bone[] = []
  root.traverse(o => { if ((o as any).isBone) bones.push(o as THREE.Bone) })

  const find = (...cands: string[]) =>
    bones.find(b => cands.some(c => b.name.toLowerCase().includes(c))) || null

  // heuristics used in your JS version
  const upper = find('rightarm','upperarm.r','upperarm','r_arm')
  const fore  = find('rightforearm','forearm.r','lowerarm','r_forearm')
  const hand  = find('r_hand','hand.r','r_wrist','righthand','right_wrist')

  const targets = [upper, fore, hand].filter(Boolean) as THREE.Bone[]
  const rest = new Map<THREE.Bone, THREE.Quaternion>()
  for (const b of targets) rest.set(b, b.quaternion.clone())

  let t = 0
  const amp = 0.35
  const speed = 2.5
  const vX = new THREE.Vector3(1,0,0)
  const vZ = new THREE.Vector3(0,0,1)

  return {
    start(){ /* no-op */ },
    update(dt: number){
      t += dt * speed * Math.PI * 2
      const s  = Math.sin(t)
      const s2 = Math.sin(t * 0.5)
      targets.forEach((b, i) => {
        const r = rest.get(b)!.clone()
        const dqZ = new THREE.Quaternion().setFromAxisAngle(vZ, amp * s * (0.6 + 0.2*i))
        const dqX = new THREE.Quaternion().setFromAxisAngle(vX, 0.12 * s2 * (1 - 0.3*i))
        r.multiply(dqZ).multiply(dqX)
        b.quaternion.copy(r)
        b.updateMatrixWorld(true)
      })
    },
    stop(){
      targets.forEach(b => {
        const r = rest.get(b); if (r) b.quaternion.copy(r)
        b.updateMatrixWorld(true)
      })
    }
  }
}

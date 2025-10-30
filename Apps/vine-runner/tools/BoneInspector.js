// tools/BoneInspector.js
import * as THREE from 'three'

export function analyzeSkeleton(root) {
  const skinned = []
  root.traverse(o => { if (o.isSkinnedMesh) skinned.push(o) })
  const mesh = skinned[0] || null
  const skeleton = mesh?.skeleton || null
  const bones = skeleton ? skeleton.bones : []
  const boneMap = {}
  bones.forEach(b => boneMap[b.name] = b)
  return { mesh, skeleton, bones, boneCount: bones.length, boneMap }
}

export function attachSkeletonHelper(scene, root, color = 0x3ee7ff) {
  let target = null
  root.traverse(o => { if (!target && o.isSkinnedMesh) target = o })
  if (!target) return null
  const helper = new THREE.SkeletonHelper(target)
  helper.material.linewidth = 2
  helper.material.color = new THREE.Color(color)
  scene.add(helper)
  return helper
}

export function findBone(root, namePart) {
  const res = []
  const lc = namePart.toLowerCase()
  root.traverse(o => { if (o.isBone && o.name.toLowerCase().includes(lc)) res.push(o) })
  return res
}

export function mapClips(clips) {
  const by = k => clips?.find(c => c.name.toLowerCase().includes(k))
  return {
    idle: by('idle'),
    walk: by('walk'),
    run:  by('run'),
    jump: by('jump') || by('flip') || by('air'),
  }
}

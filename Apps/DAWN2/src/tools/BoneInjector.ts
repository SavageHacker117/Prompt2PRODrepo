// src/tools/BoneInjector.ts
import * as THREE from 'three'

export type InjectOptions = {
  /** number of bones in the chain (>=2) */
  bones?: number
  /** override axis selection; by default we use the longest axis of the whole object */
  axis?: 'x' | 'y' | 'z'
  /** attach a SkeletonHelper (debug) */
  helper?: boolean
}

/** Quick probe: does this object already contain a SkinnedMesh? */
export function hasSkinning(root: THREE.Object3D): boolean {
  let yes = false
  root.traverse((o: any) => { if (o.isSkinnedMesh) yes = true })
  return yes
}

/**
 * Injects a simple spine rig into every *non‑skinned* Mesh under `root`.
 * The new bones are placed along the longest axis of the object's world AABB.
 * Returns number of meshes rigged.
 */
export function injectSimpleSpineRig(
  root: THREE.Object3D,
  opts: InjectOptions = {}
): number {
  const countBones = Math.max(2, Math.floor(opts.bones ?? 6))

  // Object-space bounds (world) for the whole subtree
  const worldBox = new THREE.Box3().setFromObject(root)
  const size = worldBox.getSize(new THREE.Vector3())
  const pickAxis =
    opts.axis ||
    (size.x >= size.y && size.x >= size.z ? 'x' : size.y >= size.z ? 'y' : 'z')

  const axisIndex = pickAxis === 'x' ? 0 : pickAxis === 'y' ? 1 : 2
  const minW = worldBox.min.getComponent(axisIndex)
  const maxW = worldBox.max.getComponent(axisIndex)
  const spanW = Math.max(1e-6, maxW - minW)

  // Used when converting local vertex -> world
  const vWorld = new THREE.Vector3()

  let rigged = 0

  root.traverse((node: any) => {
    if (!node.isMesh || node.isSkinnedMesh || !node.geometry) return
    const geom = node.geometry as THREE.BufferGeometry
    const pos = geom.getAttribute('position') as THREE.BufferAttribute
    if (!pos) return

    // 1) Build a bone chain under this mesh
    const bones: THREE.Bone[] = []
    let parent: THREE.Bone | null = null
    const chainLength = spanW
    for (let i = 0; i < countBones; i++) {
      const b = new THREE.Bone()
      if (parent) parent.add(b)
      bones.push(b)
      parent = b
      if (i < countBones - 1) {
        const step = chainLength / (countBones - 1)
        const p = new THREE.Vector3()
        p.setComponent(axisIndex, step)
        b.position.add(p)
      }
    }

    const skinned = new THREE.SkinnedMesh(
      geom.clone(), // clone so we don't mutate any shared buffer
      node.material
    )
    skinned.name = node.name || 'Skinned'
    // put skinned where the original was
    skinned.matrixWorld.copy(node.matrixWorld)
    skinned.position.copy(node.position)
    skinned.rotation.copy(node.rotation)
    skinned.scale.copy(node.scale)

    // Place a root for bones at the min bound on that axis (in mesh local)
    const rootBone = bones[0]
    // We keep bone root at (0,0,0) relative to the mesh, and emulate spacing by the `step` above.
    // This keeps bind matrices easy.

    const skeleton = new THREE.Skeleton(bones)
    skinned.add(rootBone)
    skinned.bind(skeleton)

    // 2) Create skinIndex / skinWeight from world‑space interpolation along axis
    const skinIndex = new THREE.Uint16BufferAttribute(new Uint16Array(pos.count * 4), 4)
    const skinWeight = new THREE.Float32BufferAttribute(new Float32Array(pos.count * 4), 4)

    for (let i = 0; i < pos.count; i++) {
      vWorld.fromBufferAttribute(pos, i).applyMatrix4(node.matrixWorld)
      // normalized position along chosen axis
      const t = THREE.MathUtils.clamp((vWorld.getComponent(axisIndex) - minW) / spanW, 0, 1)
      const f = t * (countBones - 1)
      const i0 = Math.floor(f)
      const i1 = Math.min(countBones - 1, i0 + 1)
      const a = f - i0 // weight towards the next bone

      skinIndex.setXYZW(i, i0, i1, 0, 0)
      skinWeight.setXYZW(i, 1 - a, a, 0, 0)
    }

    skinned.geometry.setAttribute('skinIndex', skinIndex)
    skinned.geometry.setAttribute('skinWeight', skinWeight)

    // 3) Replace original mesh with skinned
    const parentObj = node.parent
    if (!parentObj) return
    const idx = parentObj.children.indexOf(node)
    parentObj.remove(node)
    parentObj.add(skinned)
    if (idx >= 0) parentObj.children.splice(idx, 0, skinned)

    // optional helper
    if (opts.helper) {
      const helper = new (THREE as any).SkeletonHelper(skinned)
      helper.frustumCulled = false
      parentObj.add(helper)
    }

    rigged++
  })

  return rigged
}

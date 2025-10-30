import * as THREE from 'three'

// Reuse textures for all blocks (loaded once)
const tl = new THREE.TextureLoader()
const stoneDiffuse = tl.load('./assets/textures/tpk1/textures/stone/stone_block_diffuse_1024.png')
const stoneNormal  = tl.load('./assets/textures/tpk1/textures/stone/stone_block_normal_1024.png')
const stoneRough   = tl.load('./assets/textures/tpk1/textures/stone/stone_block_roughness_1024.png')

stoneDiffuse.colorSpace = THREE.SRGBColorSpace
stoneDiffuse.wrapS = stoneDiffuse.wrapT = THREE.RepeatWrapping
stoneNormal.wrapS  = stoneNormal.wrapT  = THREE.RepeatWrapping
stoneRough.wrapS   = stoneRough.wrapT   = THREE.RepeatWrapping

class Block {
  constructor(scene, { x, y, z, w, h, d }) {
    this.type = 'block'

    const geo = new THREE.BoxGeometry(w, h, d)
    const mat = new THREE.MeshStandardMaterial({
      map: stoneDiffuse,
      normalMap: stoneNormal,
      roughnessMap: stoneRough,
      roughness: 1
    })

    this.mesh = new THREE.Mesh(geo, mat)
    this.mesh.position.set(x, y + h * 0.5, z)
    this.mesh.castShadow = true
    this.mesh.receiveShadow = true

    // Used by Interaction/raycaster to identify the owning obstacle
    this.mesh.userData.owner = this

    scene.add(this.mesh)
    this.bounds = new THREE.Box3().setFromObject(this.mesh)
  }

  intersectsAABB(aabb) { return aabb.intersectsBox(this.bounds) }

  dispose() {
    // Safe disposal (materials share texture objects; we don't dispose maps here)
    this.mesh.geometry.dispose()
    if (Array.isArray(this.mesh.material)) {
      this.mesh.material.forEach(m => m.dispose())
    } else {
      this.mesh.material.dispose()
    }
    this.mesh.removeFromParent()
  }
}

class Spikes {
  constructor(scene, { x, z, count = 3, spacing = 1.0 }) {
    this.type = 'spikes'
    this.group = new THREE.Group()

    const spikeGeo = new THREE.ConeGeometry(0.35, 0.8, 6)
    const spikeMat = new THREE.MeshStandardMaterial({
      color: 0xff5d5d,
      roughness: 0.5,
      metalness: 0.2
    })

    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(spikeGeo, spikeMat)
      m.position.set(x + i * spacing, 0.4, z)
      m.castShadow = true
      m.receiveShadow = true
      this.group.add(m)
    }

    scene.add(this.group)
    this.bounds = new THREE.Box3().setFromObject(this.group)
  }

  intersectsAABB(aabb) { return aabb.intersectsBox(this.bounds) }

  dispose() {
    this.group.traverse(o => {
      if (o.isMesh) {
        o.geometry.dispose()
        if (Array.isArray(o.material)) o.material.forEach(m => m.dispose())
        else o.material.dispose()
      }
    })
    this.group.removeFromParent()
  }
}

class Pit {
  constructor(scene, { fromX, toX, yThreshold = 0.2 }) {
    this.type = 'pit'
    this.zMin = -6
    this.zMax = 6
    this.yThreshold = yThreshold

    const g = new THREE.BoxGeometry(toX - fromX, 0.1, 10)
    const m = new THREE.MeshStandardMaterial({ color: 0x0a0f14, roughness: 1 })
    this.mesh = new THREE.Mesh(g, m)
    this.mesh.position.set((fromX + toX) * 0.5, 0.05, 0)
    this.mesh.receiveShadow = true
    scene.add(this.mesh)
  }

  dispose() {
    this.mesh.geometry.dispose()
    if (Array.isArray(this.mesh.material)) this.mesh.material.forEach(m => m.dispose())
    else this.mesh.material.dispose()
    this.mesh.removeFromParent()
  }
}

export const ObstacleFactory = {
  block(scene, def) { return new Block(scene, def) },
  spikes(scene, def) { return new Spikes(scene, def) },
  pit(scene, def) { return new Pit(scene, def) },
}

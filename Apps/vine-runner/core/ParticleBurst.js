import * as THREE from 'three'

export class ParticleBurst {
  constructor(scene, texture) {
    this.scene = scene
    this.tex = texture
  }

  spawn(pos, color = 0xffffff, count = 24) {
    const positions = new Float32Array(count * 3)
    const velocities = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
      positions[i*3+0] = pos.x; positions[i*3+1] = pos.y; positions[i*3+2] = pos.z
      const theta = Math.random() * Math.PI * 2, speed = 2 + Math.random() * 5
      const up = 0.5 + Math.random() * 1.5
      velocities[i*3+0] = Math.cos(theta) * speed
      velocities[i*3+1] = up
      velocities[i*3+2] = Math.sin(theta) * speed
    }

    const geom = new THREE.BufferGeometry()
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geom.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3))

    const mat = new THREE.PointsMaterial({
      map: this.tex, transparent: true, depthWrite: false,
      color, size: 0.15, blending: THREE.AdditiveBlending
    })

    const points = new THREE.Points(geom, mat)
    points.userData.life = 0.5
    this.scene.add(points)

    // ✅ Arrow fn captures `points` and class `this`
    points.userData.update = (dt) => {
      if (!points.geometry) return // already disposed

      const pos = points.geometry.attributes.position
      const vel = points.geometry.attributes.velocity

      for (let i = 0; i < pos.count; i++) {
        vel.array[i*3+1] -= 9.8 * dt * 0.7
        pos.array[i*3+0] += vel.array[i*3+0] * dt
        pos.array[i*3+1] += vel.array[i*3+1] * dt
        pos.array[i*3+2] += vel.array[i*3+2] * dt
      }
      pos.needsUpdate = true

      points.userData.life -= dt
      if (points.userData.life <= 0) {
        this.scene.remove(points)
        points.geometry.dispose()
        points.material.dispose()
      }
    }

    return points
  }
}

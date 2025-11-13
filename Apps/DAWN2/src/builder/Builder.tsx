import React, { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useWorld } from '../state/world'
import type { Block } from '../state/world'

const SNAP = 1
const snap = (v: THREE.Vector3) =>
  new THREE.Vector3(
    Math.round(v.x / SNAP) * SNAP,
    Math.round(v.y / SNAP) * SNAP,
    Math.round(v.z / SNAP) * SNAP
  )

const yOffset = (type: 'block' | 'platform' | 'ramp', size: [number, number, number]) =>
  type === 'platform' ? 0.125 : size[1] / 2

function isQuarterTurn(rotY = 0) {
  // swap X/Z when rotated by 90° increments
  const k = Math.round(rotY / (Math.PI / 2))
  return Math.abs(k % 2) === 1
}

function footprintContains(b: Block, x: number, z: number) {
  const sx = b.size[0]
  const sz = b.size[2]
  const swap = isQuarterTurn(b.rotY || 0)
  const hx = (swap ? sz : sx) / 2
  const hz = (swap ? sx : sz) / 2
  return (x >= b.pos[0] - hx && x <= b.pos[0] + hx && z >= b.pos[2] - hz && z <= b.pos[2] + hz)
}

function blockTopY(b: Block) {
  const h = b.type === 'platform' ? 0.25 : b.size[1]
  return b.pos[1] + h
}

export default function Builder() {
  const planeRef = useRef<THREE.Mesh>(null!)
  const ghostRef = useRef<THREE.Mesh>(null!)
  const { camera, raycaster } = useThree()

  const hovered = useWorld(s => s.hovered)
  const blocks = useWorld(s => s.blocks)
  const setHover = useWorld(s => s.setHover)
  const addBlock = useWorld(s => s.addBlock)
  const removeAt = useWorld(s => s.removeAt)
  const rotY = useWorld(s => s.rotY)
  const palette = useWorld(s => s.palette)
  const selectOnly = useWorld(s => s.selectOnly)
  const toggleSelect = useWorld(s => s.toggleSelect)

  function computeSnapBaseY(x: number, z: number) {
    // Find the *highest top surface* under x/z
    let base = 0
    for (const b of blocks) {
      if (footprintContains(b, x, z)) {
        base = Math.max(base, blockTopY(b))
      }
    }
    return base
  }

  useFrame(({ pointer }) => {
    const plane = planeRef.current
    if (!plane) return
    raycaster.setFromCamera(pointer, camera)
    const hits = raycaster.intersectObject(plane)
    if (hits[0]) {
      const p = snap(hits[0].point.clone())
      const baseY = Math.max(0, computeSnapBaseY(p.x, p.z))
      p.y = baseY
      setHover([p.x, p.y, p.z])
      if (ghostRef.current) {
        ghostRef.current.position.set(p.x, p.y + yOffset(palette.type, palette.size), p.z)
        ghostRef.current.rotation.y = rotY
        ghostRef.current.visible = true
      }
    } else {
      setHover(null)
      if (ghostRef.current) ghostRef.current.visible = false
    }
  })

  const onClick = (e: any) => {
    e.stopPropagation()
    // If a block mesh was clicked, update selection instead of placing
    const intersects = e.intersections?.filter((i: any) => i.object !== planeRef.current) || []
    if (intersects.length) {
      const id = intersects[0].object?.userData?.blockId
      if (id) { if (e.shiftKey) toggleSelect(id); else selectOnly(id); return }
    }
    if (!hovered) return
    addBlock({ pos: hovered })
  }

  const onContextMenu = (e: any) => {
    e.stopPropagation()
    const nev: any = (e && 'nativeEvent' in e) ? e.nativeEvent : e
    if (nev && typeof nev.preventDefault === 'function') nev.preventDefault()
    if (!hovered) return
    removeAt(hovered)
  }

  const ghostGeom = useMemo(() => {
    return palette.type === 'platform'
      ? new THREE.BoxGeometry(palette.size[0], 0.25, palette.size[2])
      : new THREE.BoxGeometry(palette.size[0], palette.size[1], palette.size[2])
  }, [palette])

  return (
    <group>
      <mesh
        ref={planeRef}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={onClick}
        onContextMenu={onContextMenu}
      >
        <planeGeometry args={[5000, 5000]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      <mesh ref={ghostRef} visible={false}>
        <primitive attach="geometry" object={ghostGeom} />
        <meshStandardMaterial color="#7aa2ff" roughness={1} metalness={0} transparent opacity={0.35} />
      </mesh>
    </group>
  )
}

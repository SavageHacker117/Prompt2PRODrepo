import React, { useMemo } from 'react'
import * as THREE from 'three'
import { ThreeEvent } from '@react-three/fiber'
import { useWorld } from '../state/world'

type BlockType = 'block' | 'platform' | 'ramp'

// keep feet on ground for each type
const yOffset = (type: BlockType, size: [number, number, number]) =>
  type === 'platform' ? 0.125 : size[1] / 2

function BlockItem({ id }: { id: string }) {
  const block = useWorld(s => s.blocks.find(b => b.id === id))!
  const selectedIds = useWorld(s => s.selectedIds)
  const selectOnly = useWorld(s => s.selectOnly)
  const toggleSelect = useWorld(s => s.toggleSelect)
  const removeById = useWorld(s => s.removeById)

  const isSelected = selectedIds.includes(block.id)

  const geom = useMemo(() => {
    if (block.type === 'platform') return new THREE.BoxGeometry(block.size[0], 0.25, block.size[2])
    // (optional future) ramp geometry here
    return new THREE.BoxGeometry(block.size[0], block.size[1], block.size[2])
  }, [block.type, block.size[0], block.size[1], block.size[2]])

  const pos: [number, number, number] = [
    block.pos[0],
    block.pos[1] + yOffset(block.type, block.size),
    block.pos[2],
  ]

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (e.shiftKey) toggleSelect(block.id)
    else selectOnly(block.id)
  }

  const onContextMenu = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    // nativeEvent check guards R3F raycast synthetic events
    const nev: any = (e && 'nativeEvent' in e) ? (e as any).nativeEvent : e
    if (nev?.preventDefault) nev.preventDefault()
    removeById(block.id)
  }

  return (
    <group position={pos} rotation={[0, block.rotY || 0, 0]}>
      {/* MAIN MESH — never hide on select */}
      <mesh
        userData={{ blockId: block.id }}
        onClick={onClick}
        onContextMenu={onContextMenu}
        castShadow
        receiveShadow
      >
        <primitive attach="geometry" object={geom} />
        <meshStandardMaterial
          color={block.color || '#445'}
          metalness={0}
          roughness={1}
        />
      </mesh>

      {/* SELECTION OVERLAY — subtle, no z-fighting */}
      {isSelected && (
        <lineSegments renderOrder={999}>
          <edgesGeometry args={[geom]} />
          <lineBasicMaterial color="#ffd166" />
        </lineSegments>
      )}
    </group>
  )
}

export default function BlocksRenderer() {
  const blocks = useWorld(s => s.blocks)
  return (
    <group>
      {blocks.map(b => (
        <BlockItem key={b.id} id={b.id} />
      ))}
    </group>
  )
}

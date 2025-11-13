// src/components/Scene.tsx
import React from 'react'
import { Grid } from '@react-three/drei'
import GLBinject, { InjectedActorsHost } from './models/GLBinject'
import BlocksRenderer from '../builder/Blocks'
import Builder from '../builder/Builder'
import { useWorld } from '../state/world'

export default function Scene() {
  const mode = useWorld(s => s.mode)

  return (
    <group>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0, 0]}>
        <planeGeometry args={[1000, 1000]} />
        <meshStandardMaterial color="#0e1116" metalness={0} roughness={1} />
      </mesh>

      {/* Grid */}
      <Grid args={[100, 100]} position={[0, 0, 0]} infiniteGrid cellSize={1} sectionColor="#2a2f3a" />

      {/* World blocks */}
      <BlocksRenderer />

      {/* Default actor */}
      <GLBinject url="/assets/models/actors/rose.glb" />

      {/* Dynamic actors spawned from UI / engine */}
      <InjectedActorsHost />

      {/* World builder only in Edit mode */}
      {mode === 'edit' && <Builder />}
    </group>
  )
}

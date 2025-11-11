import React, { useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Sky } from '@react-three/drei'
import Scene from './components/Scene'
import { DebugConsole, useDebugConsole } from './console/DebugConsole'
import { registerGrammars } from './grammars'              // <- TS index (no .js)
import { registerWorldGrammar } from './grammars/world'    // <- world grammar (reset, etc.)
import HUD from './components/ui/HUD'
import { useKeys } from './input/useKeys'

export default function App() {
  const dbg = useDebugConsole()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Ensure a single shared engine object exists for grammars / panels.
    const engine = ((window as any).__engine ||= {})

    // Register console grammars (anim, pad, env, puppet, etc.)
    registerGrammars(dbg, engine, {}, { animPanel: (window as any).__animPanel })

    // Register world grammar (e.g., `world reset`)
    // Signature supports either (dbg) or (dbg, engine); call whichever exists.
    try {
      // @ts-ignore – tolerate either signature
      registerWorldGrammar?.(dbg, engine)
    } catch {
      registerWorldGrammar?.(dbg as any)
    }

    setReady(true)
  }, [dbg])

  // Global hotkeys (Tab to toggle edit/play, etc.)
  useKeys()

  return (
    <>
      <div className="overlay">DAWN • ROSE — press ` for console • Tab toggles Play/Edit</div>
      <Canvas shadows camera={{ position: [4, 2, 6], fov: 50 }}>
        <Sky distance={450000} sunPosition={[1, 1, 1]} inclination={0.49} azimuth={0.25} />
        <ambientLight intensity={0.3} />
        <directionalLight
          position={[5, 8, 5]}
          intensity={1.0}
          castShadow
          shadow-mapSize={[2048, 2048]}
        />
        <Scene />
        <OrbitControls makeDefault />
      </Canvas>
      <HUD />
      {ready && <DebugConsole />}
    </>
  )
}

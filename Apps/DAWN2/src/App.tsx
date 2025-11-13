import React, { useEffect, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Sky } from '@react-three/drei'
import Scene from './components/Scene'
import { DebugConsole, useDebugConsole } from './console/DebugConsole'
import { registerGrammars } from './grammars'
import { registerWorldGrammar } from './grammars/world'
import HUD from './components/ui/HUD'
import { useKeys } from './input/useKeys'
import { initSpawnSystem } from './runtime/scene/SpawnSystem'

/** Bridge R3F <-> engine: tick loop + picking + globals */
function EngineBridge() {
  const { gl, scene, camera, raycaster } = useThree()

  // expose three bits + scene for tools/HUD
  useEffect(() => {
    ;(window as any).__three = { gl, scene, camera, raycaster }
    ;(window as any).__scene = scene
    ;(window as any).__camera = camera
    ;((window as any).__engine ||= {}).scene = scene

    const dom = gl.domElement

    const findPickRoot = (o: THREE.Object3D | null): THREE.Object3D | null => {
      let p: any = o
      while (p) {
        if (p.userData?.pickRoot) return p.userData.pickRoot as THREE.Object3D
        if (p.userData?.isActorRoot || p.userData?.actorId || p.userData?.spawnId) return p as THREE.Object3D
        p = p.parent
      }
      return null
    }

    const onPointerDown = (e: PointerEvent) => {
      // Ctrl + LeftClick selects an actor/object in the scene
      if (!(e.ctrlKey && e.button === 0)) return
      const r = dom.getBoundingClientRect()
      const ndc = new THREE.Vector2(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        -((e.clientY - r.top) / r.height) * 2 + 1
      )
      raycaster.setFromCamera(ndc, camera)
      const hits = raycaster.intersectObjects(scene.children, true)
      let picked: THREE.Object3D | null = null
      for (const h of hits) {
        picked = findPickRoot(h.object)
        if (picked) break
      }
      if (picked) {
        const eng = (window as any).__engine || {}
        eng.selected = picked
        if (typeof eng.select === 'function') eng.select(picked)
        window.dispatchEvent(new CustomEvent('engine:select', { detail: { object: picked } }))
      }
    }

    dom.addEventListener('pointerdown', onPointerDown)
    return () => dom.removeEventListener('pointerdown', onPointerDown)
  }, [gl, scene, camera, raycaster])

  // spawn system once scene exists
  useEffect(() => {
    const eng = ((window as any).__engine ||= {})
    if (!eng.spawns) initSpawnSystem(eng)
  }, [scene])

  // per-frame tick: systems, agents, custom engine.tick
  useFrame((state, dt) => {
    const eng = (window as any).__engine || {}
    try { eng.systems?.forEach((s: any) => s?.update?.(dt, state)) } catch {}
    try { eng.navAgents?.forEach((a: any) => a?.update?.(dt, state)) } catch {}
    try { eng.tick?.(dt, state) } catch {}
  })

  return null
}

export default function App() {
  const dbg = useDebugConsole()
  const [ready, setReady] = useState(false)
  const [showConsole, setShowConsole] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem('hud-ui-options-v1')
      return raw ? JSON.parse(raw).showConsole !== false : true
    } catch { return true }
  })

  // bring grammars online and hand them engine refs
  useEffect(() => {
    const engine = ((window as any).__engine ||= {})
    registerGrammars(dbg, engine, {}, { animPanel: (window as any).__animPanel })
    try { registerWorldGrammar?.(dbg, engine) } catch { registerWorldGrammar?.(dbg as any) }
    setReady(true)
  }, [dbg])

  // Global hotkeys not owned by HUD
  useKeys()

  // renderer options pushed by HUD
  useEffect(() => {
    const handler = (e: any) => {
      const gl: THREE.WebGLRenderer | undefined = (window as any).__renderer
      if (!gl) return
      const { type, value } = e.detail || {}
      if (type === 'pixelRatio') {
        gl.setPixelRatio(value === 'auto' ? window.devicePixelRatio : value)
      } else if (type === 'shadows') {
        if (value === 'off') {
          gl.shadowMap.enabled = false
        } else {
          gl.shadowMap.enabled = true
          gl.shadowMap.type = value === 'pcfsoft' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap
        }
      } else if (type === 'exposure') {
        gl.toneMappingExposure = value
      } else if (type === 'showConsole') {
        setShowConsole(!!value)
      }
    }
    window.addEventListener('ui:renderer', handler as any)
    return () => window.removeEventListener('ui:renderer', handler as any)
  }, [])

  // keep showConsole in sync even if HUD only updates localStorage
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'hud-ui-options-v1' && e.newValue) {
        try { setShowConsole(JSON.parse(e.newValue).showConsole !== false) } catch {}
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  return (
    <>
      <Canvas
        shadows
        camera={{ position: [4, 2, 6], fov: 50 }}
        onCreated={({ gl }) => {
          ;(window as any).__renderer = gl
          gl.outputColorSpace = THREE.SRGBColorSpace
          gl.toneMapping = THREE.ACESFilmicToneMapping
        }}
      >
        <Sky distance={450000} sunPosition={[1, 1, 1]} inclination={0.49} azimuth={0.25} />
        <ambientLight intensity={0.3} />
        <directionalLight position={[5, 8, 5]} intensity={1.0} castShadow shadow-mapSize={[2048, 2048]} />
        <Scene />
        <EngineBridge />
        <OrbitControls makeDefault />
      </Canvas>

      <HUD />
      {ready && showConsole && <DebugConsole />}
    </>
  )
}

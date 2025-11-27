// src/App.tsx
import React, { useEffect, useState, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Sky } from '@react-three/drei'

import Scene from './components/Scene'
import { DebugConsole, useDebugConsole } from './console/DebugConsole'
import { registerGrammars } from './grammars'
import { registerWorldGrammar } from './grammars/world'
import HUD from './components/ui/HUD'
import PerfHUD from './components/ui/HUD/PerfHUD'
import { useKeys } from './input/useKeys'
import { initSpawnSystem } from './runtime/scene/SpawnSystem'
import { InjectedActorsHost } from './components/models/GLBinject'
import { applyQualityPreset, getQualityPreset, type QualityPresetName } from './engine/perf'

/** Coerce possibly-nullish or non-iterable to array */
function toArray<T = any>(v: any): T[] {
  if (!v) return []
  if (Array.isArray(v)) return v as T[]
  if (v instanceof Set) return Array.from(v) as T[]
  return []
}

/** Ensure engine collections exist and support `.add` (as Set) */
function ensureEngineCollections(engine: any) {
  if (!(engine.systems instanceof Set)) {
    engine.systems = new Set(toArray(engine.systems))
  }
  if (!(engine.navAgents instanceof Set)) {
    engine.navAgents = new Set(toArray(engine.navAgents))
  }
}

/** Ocean install (safe to call repeatedly; no throws bubble) */
async function tryInstallOceanOnce() {
  const engine: any = (window as any).__engine
  if (!engine) return
  if (engine._oceanInstalling || engine._oceanInstalled) return
  if (!engine.renderer || !engine.scene || !engine.camera) return

  engine._oceanInstalling = true
  try {
    const mod = await import('./ISS/Ocean/OceanPlugin')
    const OceanPlugin = mod.OceanPlugin

    engine.iss ||= {}
    const plugin = new OceanPlugin({
      renderer: engine.renderer as THREE.WebGLRenderer,
      scene: engine.scene as THREE.Scene,
      camera: engine.camera as THREE.Camera,
      enableCaustics: false,
    })

    engine.iss.ocean = plugin
    ensureEngineCollections(engine)
    engine.systems.add({
      name: 'ocean',
      update(dt: number) {
        try {
          plugin.update(dt)
        } catch (err) {
          // keep the frame alive
          console.warn('[sea] update error:', err)
        }
      },
    })

    engine._oceanInstalled = true
    window.dispatchEvent(new CustomEvent('sea:ready'))
  } catch (err) {
    console.warn('[ISS] Ocean install failed:', err)
  } finally {
    engine._oceanInstalling = false
  }
}

/** Optional, small debug tap to make shader issues easier to inspect */
function installRendererDebugTaps(gl: THREE.WebGLRenderer) {
  try {
    // Overall render info won’t auto-reset; you can check from console
    gl.info.autoReset = false
    ;(gl as any).debug ||= {}
    // Make sure shader error checks are on in dev (they usually are)
    gl.debug.checkShaderErrors = true

    // Expose contexts for quick spelunking in DevTools
    ;(window as any).__renderer = gl
    ;(window as any).__gl = gl.getContext?.()
  } catch {}
}

/** Bridge R3F <-> engine */
function EngineBridge() {
  const { gl, scene, camera, raycaster } = useThree()

  useEffect(() => {
    const engine = ((window as any).__engine ||= {})
    engine.scene = scene
    engine.camera = camera
    engine.raycaster = raycaster
    engine.dom = gl.domElement
    engine.renderer = gl

    ;(window as any).__three = { gl, scene, camera, raycaster }
    ;(window as any).__scene = scene
    ;(window as any).__camera = camera

    ensureEngineCollections(engine)
    installRendererDebugTaps(gl)

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
        -((e.clientY - r.top) / r.height) * 2 + 1,
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
        try {
          if (typeof eng.select === 'function') eng.select(picked)
        } catch {}
        window.dispatchEvent(new CustomEvent('engine:select', { detail: { object: picked } }))
      }
    }

    dom.addEventListener('pointerdown', onPointerDown)

    if (!engine._spawnsInstalled) {
      try {
        initSpawnSystem({ scene, camera, dom } as any)
        engine._spawnsInstalled = true
      } catch (err) {
        console.warn('[engine] spawn init failed:', err)
      }
    }

    // Ocean tries – safe to call; no-ops until renderer/scene/camera exist
    tryInstallOceanOnce()

    return () => {
      dom.removeEventListener('pointerdown', onPointerDown)
    }
  }, [gl, scene, camera, raycaster])

  // Per-frame ticks (Arrays or Sets supported)
  useFrame((state, dt) => {
    const eng = (window as any).__engine || {}

    const systems = toArray<any>(eng.systems)
    for (let i = 0; i < systems.length; i++) {
      try {
        systems[i]?.update?.(dt, state)
      } catch {
        // keep frame going
      }
    }

    const agents = toArray<any>(eng.navAgents)
    for (let i = 0; i < agents.length; i++) {
      try {
        agents[i]?.update?.(dt, state)
      } catch {}
    }

    try {
      eng.tick?.(dt, state)
    } catch {}
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
    } catch {
      return true
    }
  })

  // main directional light ref (for quality presets / perf tools)
  const mainLightRef = useRef<THREE.DirectionalLight | null>(null)
  const [rendererReady, setRendererReady] = useState(false)
  const [qualityPreset, setQualityPresetState] = useState<QualityPresetName>(() => {
    try {
      return getQualityPreset()
    } catch {
      return 'balanced'
    }
  })

  // Grammars & engine wiring
  useEffect(() => {
    const engine = ((window as any).__engine ||= {})
    ensureEngineCollections(engine)

    // quality API on engine: engine.quality.set('low'|'balanced'|'high')
    engine.quality ||= {}
    engine.quality.current = qualityPreset
    engine.quality.set = (name: QualityPresetName) => {
      setQualityPresetState(name)
    }

    registerGrammars(dbg, engine, {}, { animPanel: (window as any).__animPanel })
    try {
      registerWorldGrammar?.(dbg, engine)
    } catch {
      registerWorldGrammar?.(dbg as any)
    }
    setReady(true)
  }, [dbg, qualityPreset])

  // keep mainLight on engine for perf helpers / grammars
  useEffect(() => {
    const engine = ((window as any).__engine ||= {})
    engine.mainLight = mainLightRef.current || undefined
  }, [rendererReady])

  // Apply quality whenever renderer, light and preset are ready
  useEffect(() => {
    const gl: THREE.WebGLRenderer | undefined = (window as any).__renderer
    const engine = (window as any).__engine || {}
    if (!rendererReady || !gl) return

    applyQualityPreset(qualityPreset, {
      renderer: gl,
      mainLight: mainLightRef.current,
      engine,
    })
  }, [qualityPreset, rendererReady])

  // Global hotkeys not owned by HUD
  useKeys()

  // Renderer options pushed by HUD (pixelRatio, shadows, exposure, showConsole, quality)
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
          gl.shadowMap.type =
            value === 'pcfsoft' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap
        }
      } else if (type === 'exposure') {
        gl.toneMappingExposure = value
      } else if (type === 'showConsole') {
        setShowConsole(!!value)
      } else if (type === 'quality') {
        // from HUD Options GPU Quality dropdown
        setQualityPresetState(value as QualityPresetName)
      }
    }
    window.addEventListener('ui:renderer', handler as any)
    return () => window.removeEventListener('ui:renderer', handler as any)
  }, [])

  // keep showConsole synced with localStorage
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'hud-ui-options-v1' && e.newValue) {
        try {
          setShowConsole(JSON.parse(e.newValue).showConsole !== false)
        } catch {}
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

          // make sure engine exists and retry ocean
          const engine = ((window as any).__engine ||= {})
          engine.renderer = gl
          ensureEngineCollections(engine)
          installRendererDebugTaps(gl)
          tryInstallOceanOnce()

          setRendererReady(true)

          // initial quality application (safe even if light/ocean not ready)
          applyQualityPreset(qualityPreset, {
            renderer: gl,
            mainLight: mainLightRef.current,
            engine,
          })
        }}
      >
        <Sky distance={450000} sunPosition={[1, 1, 1]} inclination={0.49} azimuth={0.25} />
        <ambientLight intensity={0.3} />
        <directionalLight
          ref={mainLightRef}
          position={[5, 8, 5]}
          intensity={1.0}
          castShadow
          shadow-mapSize={[2048, 2048]}
        />
        <Scene />
        <InjectedActorsHost /> {/* renders actors spawned via engine.spawnActor (meme / manual) */}
        <EngineBridge />
        <OrbitControls makeDefault />
      </Canvas>

      <HUD />
      <PerfHUD />
      {ready && showConsole && <DebugConsole />}
    </>
  )
}

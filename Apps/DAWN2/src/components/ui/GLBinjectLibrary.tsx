// src/components/models/GLBinject.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useAnimations, useGLTF } from '@react-three/drei'
import { analyzeSkeleton, attachSkeletonHelper, mapClips } from '../../tools/BoneInspector'
import { createWave } from '../../scriptBuilder/scripts/wave'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'

export type GLBinjectProps = {
  url: string
  id?: string
  name?: string
  position?: [number, number, number]
  rotationY?: number
  showHelper?: boolean
  enableWave?: boolean
  /** visual wobble via shader injection (off by default) */
  enablePulse?: boolean
  /** multiply-color on materials that look like skin/body */
  tint?: string | null
}

type PanelAPI = {
  __uiToggle?: () => boolean
  _updateClips?: (names: string[]) => void
  list?: () => string[]
  play?: (name: string) => boolean
  fadeTo?: (name: string, t?: number) => boolean
  stop?: (name?: string) => boolean
  speed?: (v: number) => boolean
  weight?: (v: number) => boolean
  loop?: (onoff: 'on' | 'off') => boolean
  current?: () => string
  _getSelectedAction?: () => THREE.AnimationAction | null
}

// ---------- safe shader wobble (off by default) ----------
function installPulseWobble(
  root: THREE.Object3D,
  bag: Array<{ uniforms: { uPulse: { value: number } } }>
) {
  root.traverse((o: any) => {
    if (!o.material) return
    const mats: any[] = Array.isArray(o.material) ? o.material : [o.material]

    for (const mat of mats) {
      // don’t re-install
      if (mat.userData?.__pulseInstalled) continue

      const origOBC = mat.onBeforeCompile
      mat.onBeforeCompile = (shader: any) => {
        // keep any previous customizations
        origOBC && origOBC(shader)

        // 1) declare the uniform in a section that ALWAYS exists
        shader.vertexShader = shader.vertexShader.replace(
          '#include <common>',
          `#include <common>\nuniform float uPulse;`
        )

        // 2) add the wobble after "begin_vertex"
        shader.vertexShader = shader.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           transformed += normalize(objectNormal) * (0.01 * sin(uPulse + position.y * 10.0));`
        )

        // expose uniform so we can animate it
        shader.uniforms.uPulse = { value: 0 }
        bag.push(shader)
      }

      // mark and force recompile
      mat.userData = mat.userData || {}
      mat.userData.__pulseInstalled = true
      mat.needsUpdate = true
    }
  })
}

const uid = () => Math.random().toString(36).slice(2, 10)

export default function GLBinject({
  url,
  id,
  name,
  position = [0, 0, 0],
  rotationY = 0,
  showHelper = false,
  enableWave = true,
  enablePulse = false,           // <-- default OFF to avoid surprises
  tint = null,
}: GLBinjectProps) {
  // proper hook usage — preload inside component
  useGLTF.preload(url as any)

  const group = useRef<THREE.Group>(null!)
  const { scene, animations } = useGLTF(url) as any
  const { actions, mixer } = useAnimations(animations, group)
  const helperRef = useRef<THREE.SkeletonHelper | null>(null)

  const waveRef = useRef<ReturnType<typeof createWave> | null>(null)
  const wavingRef = useRef(false)
  const pulseShaders = useRef<Array<{ uniforms: { uPulse: { value: number } } }>>([])

  // clone, ground, tint & shadows
  const centered = useMemo(() => {
    const clone = scene.clone(true)

    // optional skin/body tint
    if (tint) {
      const tintColor = new THREE.Color(tint)
      clone.traverse((o: any) => {
        if ((o.isMesh || o.isSkinnedMesh) && o.material && !Array.isArray(o.material)) {
          const mat = (o.material = o.material.clone())
          const n = (mat.name || o.name || '').toLowerCase()
          if (n.includes('skin') || n.includes('body')) {
            if (!mat.color) mat.color = new THREE.Color(0xffffff)
            mat.color = mat.color.clone().multiply(tintColor)
          }
        }
      })
    }

    const box = new THREE.Box3().setFromObject(clone)
    const center = new THREE.Vector3()
    box.getCenter(center)
    clone.position.sub(center)
    const b2 = new THREE.Box3().setFromObject(clone)
    clone.position.y -= b2.min.y

    clone.traverse((o: any) => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true }
    })

    return clone
  }, [scene, tint])

  const myId = useMemo(() => id || `actor_${uid()}`, [id])
  const displayName = name || myId

  useEffect(() => {
    if (!group.current) return

    // debug helper
    analyzeSkeleton(group.current)
    helperRef.current = attachSkeletonHelper(group.current.parent as any, group.current)
    if (helperRef.current) helperRef.current.visible = !!showHelper

    // optional procs
    if (enableWave) waveRef.current = createWave(group.current)
    if (enablePulse) installPulseWobble(group.current, pulseShaders.current)

    // engine & panel
    const engine = ((window as any).__engine ??= {})
    const panel = ((window as any).__animPanel ??= {}) as PanelAPI
    engine.actors ??= {}

    let selected: THREE.AnimationAction | null = null
    const api = {
      id: myId,
      name: displayName,
      url,
      object: group.current,
      list: () => Object.keys(actions || {}),
      play: (clip: string) => {
        const a = (actions as any)[clip]; if (!a) return false
        Object.values(actions).forEach((x: any) => x.stop())
        a.reset().setEffectiveWeight(1).setLoop(THREE.LoopRepeat, Infinity).play()
        selected = a; return true
      },
      fadeTo: (clip: string, t = 0.25) => {
        const a = (actions as any)[clip]; if (!a) return false
        if (selected && selected !== a) selected.crossFadeTo(a, Math.max(0, t), true)
        else a.reset().play()
        selected = a; return true
      },
      stop: (clip?: string) => {
        if (clip) { const a = (actions as any)[clip]; if (a) { a.stop(); return true } return false }
        if (selected) { selected.stop(); selected = null; return true }
        return false
      },
      speed: (v = 1) => { if (mixer) (mixer as any).timeScale = v; return true },
      weight: (v = 1) => { if (selected) selected.setEffectiveWeight(v); return true },
      loop: (on: boolean) => { if (selected) selected.setLoop(on ? THREE.LoopRepeat : THREE.LoopOnce, Infinity); return true },
      current: () => (selected ? (selected as any)._clip?.name : ''),
      getSelected: () => selected,

      wave: {
        start: () => { wavingRef.current = true; waveRef.current?.start() },
        stop:  () => { wavingRef.current = false; waveRef.current?.stop()  },
        toggle: () => { wavingRef.current ? api.wave.stop() : api.wave.start() }
      },

      // clone THIS rig (keeps skinning) + optional tint offset
      clone: (opts?: { tint?: string; x?: number; z?: number }) => {
        const src = group.current; if (!src || !src.parent) return null
        const c = cloneSkeleton(src) as THREE.Group
        const { tint, x = 0, z = 0 } = opts || {}
        if (tint) {
          const tcol = new THREE.Color(tint)
          c.traverse((o: any) => {
            if ((o.isMesh || o.isSkinnedMesh) && o.material && !Array.isArray(o.material)) {
              const mat = (o.material = o.material.clone())
              const n = (mat.name || o.name || '').toLowerCase()
              if (n.includes('skin') || n.includes('body')) {
                if (!mat.color) mat.color = new THREE.Color(0xffffff)
                mat.color = mat.color.clone().multiply(tcol)
              }
            }
          })
        }
        c.position.copy(src.position).add(new THREE.Vector3(x, 0, z))
        src.parent.add(c)
        return c
      },

      bindPanel: () => {
        const names = Object.keys(actions || {})
        panel.list = api.list
        panel.play = api.play
        panel.fadeTo = api.fadeTo
        panel.stop = api.stop
        panel.speed = api.speed
        panel.weight = api.weight
        panel.loop = (onoff: 'on'|'off') => api.loop(onoff === 'on')
        panel.current = api.current
        panel._getSelectedAction = api.getSelected
        panel._updateClips?.(names)
        return true
      },
    }

    engine.actors[myId] = api
    engine.setActiveActor = (whichId: string) => {
      const a = engine.actors?.[whichId]
      if (a) a.bindPanel()
    }
    api.bindPanel()

    // autoplay idle if present
    const first = mapClips(animations).idle || animations?.[0]
    if (first && (actions as any)[first.name]) api.play(first.name)

    return () => { if (engine.actors) delete engine.actors[myId] }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, actions, mixer, animations, showHelper, enableWave, enablePulse])

  useFrame((_, dt) => {
    if (mixer) mixer.update(dt)
    if (wavingRef.current) waveRef.current?.update(dt)
    if (pulseShaders.current.length) {
      const t = (mixer as any)?.time ?? performance.now() * 0.001
      for (const s of pulseShaders.current) s.uniforms.uPulse.value = t * 2.0
    }
  })

  return (
    <group ref={group} position={position} rotation={[0, rotationY, 0]}>
      <primitive object={centered} />
    </group>
  )
}

/** Host to render actors spawned via window.__engine.spawnActor(url, opts) */
export function InjectedActorsHost() {
  const [, force] = useState(0)
  const [list, setList] = useState<Array<{ id: string; url: string; opts: Partial<GLBinjectProps> }>>([])

  useEffect(() => {
    const engine = ((window as any).__engine ??= {})
    engine.spawnActor = (url: string, opts: Partial<GLBinjectProps> = {}) => {
      const item = { id: uid(), url, opts }
      setList(prev => [...prev, item])
      setTimeout(() => force(n => n + 1), 0)
      return item.id
    }
  }, [])

  return (
    <>
      {list.map(({ id, url, opts }) => (
        <GLBinject key={id} url={url} {...opts} />
      ))}
    </>
  )
}

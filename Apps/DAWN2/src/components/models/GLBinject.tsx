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
  enableDanceShader?: boolean
  // multiply-color for materials named roughly like “skin”/“body”
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

function injectDanceShader(
  root: THREE.Object3D,
  bag: Array<{ uniforms: { uPulse: { value: number } } }>
) {
  root.traverse((o: any) => {
    if (o.isSkinnedMesh && o.material && !Array.isArray(o.material)) {
      const mat = o.material
      mat.skinning = true
      mat.onBeforeCompile = (shader: any) => {
        shader.uniforms.uPulse = { value: 0 }
        shader.vertexShader = shader.vertexShader.replace(
          '#include <begin_vertex>',
          `
          #include <begin_vertex>
          transformed += normal * 0.01 * sin(uPulse + position.y * 10.0);
          `
        )
        bag.push(shader)
      }
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
  enableDanceShader = true,
  tint = null,
}: GLBinjectProps) {
  // ✅ optional preload for the *actual* URL you pass
  useEffect(() => {
    try {
      if (url) (useGLTF as any).preload?.(url)
    } catch {
      /* ignore */
    }
  }, [url])

  const group = useRef<THREE.Group>(null!)
  const { scene, animations } = useGLTF(url) as any
  const { actions, mixer } = useAnimations(animations, group)
  const helperRef = useRef<THREE.SkeletonHelper | null>(null)

  const waveRef = useRef<ReturnType<typeof createWave> | null>(null)
  const wavingRef = useRef(false)
  const danceShaders = useRef<Array<{ uniforms: { uPulse: { value: number } } }>>([])

  // clone, center on origin, place on ground, apply tint & shadows
  const centered = useMemo(() => {
    const clone = scene.clone(true)

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
      if (o.isMesh) {
        o.castShadow = true
        o.receiveShadow = true
      }
    })

    return clone
  }, [scene, tint])

  const myId = useMemo(() => id || `actor_${uid()}`, [id])
  const displayName = name || myId

  useEffect(() => {
    if (!group.current) return

    // debug & helper
    analyzeSkeleton(group.current)
    helperRef.current = attachSkeletonHelper(group.current.parent as any, group.current)
    if (helperRef.current) helperRef.current.visible = !!showHelper

    // optional procs
    if (enableWave) waveRef.current = createWave(group.current)
    if (enableDanceShader) injectDanceShader(group.current, danceShaders.current)

    // engine + panel facades
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
        const a = (actions as any)[clip]
        if (!a) return false
        Object.values(actions).forEach((x: any) => x.stop())
        a.reset().setEffectiveWeight(1).setLoop(THREE.LoopRepeat, Infinity).play()
        selected = a
        return true
      },
      fadeTo: (clip: string, t = 0.25) => {
        const a = (actions as any)[clip]
        if (!a) return false
        if (selected && selected !== a) selected.crossFadeTo(a, Math.max(0, t), true)
        else a.reset().play()
        selected = a
        return true
      },
      stop: (clip?: string) => {
        if (clip) {
          const a = (actions as any)[clip]
          if (a) {
            a.stop()
            return true
          }
          return false
        }
        if (selected) {
          selected.stop()
          selected = null
          return true
        }
        return false
      },
      speed: (v = 1) => {
        if (mixer) (mixer as any).timeScale = v
        return true
      },
      weight: (v = 1) => {
        if (selected) selected.setEffectiveWeight(v)
        return true
      },
      loop: (on: boolean) => {
        if (selected) selected.setLoop(on ? THREE.LoopRepeat : THREE.LoopOnce, Infinity)
        return true
      },
      current: () => (selected ? (selected as any)._clip?.name : ''),
      getSelected: () => selected,

      wave: {
        start: () => {
          wavingRef.current = true
          waveRef.current?.start()
        },
        stop: () => {
          wavingRef.current = false
          waveRef.current?.stop()
        },
        toggle: () => {
          wavingRef.current ? api.wave.stop() : api.wave.start()
        },
      },

      // clone THIS rig (keeps skinning)
      clone: (opts?: { tint?: string; x?: number; z?: number }) => {
        const src = group.current
        if (!src || !src.parent) return null
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
        panel.loop = (onoff: 'on' | 'off') => api.loop(onoff === 'on')
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
    // newest becomes active
    api.bindPanel()

    // autoplay idle if present
    const first = mapClips(animations).idle || animations?.[0]
    if (first && (actions as any)[first.name]) api.play(first.name)

    return () => {
      if (engine.actors) delete engine.actors[myId]
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, actions, mixer, animations, showHelper, enableWave, enableDanceShader])

  useFrame((_, dt) => {
    if (mixer) mixer.update(dt)
    if (wavingRef.current) waveRef.current?.update(dt)
    const t = (mixer as any)?.time ?? performance.now() * 0.001
    for (const s of danceShaders.current) s.uniforms.uPulse.value = t * 2.0
  })

  return (
    <group ref={group} position={position} rotation={[0, rotationY, 0]}>
      <primitive object={centered} />
    </group>
  )
}

/**
 * A tiny host that renders any actors spawned via:
 *   __engine.spawnActor(url, { tint, position, rotationY, showHelper, enableWave, enableDanceShader })
 */
export function InjectedActorsHost() {
  const [, force] = useState(0)
  const [list, setList] = useState<
    Array<{ id: string; url: string; opts: Partial<GLBinjectProps> }>
  >([])

  useEffect(() => {
    const engine = ((window as any).__engine ??= {})
    engine.spawnActor = (url: string, opts: Partial<GLBinjectProps> = {}) => {
      const item = { id: uid(), url, opts }
      setList(prev => [...prev, item])
      // force panel to pick up latest actor if desired
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

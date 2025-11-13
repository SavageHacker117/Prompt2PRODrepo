import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useAnimations, useGLTF } from '@react-three/drei'
import { analyzeSkeleton, attachSkeletonHelper, mapClips } from '../../tools/BoneInspector'
import { createWave } from '../../scriptBuilder/scripts/wave'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { hasSkinning, injectSimpleSpineRig } from '../../tools/BoneInjector'

export type GLBinjectProps = {
  url: string
  id?: string
  name?: string
  position?: [number, number, number]
  rotationY?: number
  showHelper?: boolean
  enableWave?: boolean
  /** optional vertex wobble via shader injection (OFF by default) */
  enablePulse?: boolean
  /** multiply-color on materials that look like skin/body */
  tint?: string | null
  /** optional starting uniform scale for the whole actor */
  scale?: number
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
  wave?: { toggle?: () => void }
}

/* ──────────────────────────────────────────────────────────────── */
/* Global log bus                                                   */
/* ──────────────────────────────────────────────────────────────── */
type LogBus = {
  add: (...lines: string[]) => void
  clear: () => void
  get: () => string[]
  subscribe: (fn: (lines: string[]) => void) => () => void
}
function ensureLog(): LogBus {
  const w = window as any
  if (!w.__log) {
    const listeners = new Set<(l: string[]) => void>()
    const state = { lines: [] as string[] }
    w.__log = {
      add: (...lines: string[]) => {
        const ts = new Date().toISOString().split('T')[1].split('.')[0]
        for (const l of lines) state.lines.push(`[${ts}] ${l}`)
        listeners.forEach(fn => fn(state.lines))
      },
      clear: () => { state.lines = []; listeners.forEach(fn => fn(state.lines)) },
      get: () => state.lines.slice(),
      subscribe: (fn: (l: string[]) => void) => { listeners.add(fn); fn(state.lines); return () => listeners.delete(fn) }
    }
  }
  return w.__log as LogBus
}

/* ──────────────────────────────────────────────────────────────── */
/* Safe shader “pulse” wobble                                       */
/* ──────────────────────────────────────────────────────────────── */
function installPulseWobble(root: THREE.Object3D, bag: Array<{ uniforms: { uPulse: { value: number } } }>) {
  root.traverse((o: any) => {
    const mats: any[] = o?.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []
    for (const mat of mats) {
      if (!mat || mat.userData?.__pulseInstalled) continue
      const prev = mat.onBeforeCompile
      mat.onBeforeCompile = (shader: any) => {
        prev && prev(shader)
        if (typeof shader.vertexShader === 'string') {
          shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\nuniform float uPulse;`)
          shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
             transformed += normalize(objectNormal) * (0.01 * sin(uPulse + position.y * 10.0));`
          )
        }
        shader.uniforms.uPulse = { value: 0 }
        bag.push(shader)
      }
      mat.userData ||= {}
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
  enablePulse = false,
  tint = null,
  scale = 1,
}: GLBinjectProps) {
  useGLTF.preload(url as any)

  const group = useRef<THREE.Group>(null!)
  const { scene, animations } = useGLTF(url) as any
  const { actions, mixer } = useAnimations(animations, group)
  const helperRef = useRef<THREE.SkeletonHelper | null>(null)

  const waveRef = useRef<ReturnType<typeof createWave> | null>(null)
  const wavingRef = useRef(false)
  const pulseShaders = useRef<Array<{ uniforms: { uPulse: { value: number } } }>>([])

  // wag demo over (existing or injected) skeleton
  const waggingRef = useRef(false)
  const wagPhaseRef = useRef(0)

  // Proper skin-safe clone + centering (keeps bind matrices & bone maps)
  const centered = useMemo(() => {
    const root = cloneSkeleton(scene) as THREE.Object3D

    // clone materials per instance + optional tinting on “skin/body”
    root.traverse((o: any) => {
      if (!o) return
      if ((o.isMesh || o.isSkinnedMesh) && o.material) {
        if (Array.isArray(o.material)) o.material = o.material.map((m: any) => m?.clone?.() ?? m)
        else o.material = o.material.clone?.() ?? o.material
      }
    })
    if (tint) {
      const tintColor = new THREE.Color(tint)
      root.traverse((o: any) => {
        if ((o.isMesh || o.isSkinnedMesh) && o.material && !Array.isArray(o.material)) {
          const mat = o.material
          const n = (mat.name || o.name || '').toLowerCase()
          if (n.includes('skin') || n.includes('body')) {
            if (!mat.color) mat.color = new THREE.Color(0xffffff)
            mat.color = mat.color.clone().multiply(tintColor)
          }
        }
      })
    }

    // ensure all SkinnedMeshes are bound & posed once
    root.traverse((o: any) => {
      if (o.isSkinnedMesh) {
        if (!(o as THREE.SkinnedMesh).bindMode) {
          (o as THREE.SkinnedMesh).bind(o.skeleton, o.matrixWorld)
        }
        o.skeleton?.pose?.()
      }
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true }
    })

    // center on origin & rest on floor (don’t touch internal bones)
    const box = new THREE.Box3().setFromObject(root)
    const center = new THREE.Vector3()
    box.getCenter(center)
    root.position.sub(center)
    const b2 = new THREE.Box3().setFromObject(root)
    root.position.y -= b2.min.y

    return root
  }, [scene, tint])

  const myId = useMemo(() => id || `actor_${uid()}`, [id])
  const displayName = name || myId

  useEffect(() => {
    const log = ensureLog()
    if (!group.current) return

    // Skeleton analysis & helper – draw on top (X-ray)
    analyzeSkeleton(group.current)
    helperRef.current = attachSkeletonHelper(group.current.parent as any, group.current)
    if (helperRef.current) {
      helperRef.current.visible = !!showHelper
      const mat = helperRef.current.material as THREE.LineBasicMaterial
      mat.depthTest = false
      helperRef.current.renderOrder = 9999
      helperRef.current.frustumCulled = false
    }

    if (enableWave) waveRef.current = createWave(group.current)
    if (enablePulse) installPulseWobble(group.current, pulseShaders.current)

    const engine = ((window as any).__engine ??= {})
    const panel  = ((window as any).__animPanel ??= {}) as PanelAPI
    engine.actors ??= {}

    let selected: THREE.AnimationAction | null = null
    const api = {
      id: myId, name: displayName, url, object: group.current,

      list: () => Object.keys(actions || {}),
      play: (clip: string) => {
        const a = (actions as any)[clip]; if (!a) return false
        Object.values(actions).forEach((x: any) => x.stop?.())
        a.reset().setEffectiveWeight(1).setLoop(THREE.LoopRepeat, Infinity).play()
        selected = a
        log.add(`anim: play "${clip}" on ${myId}`)
        return true
      },
      fadeTo: (clip: string, t=0.25) => {
        const a = (actions as any)[clip]; if (!a) return false
        if (selected && selected !== a) selected.crossFadeTo(a, Math.max(0,t), true)
        else a.reset().play()
        selected = a
        log.add(`anim: fadeTo "${clip}" (t=${t}) on ${myId}`)
        return true
      },
      stop: (clip?: string) => {
        if (clip) { const a = (actions as any)[clip]; if (a) { a.stop(); log.add(`anim: stop "${clip}" on ${myId}`); return true } return false }
        if (selected) { selected.stop(); selected = null; log.add(`anim: stop current on ${myId}`); return true }
        return false
      },
      speed:  (v=1) => { if (mixer) (mixer as any).timeScale = v; log.add(`mixer: speed ${v.toFixed(2)} on ${myId}`); return true },
      weight: (v=1) => { if (selected) selected.setEffectiveWeight(v); log.add(`mixer: weight ${v.toFixed(2)} on ${myId}`); return true },
      loop:   (on: boolean) => { if (selected) selected.setLoop(on ? THREE.LoopRepeat : THREE.LoopOnce, Infinity); log.add(`mixer: loop ${on?'on':'off'} on ${myId}`); return true },
      current: () => (selected ? (selected as any)._clip?.name : ''),
      getSelected: () => selected,

      bones: {
        show: (on: boolean) => { if (!helperRef.current) return false; helperRef.current.visible = !!on; log.add(`bones: ${on?'on':'off'} (${myId})`); return true },
        toggle: () => { const on = !(helperRef.current?.visible); return (api as any).bones.show(on) }
      },

      wave: { start: ()=>{wavingRef.current=true; waveRef.current?.start(); log.add(`wave: start (${myId})`)},
              stop:  ()=>{wavingRef.current=false; waveRef.current?.stop();  log.add(`wave: stop (${myId})`)},
              toggle:()=>{wavingRef.current ? (api as any).wave.stop() : (api as any).wave.start()} },

      setScale: (v: number) => { if (!group.current) return false; group.current.scale.setScalar(Math.max(1e-4, v)); log.add(`transform: scale=${v.toFixed(2)} (${myId})`); return true },

      injectRig: (bones = 6) => {
        if (!group.current) return false
        const already = hasSkinning(group.current)
        const added = injectSimpleSpineRig(group.current, { bones, helper: false })
        analyzeSkeleton(group.current)
        if (!helperRef.current) helperRef.current = attachSkeletonHelper(group.current.parent as any, group.current)
        if (helperRef.current) helperRef.current.visible = !!showHelper
        log.add(`rig: inject requested bones=${bones} (pre-skinned=${already}) → added=${added} (${myId})`)
        return added > 0 || already
      },

      wag: {
        start: () => { waggingRef.current = true; log.add(`wag: on (${myId})`); return true },
        stop:  () => { waggingRef.current = false; log.add(`wag: off (${myId})`); return true },
        toggle: ()   => { const r = !waggingRef.current; waggingRef.current = r; log.add(`wag: ${r?'on':'off'} (${myId})`); return r }
      },

      clone: (opts?: { tint?: string; x?: number; z?: number }) => {
        const src = group.current; if (!src || !src.parent) return null
        const c = cloneSkeleton(src) as THREE.Group
        const { tint, x=0, z=0 } = opts || {}

        c.traverse((o: any) => {
          if ((o.isMesh || o.isSkinnedMesh) && o.material) {
            if (Array.isArray(o.material)) o.material = o.material.map((m: any) => m?.clone?.() ?? m)
            else o.material = o.material.clone?.() ?? o.material
          }
          if (o.isSkinnedMesh) o.skeleton?.pose?.()
        })

        if (tint) {
          const tcol = new THREE.Color(tint)
          c.traverse((o: any) => {
            if ((o.isMesh || o.isSkinnedMesh) && o.material && !Array.isArray(o.material)) {
              const mat = o.material
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
        ensureLog().add(`clone: +1 at offset (${x},0,${z}) from ${myId}`)
        return c
      },

      bindPanel: () => {
        const names = Object.keys(actions || {})
        try {
          panel.list = () => api.list()
          panel.play = (n: string) => !!api.play(n)
          panel.fadeTo = (n: string, t?: number) => !!api.fadeTo(n, t)
          panel.stop = (n?: string) => !!api.stop(n)
          panel.speed = (v: number) => !!api.speed(v)
          panel.weight = (v: number) => !!api.weight(v)
          panel.loop = (onoff: 'on'|'off') => !!api.loop(onoff === 'on')
          panel.current = () => api.current()
          panel._getSelectedAction = api.getSelected
          panel.wave ||= {}
          panel.wave.toggle = () => api.wave.toggle()
          panel._updateClips?.(names)
        } catch (e) {
          ensureLog().add(`panel bind error: ${(e as Error).message}`)
        }
        return true
      },
    }

    engine.actors[myId] = api
    ;(engine as any).setActiveActor = (whichId: string) => {
      const a = engine.actors?.[whichId]
      if (a) {
        a.bindPanel()
        engine.activeActorId = whichId
        engine.activeActor = a
        log.add(`active: ${whichId}`)
      }
    }
    engine.log = ensureLog().add

    api.bindPanel()
    api.setScale(scale)
    log.add(`spawn: ${myId} (${url.split('/').pop()})`)

    const first = mapClips(animations).idle || animations?.[0]
    if (first && (actions as any)[first.name]) api.play(first.name)

    return () => { if (engine.actors) delete engine.actors[myId]; log.add(`destroy: ${myId}`) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, actions, mixer, animations, showHelper, enableWave, enablePulse, scale])

  useFrame((_, dt) => {
    if (mixer) mixer.update(dt)
    if (wavingRef.current) waveRef.current?.update(dt)

    if (waggingRef.current && group.current) {
      wagPhaseRef.current += dt * 3.0
      const phase = wagPhaseRef.current
      group.current.traverse((o: any) => {
        if (o.isBone) {
          const d = boneDepth(o)
          o.rotation.y = 0.08 * Math.sin(phase + d * 0.35)
        }
      })
    }

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

function boneDepth(b: THREE.Bone) {
  let d = 0; let p: any = b.parent
  while (p && p.isBone) { d++; p = p.parent }
  return d
}

/** Renders actors spawned via: window.__engine.spawnActor(url, opts) */
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
    engine.destroyActor = (id: string) => {
      setList(prev => prev.filter(it => it.id !== id))
    }
  }, [])

  return <>{list.map(({ id, url, opts }) => (<GLBinject key={id} url={url} {...(opts as any)} />))}</>
}

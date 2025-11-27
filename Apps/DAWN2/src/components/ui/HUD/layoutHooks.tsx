// src/components/ui/HUD/layoutHooks.tsx
import React, { useEffect, useState } from 'react'
import {
  ALL_WINS,
  DEFAULT_OPTS,
  DOCKH_LSK,
  Layout,
  LSK_V3,
  LSK_V4,
  OPTS_LSK,
  UiOpts,
  VALID_WINS,
} from './types'

/* normalizer used by layout + reset */
export function normalizeV4(input: any): Layout {
  const safeArr = (v: any) =>
    Array.isArray(v) ? v.filter((x: any) => VALID_WINS.includes(x)) : []
  const docksIn = (input && input.docks) || {}
  const floatsIn = Array.isArray(input?.floats) ? input.floats : []

  const left = safeArr(docksIn.left)
  const right = safeArr(docksIn.right)
  const bottomL = safeArr(docksIn.bottomL)
  const bottomR = safeArr(docksIn.bottomR)

  const docks: Layout['docks'] = {
    left: Array.from(new Set(left)),
    right: Array.from(new Set(right)),
    bottomL: Array.from(new Set(bottomL)),
    bottomR: Array.from(new Set(bottomR)),
  }

  const floats = floatsIn
    .filter((f: any) => f && VALID_WINS.includes(f.id))
    .map((f: any) => ({
      id: f.id,
      x: +f.x || 60,
      y: +f.y || 60,
      w: Math.max(260, +f.w || 360),
    }))

  return { docks, floats }
}

/* persistent dock layout */
export function useLayout(): [Layout, (l: Layout | ((p: Layout) => Layout)) => void] {
  const [state, setState] = useState<Layout>(() => {
    try {
      const rawV4 = localStorage.getItem(LSK_V4)
      if (rawV4) return normalizeV4(JSON.parse(rawV4))

      const rawV3 = localStorage.getItem(LSK_V3)
      if (rawV3) {
        const v3 = JSON.parse(rawV3)
        const migrated = normalizeV4({
          docks: {
            left: v3?.docks?.left,
            right: v3?.docks?.right,
            bottomL: [],
            bottomR: v3?.docks?.bottom || [],
          },
          floats: v3?.floats,
        })
        return migrated
      }
    } catch {}
    return {
      docks: { ...DEFAULT_LAYOUT.docks },
      floats: [],
    } as any
  })

  useEffect(() => {
    localStorage.setItem(LSK_V4, JSON.stringify(state))
  }, [state])

  return [state, setState]
}

// we need defaultLayout here without circular import
const DEFAULT_LAYOUT: Layout = {
  docks: {
    left: [],
    right: [],
    bottomL: ['world', 'spawns', 'actors'],
    bottomR: ['scene', 'anim'],
  },
  floats: [],
}

/* persistent UI options */
export function useUiOpts(): [UiOpts, (p: Partial<UiOpts>) => void] {
  const [opts, setOpts] = useState<UiOpts>(() => {
    try {
      const raw = localStorage.getItem(OPTS_LSK)
      if (raw) return { ...DEFAULT_OPTS, ...JSON.parse(raw) }
    } catch {}
    return DEFAULT_OPTS
  })

  useEffect(() => {
    localStorage.setItem(OPTS_LSK, JSON.stringify(opts))
  }, [opts])

  // root classes for lock/compact
  useEffect(() => {
    const root = document.querySelector('.hud') as HTMLElement | null
    if (!root) return
    root.classList.toggle('locked', !!opts.lock)
    root.classList.toggle('compact', !!opts.compact)
  }, [opts.lock, opts.compact])

  // push GPU opts to App
  useEffect(() => {
    const emit = (type: string, value: any) =>
      window.dispatchEvent(new CustomEvent('ui:renderer', { detail: { type, value } }))

    emit('pixelRatio', opts.pixelRatio)
    emit('shadows', opts.shadows)
    emit('exposure', opts.exposure)
    emit('showConsole', opts.showConsole)
    emit('qualityPreset', opts.quality)
  }, [opts.pixelRatio, opts.shadows, opts.exposure, opts.showConsole, opts.quality])

  return [opts, (p) => setOpts((prev) => ({ ...prev, ...p }))] as const
}

/* small helper hook used in HUD shell for dock height */
export function useDockHeight(): [number, (h: number) => void] {
  const [dockH, setDockH] = useState<number>(() => {
    const raw = localStorage.getItem(DOCKH_LSK)
    return raw ? Math.max(140, Math.min(520, parseInt(raw))) : 280
  })

  useEffect(() => {
    document.documentElement.style.setProperty('--dock-h', `${dockH}px`)
    localStorage.setItem(DOCKH_LSK, String(dockH))
  }, [dockH])

  return [dockH, setDockH]
}

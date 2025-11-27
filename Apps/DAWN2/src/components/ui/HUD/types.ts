// src/components/ui/HUD/types.ts
import type { QualityPresetName } from '../../engine/perf'

export type WinId = 'world' | 'actors' | 'anim' | 'scene' | 'spawns' | 'ocean'
export type DockKey = 'left' | 'right' | 'bottomL' | 'bottomR'

export type UiOpts = {
  lock: boolean
  compact: boolean
  pixelRatio: 'auto' | 1 | 1.5 | 2
  shadows: 'off' | 'pcf' | 'pcfsoft'
  exposure: number
  showConsole: boolean
  /** GPU quality preset for perf.ts + renderer */
  quality: QualityPresetName
}

export type Layout = {
  docks: Record<DockKey, WinId[]>
  floats: Array<{ id: WinId; x: number; y: number; w: number }>
}

export const DEFAULT_OPTS: UiOpts = {
  lock: false,
  compact: false,
  pixelRatio: 'auto',
  shadows: 'pcfsoft',
  exposure: 1,
  showConsole: true,
  quality: 'balanced',
}

// storage keys
export const LSK_V4 = 'hud-dock-layout-v4'
export const LSK_V3 = 'hud-dock-layout-v3'
export const OPTS_LSK = 'hud-ui-options-v1'
export const DOCKH_LSK = 'hud-dock-h'

// default: WORLD+SPAWNS+ACTORS (bottom-left), SCENE+ANIM (bottom-right)
export const defaultLayout: Layout = {
  docks: {
    left: [],
    right: [],
    bottomL: ['world', 'spawns', 'actors'],
    bottomR: ['scene', 'anim', 'ocean'],
  },
  floats: [],
}

export const VALID_WINS: WinId[] = ['world', 'actors', 'anim', 'scene', 'spawns', 'ocean']
export const ALL_WINS: WinId[] = ['world', 'spawns', 'actors', 'scene', 'anim', 'ocean']

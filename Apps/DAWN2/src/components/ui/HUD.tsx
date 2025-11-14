// src/components/ui/HUD.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useWorld } from '../../state/world'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import ActorManager from './ActorManager'
import SpawnPanel from './SpawnPanel'

type WinId = 'world' | 'actors' | 'anim' | 'scene' | 'spawns'
type DockKey = 'left' | 'right' | 'bottomL' | 'bottomR'

type UiOpts = {
  lock: boolean
  compact: boolean
  pixelRatio: 'auto' | 1 | 1.5 | 2
  shadows: 'off' | 'pcf' | 'pcfsoft'
  exposure: number
  showConsole: boolean
}

const DEFAULT_OPTS: UiOpts = {
  lock: false,
  compact: false,
  pixelRatio: 'auto',
  shadows: 'pcfsoft',
  exposure: 1,
  showConsole: true,
}

type Layout = {
  docks: Record<DockKey, WinId[]>
  floats: Array<{ id: WinId; x: number; y: number; w: number }>
}

// new layout key; we also one-shot migrate v3 -> v4
const LSK_V4 = 'hud-dock-layout-v4'
const LSK_V3 = 'hud-dock-layout-v3'
const OPTS_LSK = 'hud-ui-options-v1'
const DOCKH_LSK = 'hud-dock-h'

// default: WORLD+SPAWNS+ACTORS (bottom-left), SCENE+ANIM (bottom-right)
const defaultLayout: Layout = {
  docks: {
    left: [],
    right: [],
    bottomL: ['world', 'spawns', 'actors'],
    bottomR: ['scene', 'anim'],
  },
  floats: [],
}

const VALID_WINS: WinId[] = ['world', 'actors', 'anim', 'scene', 'spawns']
const ALL_WINS: WinId[] = ['world', 'spawns', 'actors', 'scene', 'anim']

/* ───────── helpers ───────── */
function normalizeV4(input: any): Layout {
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
      id: f.id as WinId,
      x: +f.x || 60,
      y: +f.y || 60,
      w: Math.max(260, +f.w || 360),
    }))

  return { docks, floats }
}

/* ───────── persistence ───────── */
function useLayout(): [Layout, (l: Layout | ((p: Layout) => Layout)) => void] {
  const [state, setState] = useState<Layout>(() => {
    try {
      // prefer v4
      const rawV4 = localStorage.getItem(LSK_V4)
      if (rawV4) return normalizeV4(JSON.parse(rawV4))

      // migrate one time from v3 (left/right/bottom) → v4 (bottomL/bottomR)
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
    return defaultLayout
  })
  useEffect(() => {
    localStorage.setItem(LSK_V4, JSON.stringify(state))
  }, [state])
  return [state, setState]
}

function useUiOpts(): [UiOpts, (p: Partial<UiOpts>) => void] {
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
      window.dispatchEvent(
        new CustomEvent('ui:renderer', { detail: { type, value } }),
      )
    emit('pixelRatio', opts.pixelRatio)
    emit('shadows', opts.shadows)
    emit('exposure', opts.exposure)
    emit('showConsole', opts.showConsole)
  }, [opts.pixelRatio, opts.shadows, opts.exposure, opts.showConsole])

  return [opts, (p) => setOpts((prev) => ({ ...prev, ...p }))] as const
}

/* ───────── tiny atoms ───────── */
function Tab({
  id,
  active,
  onClick,
  onTear,
}: {
  id: WinId
  active: boolean
  onClick: () => void
  onTear: () => void
}) {
  return (
    <div
      className={`dock-tab ${active ? 'active' : ''}`}
      draggable
      onDragStart={(e) => e.dataTransfer.setData('text/plain', id)}
      onDoubleClick={onTear}
      onClick={onClick}
      title="Drag to move. Double-click to tear off."
    >
      {id.toUpperCase()}
    </div>
  )
}

function DockArea({
  ids,
  onDrop,
  children,
}: {
  ids: WinId[]
  onDrop: (id: WinId) => void
  children: React.ReactNode
}) {
  return (
    <div
      className="dock-area"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => onDrop(e.dataTransfer.getData('text/plain') as WinId)}
    >
      {children}
    </div>
  )
}

function Floating({
  id,
  x,
  y,
  w,
  body,
  onClose,
  onMove,
  onResize,
}: {
  id: WinId
  x: number
  y: number
  w: number
  body: React.ReactNode
  onClose: () => void
  onMove: (dx: number, dy: number) => void
  onResize: (dw: number, dh: number) => void
}) {
  const drag = useRef<{ x: number; y: number } | null>(null)
  const rez = useRef<{ x: number; y: number } | null>(null)
  return (
    <div className="floating" style={{ left: x, top: y, width: w }}>
      <div
        className="floating-title"
        onMouseDown={(e) => (drag.current = { x: e.clientX, y: e.clientY })}
        onMouseUp={() => (drag.current = null)}
        onMouseMove={(e) => {
          if (!drag.current) return
          const dx = e.clientX - drag.current.x
          const dy = e.clientY - drag.current.y
          drag.current = { x: e.clientX, y: e.clientY }
          onMove(dx, dy)
        }}
      >
        {id.toUpperCase()}
        <button className="btn" onClick={onClose} style={{ marginLeft: 'auto' }}>
          ✕
        </button>
      </div>
      <div className="floating-body">{body}</div>
      <div
        className="float-resizer"
        onMouseDown={(e) => (rez.current = { x: e.clientX, y: e.clientY })}
        onMouseUp={() => (rez.current = null)}
        onMouseMove={(e) => {
          if (!rez.current) return
          const dw = e.clientX - rez.current.x
          rez.current = { x: e.clientX, y: e.clientY }
          onResize(dw, 0)
        }}
      />
    </div>
  )
}

/* ───────── WORLD pane ───────── */
const LS_UPLOADS = 'glbUploads'
const GUESSES = [
  '/assets/models/actors/rose.glb',
  '/assets/models/actors/dino1.glb',
  '/assets/models/actors/dino2.glb',
  '/assets/models/actors/dino3.glb',
  '/assets/models/actors/mage1.glb',
  '/assets/models/actors/mage2.glb',
  '/assets/models/vehicles/mech.glb',
  '/assets/models/vehicles/superdigger_rig.glb',
  '/assets/models/humanoid.glb',
]

async function exists(url: string) {
  try {
    const r = await fetch(url, { method: 'HEAD', cache: 'no-store' })
    return r.ok
  } catch {
    return false
  }
}

const statsCache = new Map<string, any>()
async function getStats(url: string) {
  if (statsCache.has(url)) return statsCache.get(url)
  const loader = new GLTFLoader()
  const gltf = await loader.loadAsync(url)
  let meshes = 0,
    skinned = 0,
    bones = 0,
    anims = gltf.animations?.length || 0,
    verts = 0
  gltf.scene.traverse((o: any) => {
    if (o.isBone) bones++
    if (o.isMesh) {
      meshes++
      if (o.isSkinnedMesh) skinned++
      const pos = o.geometry?.attributes?.position
      if (pos?.count) verts += pos.count
    }
  })
  const s = { meshes, skinned, bones, verts, animations: anims }
  statsCache.set(url, s)
  return s
}

function WorldPane() {
  const palette = useWorld((s) => s.palette)
  const setPalette = useWorld((s) => s.setPalette)
  const rotate = useWorld((s) => s.rotate)
  const clear = useWorld((s) => s.clear)
  const resetWorld = useWorld((s: any) => s.resetWorld ?? (() => s.clear()))
  const exportJSON = useWorld((s) => s.exportJSON)
  const importJSON = useWorld((s) => s.importJSON)
  const fileRef = useRef<HTMLInputElement>(null)
  const [askReset, setAskReset] = useState(false)

  const onExport = () => {
    const data = exportJSON()
    const blob = new Blob([data], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'world.json'
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 300)
  }

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    importJSON(await f.text())
    e.currentTarget.value = ''
  }

  return (
    <div className="panel">
      <div className="row wrap">
        <span className="label">Type</span>
        <select
          className="input"
          value={palette.type}
          onChange={(e) => setPalette({ type: e.target.value as any })}
        >
          <option value="block">Block</option>
          <option value="platform">Platform</option>
        </select>

        <span className="label">Size</span>
        <input
          className="input num"
          type="number"
          min={1}
          value={palette.size[0]}
          onChange={(e) =>
            setPalette({
              size: [parseInt(e.target.value) || 1, palette.size[1], palette.size[2]],
            })
          }
        />
        <input
          className="input num"
          type="number"
          min={1}
          value={palette.size[1]}
          onChange={(e) =>
            setPalette({
              size: [palette.size[0], parseInt(e.target.value) || 1, palette.size[2]],
            })
          }
        />
        <input
          className="input num"
          type="number"
          min={1}
          value={palette.size[2]}
          onChange={(e) =>
            setPalette({
              size: [palette.size[0], palette.size[1], parseInt(e.target.value) || 1],
            })
          }
        />

        <input
          className="input"
          type="color"
          value={palette.color}
          onChange={(e) => setPalette({ color: e.target.value })}
        />

        <button className="btn" onClick={rotate} title="Rotate 90° (R)">
          ↻
        </button>
        <button className="btn" onClick={clear}>
          Clear
        </button>
        <button className="btn" onClick={onExport}>
          Export
        </button>

        <label className="btn" style={{ cursor: 'pointer' }}>
          Import
          <input
            ref={fileRef}
            onChange={onImport}
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
          />
        </label>

        <span style={{ flex: 1 }} />
        <button className="btn danger" onClick={() => setAskReset(true)}>
          Reset World
        </button>
      </div>

      {askReset && (
        <div className="opts-backdrop" onClick={() => setAskReset(false)}>
          <div className="confirm" onClick={(e) => e.stopPropagation()}>
            <div className="label" style={{ marginBottom: 10 }}>
              Reset world to defaults? This clears blocks, groups and selection.
            </div>
            <div className="row">
              <button className="btn" onClick={() => setAskReset(false)}>
                Cancel
              </button>
              <button
                className="btn danger"
                onClick={() => {
                  setAskReset(false)
                  resetWorld()
                }}
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ───────── ACTORS + ANIM panes ───────── */

function ActorsPane() {
  type Model = { name: string; url: string; source: 'manifest' | 'guess' | 'upload' }
  const [models, setModels] = useState<Model[]>([])
  const [tint, setTint] = useState('#ffffff')
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<{ url: string; stats: any | '...' } | null>(
    null,
  )

  const engine = useMemo(() => ((window as any).__engine ||= {}), [])

  // One-time cleanup of old persisted blob: URLs which are invalid after refresh
  useEffect(() => {
    try {
      localStorage.removeItem(LS_UPLOADS)
    } catch {
      // ignore
    }
  }, [])

  function baseName(u: string) {
    return (u.split('/').pop() || '').replace(/\.glb$/i, '').toLowerCase()
  }

  const scan = async () => {
    setBusy(true)

    // ensure fresh stats + preview when rescanning
    statsCache.clear()
    setPreview(null)

    // 1) guessed list that works in dev
    const guessed = await Promise.all(
      GUESSES.map(async (u) => ((await exists(u)) ? u : null)),
    )
    const guessModels: Model[] = guessed
      .filter(Boolean)
      .map(
        (u) =>
          ({
            name: u!.split('/').pop()!.replace(/\.glb$/i, ''),
            url: u!,
            source: 'guess',
          } as const),
      )

    // 2) real manifest if present (root + folder manifests)
    let manifest: Model[] = []
    try {
      const r = await fetch('/assets/models/manifest.json', { cache: 'no-store' })
      if (r.ok) {
        const arr = await r.json()
        if (Array.isArray(arr))
          manifest = arr.map((v: any) => {
            const url = typeof v === 'string' ? v : v.url
            const name =
              (typeof v === 'string' ? v : v.name || url)
                .split('/')
                .pop()
                ?.replace(/\.glb$/i, '') || 'model'
            return { name, url, source: 'manifest' as const }
          })
      }

      // folder manifests (tools / actors / vehicles)
      for (const sub of ['tools', 'actors', 'vehicles']) {
        const res = await fetch(`/assets/models/${sub}/manifest.json`, {
          cache: 'no-store',
        })
        if (!res.ok) continue
        const arr = await res.json()
        if (!Array.isArray(arr)) continue
        const extra: Model[] = arr.map((v: any) => {
          const url = typeof v === 'string' ? v : v.url
          const name =
            (typeof v === 'string' ? v : v.name || url)
              .split('/')
              .pop()
              ?.replace(/\.glb$/i, '') || 'model'
          return { name, url, source: 'manifest' as const }
        })
        manifest.push(...extra)
      }
    } catch {}

    // 3) uploads from previous sessions used to live in localStorage.
    // Those blob: URLs are not valid after a refresh, so we keep this empty
    // and treat uploads as session-only.
    const uploads: Model[] = []

    // Merge & dedupe by URL and base filename (case-insensitive).
    // Priority: manifest > guess > upload
    const priority = { manifest: 3, guess: 2, upload: 1 } as const
    const merged = [...manifest, ...guessModels, ...uploads]
    const byUrl = new Map<string, Model>()
    const byName = new Map<string, Model>()
    for (const m of merged) {
      const bn = baseName(m.url)
      const u = m.url
      const curU = byUrl.get(u)
      if (!curU || priority[m.source] > priority[curU.source]) byUrl.set(u, m)
      const curN = byName.get(bn)
      if (!curN || priority[m.source] > priority[curN.source]) byName.set(bn, m)
    }
    // final list = keep one per name (prevents Ak47 x2 from different paths)
    const finalModels = Array.from(byName.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    )
    setModels(finalModels)
    setBusy(false)
  }

  useEffect(() => {
    scan()
  }, [])

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const url = URL.createObjectURL(f)
    const name = f.name.replace(/\.glb$/i, '')
    const entry: Model = { name, url, source: 'upload' }

    // In-memory dedupe on upload too (by name)
    const nextMap = new Map(models.map((m) => [m.name.toLowerCase(), m]))
    nextMap.set(name.toLowerCase(), entry)
    const next = Array.from(nextMap.values())
    setModels(next)

    // uploads are session-only now; do not persist blob: URLs
    e.currentTarget.value = ''
  }

  const spawn = (m: Model) => engine.spawnActor?.(m.url, { tint })
  const showInfo = async (url: string) => {
    setPreview({ url, stats: '...' })
    try {
      setPreview({ url, stats: await getStats(url) })
    } catch {
      setPreview({ url, stats: null })
    }
  }

  return (
    <div className="panel">
      <div className="panel" style={{ background: 'rgba(0,0,0,.25)', marginBottom: 8 }}>
        <div className="label" style={{ fontWeight: 600, marginBottom: 6 }}>
          Preview
        </div>
        {!preview && (
          <div className="label" style={{ opacity: 0.8 }}>
            (select a model)
          </div>
        )}
        {preview?.stats === '...' && <div className="label">Loading…</div>}
        {preview?.stats && preview.stats !== '...' && (
          <div
            className="label"
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto auto',
              gap: 4,
            }}
          >
            <span>URL:</span>
            <span
              style={{
                maxWidth: 220,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {preview.url}
            </span>
            <span>Meshes:</span>
            <b>{preview.stats.meshes}</b>
            <span>Skinned:</span>
            <b>{preview.stats.skinned}</b>
            <span>Bones:</span>
            <b>{preview.stats.bones}</b>
            <span>Vertices:</span>
            <b>{preview.stats.verts}</b>
            <span>Animations:</span>
            <b>{preview.stats.animations}</b>
          </div>
        )}
        {preview && preview.stats === null && (
          <div className="label" style={{ opacity: 0.8 }}>
            (failed to read stats)
          </div>
        )}
      </div>

      <div className="row" style={{ alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div className="label">Tint</div>
        <input
          className="input"
          type="color"
          value={tint}
          onChange={(e) => setTint(e.target.value)}
        />
        <span style={{ flex: 1 }} />
        <button className="btn" onClick={scan} disabled={busy}>
          {busy ? 'Scanning…' : 'Rescan'}
        </button>
        <label className="btn" style={{ cursor: 'pointer' }}>
          Upload
          <input
            type="file"
            accept=".glb"
            onChange={onUpload}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      <div style={{ display: 'grid', gap: 6, maxHeight: 220, overflow: 'auto' }}>
        {models.map((m) => (
          <div key={m.url} className="row" style={{ gap: 8 }}>
            <div
              className="label"
              title={`${m.url} (${m.source})`}
              style={{
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {m.name}
            </div>
            <button className="btn" onClick={() => showInfo(m.url)}>
              Info
            </button>
            <button className="btn" onClick={() => spawn(m)}>
              Spawn
            </button>
          </div>
        ))}
        {models.length === 0 && (
          <div className="label" style={{ opacity: 0.8 }}>
            (no models found)
          </div>
        )}
      </div>
    </div>
  )
}

function AnimPane() {
  const ap = (window as any).__animPanel || {}
  const [speed, setSpeed] = useState(1)
  const [weight, setWeight] = useState(1)
  const [loop, setLoop] = useState(true)
  const [current, setCurrent] = useState<string>('')
  const [move, setMove] = useState<boolean>(
    () => !!(window as any).__engine?.movement?.enabled,
  )

  useEffect(() => {
    const names = ap.list?.() || []
    if (!current && names.length) setCurrent(names[0])
  }, [ap, current])

  const names = ap.list?.() || []
  const play = () => {
    if (current) ap.play?.(current)
  }
  const fade = () => {
    if (current) ap.fadeTo?.(current, 0.25)
  }
  const stop = () => ap.stop?.()

  const onSpeed = (v: number) => {
    setSpeed(v)
    ap.speed?.(v)
  }
  const onWeight = (v: number) => {
    setWeight(v)
    ap.weight?.(v)
  }
  const onLoop = (v: boolean) => {
    setLoop(v)
    ap.loop?.(v ? 'on' : 'off')
  }

  const toggleMove = () => {
    const eng = (window as any).__engine
    const next = !move
    setMove(next)
    eng?.movement?.enable?.(next)
  }

  return (
    <div className="panel">
      <div className="row" style={{ gap: 8, marginBottom: 8 }}>
        <select
          className="input"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        >
          {names.map((n: string) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <button className="btn" onClick={play}>
          Play
        </button>
        <button className="btn" onClick={fade}>
          Fade
        </button>
        <button className="btn" onClick={stop}>
          Stop
        </button>
        <span style={{ flex: 1 }} />
        <button
          className={`btn ${move ? 'ok' : ''}`}
          onClick={toggleMove}
          title="Enable WASD movement for the selected actor"
        >
          {move ? 'Movement: ON' : 'Movement: OFF'}
        </button>
      </div>

      <div className="row" style={{ gap: 8 }}>
        <div className="label" style={{ width: 60 }}>
          Speed
        </div>
        <input
          className="input"
          type="range"
          min={0}
          max={2}
          step={0.01}
          value={speed}
          onChange={(e) => onSpeed(parseFloat(e.target.value))}
        />
        <div className="label" style={{ width: 40, textAlign: 'right' }}>
          {speed.toFixed(2)}
        </div>
      </div>
      <div className="row" style={{ gap: 8 }}>
        <div className="label" style={{ width: 60 }}>
          Weight
        </div>
        <input
          className="input"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={weight}
          onChange={(e) => onWeight(parseFloat(e.target.value))}
        />
        <div className="label" style={{ width: 40, textAlign: 'right' }}>
          {weight.toFixed(2)}
        </div>
      </div>
      <div className="row" style={{ gap: 12, marginTop: 6 }}>
        <label className="label">
          <input
            type="checkbox"
            checked={loop}
            onChange={(e) => onLoop(e.target.checked)}
          />{' '}
          Loop
        </label>
        <label className="label">
          <input
            type="checkbox"
            onChange={() => (window as any).__animPanel?.wave?.toggle?.()}
          />{' '}
          Wave
        </label>
      </div>
    </div>
  )
}

/* ───────── Options ───────── */
function OptionsModal({
  open,
  onClose,
  opts,
  setOpts,
  onResetLayout,
}: {
  open: boolean
  onClose: () => void
  opts: UiOpts
  setOpts: (p: Partial<UiOpts>) => void
  onResetLayout: () => void
}) {
  if (!open) return null
  return (
    <div className="opts-backdrop" onClick={onClose}>
      <div className="opts-modal" onClick={(e) => e.stopPropagation()}>
        <div className="opts-title">
          <b>Options</b>
          <button className="btn" onClick={onClose} title="Close">
            ✕
          </button>
        </div>

        <div className="opts-section">
          <div className="opts-header">UI</div>
          <label className="label">
            <input
              type="checkbox"
              checked={opts.lock}
              onChange={(e) => setOpts({ lock: e.target.checked })}
            />{' '}
            Lock UI (panes, floats, splitter)
          </label>
          <label className="label">
            <input
              type="checkbox"
              checked={opts.compact}
              onChange={(e) => setOpts({ compact: e.target.checked })}
            />{' '}
            Compact UI
          </label>
          <label className="label">
            <input
              type="checkbox"
              checked={opts.showConsole}
              onChange={(e) => setOpts({ showConsole: e.target.checked })}
            />{' '}
            Show Debug Console
          </label>
          <div className="row" style={{ marginTop: 8, justifyContent: 'flex-end' }}>
            <button
              className="btn danger"
              onClick={onResetLayout}
              title="Restore default layout"
            >
              Reset Dock Layout
            </button>
          </div>
        </div>

        <div className="opts-section">
          <div className="opts-header">Renderer (GPU)</div>
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <div className="label" style={{ width: 100 }}>
              Pixel Ratio
            </div>
            <select
              className="input"
              value={String(opts.pixelRatio)}
              onChange={(e) => {
                const v =
                  e.target.value === 'auto'
                    ? 'auto'
                    : (parseFloat(e.target.value) as 1 | 1.5 | 2)
                setOpts({ pixelRatio: v })
              }}
            >
              <option value="auto">Auto</option>
              <option value="1">1</option>
              <option value="1.5">1.5</option>
              <option value="2">2</option>
            </select>
          </div>
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <label className="label">
              <input
                type="checkbox"
                checked={opts.shadows !== 'off'}
                onChange={(e) =>
                  setOpts({ shadows: e.target.checked ? 'pcfsoft' : 'off' })
                }
              />{' '}
              Shadows
            </label>
            <select
              className="input"
              value={opts.shadows === 'off' ? 'pcfsoft' : opts.shadows}
              onChange={(e) => setOpts({ shadows: e.target.value as any })}
              disabled={opts.shadows === 'off'}
            >
              <option value="pcf">PCF</option>
              <option value="pcfsoft">PCF Soft</option>
            </select>
          </div>
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <div className="label" style={{ width: 100 }}>
              Exposure
            </div>
            <input
              className="input"
              type="range"
              min={0.2}
              max={2}
              step={0.01}
              value={opts.exposure}
              onChange={(e) => setOpts({ exposure: parseFloat(e.target.value) })}
            />
            <div className="label" style={{ width: 40, textAlign: 'right' }}>
              {opts.exposure.toFixed(2)}
            </div>
          </div>
        </div>

        <div className="label" style={{ opacity: 0.7, marginTop: 8 }}>
          Press Esc again to close.
        </div>
      </div>
    </div>
  )
}

/* ───────── HUD shell ───────── */
export default function HUD() {
  const mode = useWorld((s) => s.mode)
  const setMode = useWorld((s) => s.setMode)
  const selectedIds = useWorld((s) => s.selectedIds)
  const clearSelection = useWorld((s) => s.clearSelection)

  const [layout, setLayout] = useLayout()
  const [opts, setOpts] = useUiOpts()
  const [activeTab, setActiveTab] = useState<Record<DockKey, WinId | null>>({
    left: layout.docks.left[0] || null,
    right: layout.docks.right[0] || null,
    bottomL: layout.docks.bottomL[0] || null,
    bottomR: layout.docks.bottomR[0] || null,
  })
  const [showOpts, setShowOpts] = useState(false)

  // which windows are currently visible (top round buttons toggle these)
  const [visibleWins, setVisibleWins] = useState<Record<WinId, boolean>>({
    world: true,
    spawns: true,
    actors: true,
    scene: true,
    anim: true,
  })

  // dock height persistence
  const [dockH, setDockH] = useState<number>(() => {
    const raw = localStorage.getItem(DOCKH_LSK)
    return raw ? Math.max(140, Math.min(520, parseInt(raw))) : 280
  })
  useEffect(() => {
    document.documentElement.style.setProperty('--dock-h', `${dockH}px`)
    localStorage.setItem(DOCKH_LSK, String(dockH))
  }, [dockH])

  const hasBottom = (['bottomL', 'bottomR'] as DockKey[]).some((side) =>
    layout.docks[side].some((id) => visibleWins[id]),
  )
  const hasTop = (['left', 'right'] as DockKey[]).some((side) =>
    layout.docks[side].some((id) => visibleWins[id]),
  )

  // reflect has-bottom on root for CSS offsets
  useEffect(() => {
    const root = document.querySelector('.hud')
    if (root) root.classList.toggle('has-bottom', hasBottom)
  }, [hasBottom])

  const onResizeDockStart = (e: React.MouseEvent) => {
    const startY = e.clientY
    const startH = dockH
    const onMove = (ev: MouseEvent) =>
      setDockH(Math.max(140, Math.min(520, startH + (startY - ev.clientY))))
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const winBodies: Record<WinId, React.ReactNode> = {
    world: <WorldPane />,
    actors: <ActorsPane />,
    anim: <AnimPane />,
    scene: <ActorManager />,
    spawns: <SpawnPanel />,
  }

  const moveToDock = (win: WinId, dest: DockKey) => {
    setLayout((prev) => {
      const next: Layout = JSON.parse(JSON.stringify(prev))
      ;(['left', 'right', 'bottomL', 'bottomR'] as DockKey[]).forEach(
        (k) => (next.docks[k] = next.docks[k].filter((id) => id !== win)),
      )
      next.floats = next.floats.filter((f) => f.id !== win)
      if (!next.docks[dest].includes(win)) next.docks[dest].push(win)
      return normalizeV4(next)
    })
    setActiveTab((a) => ({ ...a, [dest]: win }))
  }

  const tearOff = (win: WinId) => {
    setLayout((prev) => {
      const next: Layout = JSON.parse(JSON.stringify(prev))
      ;(['left', 'right', 'bottomL', 'bottomR'] as DockKey[]).forEach(
        (k) => (next.docks[k] = next.docks[k].filter((id) => id !== win)),
      )
      if (!next.floats.find((f) => f.id === win))
        next.floats.push({ id: win, x: 60, y: 60, w: 360 })
      return normalizeV4(next)
    })
  }

  const closeFloat = (win: WinId) => {
    setLayout((prev) => ({ ...prev, floats: prev.floats.filter((f) => f.id !== win) }))
  }

  const toggleBottomDock = () => {
    setLayout((prev) => {
      const next: Layout = JSON.parse(JSON.stringify(prev))
      const anyBottom = next.docks.bottomL.length || next.docks.bottomR.length
      if (anyBottom) {
        // move all bottom tabs back to right (dedup)
        next.docks.right = Array.from(
          new Set([
            ...next.docks.right,
            ...next.docks.bottomL,
            ...next.docks.bottomR,
          ]),
        )
        next.docks.bottomL = []
        next.docks.bottomR = []
      } else {
        // recreate from the canonical default
        next.docks.bottomL = [...defaultLayout.docks.bottomL]
        next.docks.bottomR = [...defaultLayout.docks.bottomR]
        ;(['left', 'right'] as DockKey[]).forEach((side) => {
          next.docks[side] = next.docks[side].filter(
            (id) =>
              !next.docks.bottomL.includes(id) && !next.docks.bottomR.includes(id),
          )
        })
      }
      return normalizeV4(next)
    })
  }

  // keep active tabs valid after moves
  useEffect(() => {
    ;(['left', 'right', 'bottomL', 'bottomR'] as DockKey[]).forEach((side) => {
      const ids = layout.docks[side].filter((id) => visibleWins[id])
      setActiveTab((a) => {
        const cur = a[side]
        return ids.length === 0
          ? { ...a, [side]: null }
          : !cur || !ids.includes(cur)
          ? { ...a, [side]: ids[0] }
          : a
      })
    })
  }, [
    layout.docks.left,
    layout.docks.right,
    layout.docks.bottomL,
    layout.docks.bottomR,
    visibleWins,
  ])

  const resetDockLayout = () => {
    // hard reset (clear storage + restore defaults)
    localStorage.removeItem(LSK_V4)
    localStorage.removeItem(DOCKH_LSK)
    setLayout(defaultLayout)
    setDockH(280)
    setActiveTab({
      left: defaultLayout.docks.left[0] || null,
      right: defaultLayout.docks.right[0] || null,
      bottomL: defaultLayout.docks.bottomL[0] || null,
      bottomR: defaultLayout.docks.bottomR[0] || null,
    })
    setVisibleWins({
      world: true,
      spawns: true,
      actors: true,
      scene: true,
      anim: true,
    })
  }

  const handleToolClick = (win: WinId) => {
    setVisibleWins((prev) => {
      const willShow = !prev[win]
      const next = { ...prev, [win]: willShow }

      if (willShow) {
        // make this tab active wherever it lives
        setActiveTab((a) => {
          const out = { ...a }
          ;(['left', 'right', 'bottomL', 'bottomR'] as DockKey[]).forEach(
            (side) => {
              const ids = layout.docks[side]
              if (ids.includes(win)) out[side] = win
            },
          )
          return out
        })
      } else {
        // ensure active tabs stay on visible windows
        setActiveTab((a) => {
          const out = { ...a }
          ;(['left', 'right', 'bottomL', 'bottomR'] as DockKey[]).forEach(
            (side) => {
              const ids = layout.docks[side].filter((id) => next[id])
              const cur = out[side]
              if (!cur || !next[cur] || !ids.includes(cur)) {
                out[side] = ids[0] || null
              }
            },
          )
          return out
        })
      }

      return next
    })
  }

  // Hotkeys: Esc for options; '9' Play/Edit; '=' clear selection
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowOpts((o) => !o)
      else if (e.code === 'Digit9' || e.key === '9')
        setMode(mode === 'play' ? 'edit' : 'play')
      else if (e.key === '=') {
        clearSelection()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode, setMode, clearSelection])

  return (
    <div className="hud">
      <div className="dock-resizer" onMouseDown={onResizeDockStart} />
      <button
        className="btn dock-add"
        title={hasBottom ? 'Remove second dock' : 'Add a second dock'}
        onClick={toggleBottomDock}
      >
        {hasBottom ? '− Dock' : '+ Dock'}
      </button>

      {/* TOP TOOLBAR: cute round buttons for each pane */}
      <div className="hud-toolbar">
        {ALL_WINS.map((id) => (
          <button
            key={id}
            className={`hud-tool-btn ${visibleWins[id] ? 'on' : ''}`}
            title={id.toUpperCase()}
            onClick={() => handleToolClick(id)}
          >
            <span className="hud-tool-label">
              {id === 'world' && 'W'}
              {id === 'spawns' && '+'}
              {id === 'actors' && 'A'}
              {id === 'scene' && 'C'}
              {id === 'anim' && '▶'}
            </span>
          </button>
        ))}
        <button
          className={`hud-tool-btn ${showOpts ? 'on' : ''}`}
          title="Options"
          onClick={() => setShowOpts(true)}
        >
          <span className="hud-tool-label">⚙</span>
        </button>
      </div>

      {/* TOP ROW: left & right */}
      {hasTop && (
        <div className="dock-row">
          {(['left', 'right'] as DockKey[]).map((side) => {
            const ids = layout.docks[side].filter((id) => visibleWins[id])
            const active =
              activeTab[side] && ids.includes(activeTab[side]!)
                ? activeTab[side]!
                : ids[0] || null
            const body = active ? winBodies[active] : null
            return (
              <DockArea key={side} ids={ids} onDrop={(id) => moveToDock(id, side)}>
                <div className="dock-tabbar">
                  {ids.map((id) => (
                    <Tab
                      key={id}
                      id={id}
                      active={active === id}
                      onClick={() =>
                        setActiveTab((a) => ({ ...a, [side]: id }))
                      }
                      onTear={() => tearOff(id)}
                    />
                  ))}
                </div>
                <div className="dock-body">{body}</div>
              </DockArea>
            )
          })}
        </div>
      )}

      {/* BOTTOM ROW: two boxes */}
      {hasBottom && (
        <div className="dock-bottom">
          {(['bottomL', 'bottomR'] as DockKey[]).map((side) => {
            const ids = layout.docks[side].filter((id) => visibleWins[id])
            const active =
              activeTab[side] && ids.includes(activeTab[side]!)
                ? activeTab[side]!
                : ids[0] || null
            const body = active ? winBodies[active] : null
            return (
              <DockArea key={side} ids={ids} onDrop={(id) => moveToDock(id, side)}>
                <div className="dock-tabbar">
                  {ids.map((id) => (
                    <Tab
                      key={id}
                      id={id}
                      active={active === id}
                      onClick={() =>
                        setActiveTab((a) => ({ ...a, [side]: id }))
                      }
                      onTear={() => tearOff(id)}
                    />
                  ))}
                </div>
                <div className="dock-body">{body}</div>
              </DockArea>
            )
          })}
        </div>
      )}

      {/* floating windows */}
      {layout.floats
        .filter((f) => visibleWins[f.id])
        .map((f) => (
          <Floating
            key={f.id}
            id={f.id}
            x={f.x}
            y={f.y}
            w={f.w}
            body={winBodies[f.id]}
            onClose={() => closeFloat(f.id)}
            onMove={(dx, dy) => {
              if (opts.lock) return
              setLayout((prev) => ({
                ...prev,
                floats: prev.floats.map((ff) =>
                  ff.id === f.id ? { ...ff, x: ff.x + dx, y: ff.y + dy } : ff,
                ),
              }))
            }}
            onResize={(dw) => {
              if (opts.lock) return
              setLayout((prev) => ({
                ...prev,
                floats: prev.floats.map((ff) =>
                  ff.id === f.id
                    ? { ...ff, w: Math.max(260, ff.w + dw) }
                    : ff,
                ),
              }))
            }}
          />
        ))}

      <div className="ghost-note">
        Edit: click to place, right-click to delete, R to rotate. Grid=1m • Press Esc
        for Options • 9 toggles Play/Edit • = clears selection
      </div>

      {/* Quick-spawn icon (only when something is selected) */}
      {selectedIds.length > 0 && (
        <button
          className="spawn-quick"
          title="Attach a spawn to the selected object(s)"
          onClick={() => {
            setActiveTab((a) => ({ ...a, bottomR: 'spawns' }))
            ;(window as any).__engine?.spawns?.showHelpers?.(true)
            ;(window as any).__engine?.spawns?.attachToSelection?.()
          }}
        >
          <img src="/assets/ui/spawn_icon.png" alt="spawn" />
        </button>
      )}

      <OptionsModal
        open={showOpts}
        onClose={() => setShowOpts(false)}
        opts={opts}
        setOpts={setOpts}
        onResetLayout={resetDockLayout}
      />
    </div>
  )
}

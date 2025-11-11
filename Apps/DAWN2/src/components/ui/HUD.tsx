import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useWorld } from '../../state/world'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

/* ────────────────────────────────────────────────────────────────────────── */
/* Small docking system (tabs, drag-merge, tear-off floating, persistence)   */
/* ────────────────────────────────────────────────────────────────────────── */

type WinId = 'world' | 'actors' | 'anim'
type DockKey = 'left' | 'right' | 'bottom'
type WinDef = { id: WinId; title: string; content: React.ReactNode }
type Layout = {
  docks: Record<DockKey, WinId[]>
  floats: Array<{ id: WinId; x: number; y: number; w: number }>
}
const LSK = 'hud-dock-layout-v1'

const defaultLayout: Layout = {
  docks: { left: ['world'], right: ['actors', 'anim'], bottom: [] },
  floats: []
}

function useLayout(): [Layout, (l: Layout) => void] {
  const [state, setState] = useState<Layout>(() => {
    try {
      const raw = localStorage.getItem(LSK)
      if (raw) return JSON.parse(raw)
    } catch {}
    return defaultLayout
  })
  useEffect(() => { localStorage.setItem(LSK, JSON.stringify(state)) }, [state])
  return [state, setState]
}

function Tab({
  id, active, onClick, onTear
}: { id: WinId; active: boolean; onClick: () => void; onTear: () => void }) {
  return (
    <div
      className={`dock-tab ${active ? 'active' : ''}`}
      draggable
      onDragStart={e => e.dataTransfer.setData('text/plain', id)}
      onClick={onClick}
      title="Drag to move. Double-click to tear off."
      onDoubleClick={onTear}
    >
      {id.toUpperCase()}
    </div>
  )
}

function DockArea({
  name, ids, onDrop, children
}: {
  name: DockKey
  ids: WinId[]
  onDrop: (id: WinId) => void
  children: React.ReactNode
}) {
  return (
    <div
      className="dock-area"
      onDragOver={e => e.preventDefault()}
      onDrop={e => onDrop(e.dataTransfer.getData('text/plain') as WinId)}
    >
      <div className="dock-tabbar">
        {ids.map((i) => (
          <div key={i} className="dock-tab ghost">{i.toUpperCase()}</div>
        ))}
      </div>
      <div className="dock-body">{children}</div>
    </div>
  )
}

function Floating({
  id, x, y, w, body, onClose, onMove
}: {
  id: WinId; x: number; y: number; w: number
  body: React.ReactNode
  onClose: () => void
  onMove: (dx: number, dy: number) => void
}) {
  const drag = useRef<{ x: number; y: number } | null>(null)
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
        <button className="btn" onClick={onClose} style={{ marginLeft: 'auto' }}>✕</button>
      </div>
      <div className="floating-body">{body}</div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Panels                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

/** WORLD (palette + world I/O) */
function WorldPane() {
  const palette = useWorld((s) => s.palette)
  const setPalette = useWorld((s) => s.setPalette)
  const rotate = useWorld((s) => s.rotate)
  const clear = useWorld((s) => s.clear)
  const resetWorld = useWorld((s: any) => s.resetWorld ?? (() => s.clear()))
  const exportJSON = useWorld((s) => s.exportJSON)
  const importJSON = useWorld((s) => s.importJSON)
  const fileRef = useRef<HTMLInputElement>(null)

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
        <input className="input num" type="number" min={1} value={palette.size[0]}
          onChange={(e) => setPalette({ size: [parseInt(e.target.value) || 1, palette.size[1], palette.size[2]] })} />
        <input className="input num" type="number" min={1} value={palette.size[1]}
          onChange={(e) => setPalette({ size: [palette.size[0], parseInt(e.target.value) || 1, palette.size[2]] })} />
        <input className="input num" type="number" min={1} value={palette.size[2]}
          onChange={(e) => setPalette({ size: [palette.size[0], palette.size[1], parseInt(e.target.value) || 1] })} />

        <input className="input" type="color" value={palette.color}
          onChange={(e) => setPalette({ color: e.target.value })} />

        <button className="btn" onClick={rotate} title="Rotate 90° (R)">↻</button>
        <button className="btn" onClick={clear}>Clear</button>
        <button className="btn" onClick={onExport}>Export</button>

        <label className="btn" style={{ cursor: 'pointer' }}>
          Import
          <input ref={fileRef} onChange={onImport} type="file" accept="application/json" style={{ display: 'none' }} />
        </label>

        <span style={{ flex: 1 }} />
        <button
          className="btn danger"
          onClick={() => {
            if (confirm('Reset world to defaults? This clears blocks, groups and selection.')) resetWorld()
          }}
        >
          Reset World
        </button>
      </div>
    </div>
  )
}

/** tiny helpers used by ActorsPane */
const LS_UPLOADS = 'glbUploads'
const GUESSES = [
  '/assets/rose.glb',
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
  try { const r = await fetch(url, { method: 'HEAD', cache: 'no-store' }); return r.ok } catch { return false }
}

async function getStats(url: string) {
  const loader = new GLTFLoader()
  const gltf = await loader.loadAsync(url)
  let meshes = 0, skinned = 0, bones = 0, anims = gltf.animations?.length || 0
  let verts = 0
  gltf.scene.traverse((o: any) => {
    if (o.isBone) bones++
    if (o.isMesh) {
      meshes++
      if (o.isSkinnedMesh) skinned++
      const pos = o.geometry?.attributes?.position
      if (pos?.count) verts += pos.count
    }
  })
  return { meshes, skinned, bones, verts, animations: anims }
}

/** ACTORS (scan / upload / spawn with tint + quick stats) */
function ActorsPane() {
  type Model = { name: string; url: string; source: 'manifest' | 'guess' | 'upload' }
  const [models, setModels] = useState<Model[]>([])
  const [tint, setTint] = useState('#ffffff')
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<{ url: string, stats: any | '...' } | null>(null)

  const engine = useMemo(() => ((window as any).__engine ||= {}), [])

  const scan = async () => {
    setBusy(true)
    const guessed = await Promise.all(GUESSES.map(async u => (await exists(u)) ? u : null))
    const guessModels = guessed.filter(Boolean).map(u => ({ name: u!.split('/').pop()!.replace(/\.glb$/i, ''), url: u!, source: 'guess' as const }))

    // simple manifest (optional)
    let manifest: Model[] = []
    try {
      const r = await fetch('/assets/models/manifest.json', { cache: 'no-store' })
      if (r.ok) {
        const arr = await r.json()
        if (Array.isArray(arr)) manifest = arr.map((v: any) => {
          const url = typeof v === 'string' ? v : v.url
          const name = (typeof v === 'string' ? v : (v.name || url)).split('/').pop()?.replace(/\.glb$/i, '') || 'model'
          return { name, url, source: 'manifest' as const }
        })
      }
    } catch {}

    // uploads (persisted)
    let uploads: Model[] = []
    try {
      const raw = localStorage.getItem(LS_UPLOADS)
      const arr = raw ? JSON.parse(raw) : []
      if (Array.isArray(arr)) uploads = arr.map((u: any) => ({ name: u.name, url: u.url, source: 'upload' as const }))
    } catch {}

    const merged = [...manifest, ...guessModels, ...uploads]
    const uniq = Array.from(new Map(merged.map(m => [m.url, m])).values())
    setModels(uniq)
    setBusy(false)
  }

  useEffect(() => { scan() }, [])

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    const url = URL.createObjectURL(f)
    const name = f.name.replace(/\.glb$/i, '')
    const entry: Model = { name, url, source: 'upload' }
    const next = [...models, entry]
    setModels(next)
    localStorage.setItem(LS_UPLOADS, JSON.stringify(next.filter(m => m.source === 'upload')))
    e.currentTarget.value = ''
  }

  const spawn = (m: Model) => engine.spawnActor?.(m.url, { tint })

  const showInfo = async (url: string) => {
    setPreview({ url, stats: '...' })
    try {
      const s = await getStats(url)
      setPreview({ url, stats: s })
    } catch {
      setPreview({ url, stats: null })
    }
  }

  return (
    <div className="panel">
      <div className="row" style={{ alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div className="label">Tint</div>
        <input className="input" type="color" value={tint} onChange={(e) => setTint(e.target.value)} />
        <span style={{ flex: 1 }} />
        <button className="btn" onClick={scan} disabled={busy}>{busy ? 'Scanning…' : 'Rescan'}</button>
        <label className="btn" style={{ cursor: 'pointer' }}>
          Upload
          <input type="file" accept=".glb" onChange={onUpload} style={{ display: 'none' }} />
        </label>
      </div>

      <div style={{ display: 'grid', gap: 6, maxHeight: 220, overflow: 'auto', marginBottom: 8 }}>
        {models.map(m => (
          <div key={m.url} className="row" style={{ gap: 8 }}>
            <div className="label" title={`${m.url} (${m.source})`} style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {m.name}
            </div>
            <button className="btn" onClick={() => showInfo(m.url)}>Info</button>
            <button className="btn" onClick={() => spawn(m)}>Spawn</button>
          </div>
        ))}
        {models.length === 0 && <div className="label" style={{ opacity: .8 }}>(no models found)</div>}
      </div>

      <div className="panel" style={{ background: 'rgba(0,0,0,.25)' }}>
        <div className="label" style={{ fontWeight: 600, marginBottom: 6 }}>Preview</div>
        {!preview && <div className="label" style={{ opacity: .8 }}>(select a model)</div>}
        {preview && preview.stats === '...' && <div className="label">Loading…</div>}
        {preview && preview.stats && preview.stats !== '...' && (
          <div className="label" style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: 4 }}>
            <span>URL:</span><span style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preview.url}</span>
            <span>Meshes:</span><b>{preview.stats.meshes}</b>
            <span>Skinned:</span><b>{preview.stats.skinned}</b>
            <span>Bones:</span><b>{preview.stats.bones}</b>
            <span>Vertices:</span><b>{preview.stats.verts}</b>
            <span>Animations:</span><b>{preview.stats.animations}</b>
          </div>
        )}
      </div>
    </div>
  )
}

/** ANIM (controls routed to __animPanel) */
function AnimPane() {
  const ap = (window as any).__animPanel || {}
  const [speed, setSpeed] = useState(1)
  const [weight, setWeight] = useState(1)
  const [loop, setLoop] = useState(true)
  const [current, setCurrent] = useState<string>('')

  useEffect(() => {
    const names = ap.list?.() || []
    if (!current && names.length) setCurrent(names[0])
  }, [ap, current])

  const names = ap.list?.() || []
  const play = () => { if (current) ap.play?.(current) }
  const fade = () => { if (current) ap.fadeTo?.(current, 0.25) }
  const stop = () => ap.stop?.()

  const onSpeed = (v: number) => { setSpeed(v); ap.speed?.(v) }
  const onWeight = (v: number) => { setWeight(v); ap.weight?.(v) }
  const onLoop = (v: boolean) => { setLoop(v); ap.loop?.(v ? 'on' : 'off') }

  return (
    <div className="panel">
      <div className="row" style={{ gap: 8, marginBottom: 8 }}>
        <select className="input" value={current} onChange={e => setCurrent(e.target.value)}>
          {names.map((n: string) => <option key={n} value={n}>{n}</option>)}
        </select>
        <button className="btn" onClick={play}>Play</button>
        <button className="btn" onClick={fade}>Fade</button>
        <button className="btn" onClick={stop}>Stop</button>
        <button className="btn" onClick={() => (window as any).__engine?.actors && console.log('__engine.actors', (window as any).__engine.actors)}>Actors…</button>
      </div>
      <div className="row" style={{ gap: 8 }}>
        <div className="label" style={{ width: 60 }}>Speed</div>
        <input className="input" type="range" min={0} max={2} step={0.01} value={speed} onChange={e => onSpeed(parseFloat(e.target.value))} />
        <div className="label" style={{ width: 40, textAlign: 'right' }}>{speed.toFixed(2)}</div>
      </div>
      <div className="row" style={{ gap: 8 }}>
        <div className="label" style={{ width: 60 }}>Weight</div>
        <input className="input" type="range" min={0} max={1} step={0.01} value={weight} onChange={e => onWeight(parseFloat(e.target.value))} />
        <div className="label" style={{ width: 40, textAlign: 'right' }}>{weight.toFixed(2)}</div>
      </div>
      <div className="row" style={{ gap: 12, marginTop: 6 }}>
        <label className="label"><input type="checkbox" checked={loop} onChange={e => onLoop(e.target.checked)} /> Loop</label>
        <label className="label"><input type="checkbox" onChange={() => (window as any).__engine?.actors && (window as any).__animPanel?.wave?.toggle?.()} /> Wave</label>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/* HUD (top bar + dock layout)                                               */
/* ────────────────────────────────────────────────────────────────────────── */

export default function HUD() {
  const mode = useWorld((s) => s.mode)
  const setMode = useWorld((s) => s.setMode)

  const [layout, setLayout] = useLayout()
  const [activeTab, setActiveTab] = useState<Record<DockKey, WinId | null>>({
    left: layout.docks.left[0] || null,
    right: layout.docks.right[0] || null,
    bottom: layout.docks.bottom[0] || null
  })

  const winBodies: Record<WinId, React.ReactNode> = {
    world: <WorldPane />,
    actors: <ActorsPane />,
    anim: <AnimPane />,
  }
  const winTitle: Record<WinId, string> = { world: 'World', actors: 'Actors', anim: 'Animation' }

  const moveToDock = (win: WinId, dest: DockKey) => {
    setLayout((prev) => {
      // remove from all
      const next: Layout = JSON.parse(JSON.stringify(prev))
      (Object.keys(next.docks) as DockKey[]).forEach(k => next.docks[k] = next.docks[k].filter(id => id !== win))
      next.floats = next.floats.filter(f => f.id !== win)
      next.docks[dest].push(win)
      return next
    })
    setActiveTab((a) => ({ ...a, [dest]: win }))
  }

  const tearOff = (win: WinId) => {
    setLayout((prev) => {
      const next: Layout = JSON.parse(JSON.stringify(prev))
      ;(Object.keys(next.docks) as DockKey[]).forEach(k => next.docks[k] = next.docks[k].filter(id => id !== win))
      next.floats.push({ id: win, x: 60, y: 60, w: 360 })
      return next
    })
  }

  const closeFloat = (win: WinId) => {
    setLayout(prev => ({ ...prev, floats: prev.floats.filter(f => f.id !== win) }))
  }

  return (
    <div className="hud">

      {/* Top bar mode switcher */}
      <div className="panel" style={{ minWidth: 360 }}>
        <div className="tabs">
          <div className={`tab ${mode === 'play' ? 'active' : ''}`} onClick={() => setMode('play')}>Play</div>
          <div className={`tab ${mode === 'edit' ? 'active' : ''}`} onClick={() => setMode('edit')}>Edit</div>
        </div>
        {mode === 'play' && (
          <div style={{ opacity: .8, fontSize: 12 }}>
            Play mode: use the console for <code>anim …</code> commands. Press <b>Tab</b> to toggle Edit/Play.
            <div style={{ marginTop: 6 }}>
              <button className="btn" onClick={() => (window as any).__animPanel?.__uiToggle?.()}>Open Anim Panel</button>
            </div>
          </div>
        )}
      </div>

      {/* Dock rows */}
      <div className="dock-row">
        {(['left', 'right'] as DockKey[]).map((side) => {
          const ids = layout.docks[side]
          const active = activeTab[side] && ids.includes(activeTab[side]!) ? activeTab[side]! : (ids[0] || null)
          const body = active ? winBodies[active] : null
          return (
            <DockArea
              key={side}
              name={side}
              ids={ids}
              onDrop={(id) => moveToDock(id, side)}
            >
              {/* Tabs for this dock */}
              <div className="dock-tabbar">
                {ids.map((id) => (
                  <Tab
                    key={id}
                    id={id}
                    active={active === id}
                    onClick={() => setActiveTab((a) => ({ ...a, [side]: id }))}
                    onTear={() => tearOff(id)}
                  />
                ))}
              </div>
              <div className="dock-body">{body}</div>
            </DockArea>
          )
        })}
      </div>

      {/* Bottom dock (optional / starts empty) */}
      {layout.docks.bottom.length > 0 && (
        <DockArea
          name="bottom"
          ids={layout.docks.bottom}
          onDrop={(id) => moveToDock(id, 'bottom')}
        >
          <div className="dock-tabbar">
            {layout.docks.bottom.map((id) => (
              <Tab
                key={id}
                id={id}
                active={activeTab.bottom === id}
                onClick={() => setActiveTab((a) => ({ ...a, bottom: id }))}
                onTear={() => tearOff(id)}
              />
            ))}
          </div>
          <div className="dock-body">
            {activeTab.bottom ? winBodies[activeTab.bottom] : null}
          </div>
        </DockArea>
      )}

      {/* Floating windows */}
      {layout.floats.map(f => (
        <Floating
          key={f.id}
          id={f.id}
          x={f.x}
          y={f.y}
          w={f.w}
          body={winBodies[f.id]}
          onClose={() => closeFloat(f.id)}
          onMove={(dx, dy) => {
            setLayout(prev => ({
              ...prev,
              floats: prev.floats.map(ff => ff.id === f.id ? { ...ff, x: ff.x + dx, y: ff.y + dy } : ff)
            }))
          }}
        />
      ))}

      <div className="ghost-note">Edit: click to place, right-click to delete, R to rotate. Grid=1m</div>

      {/* Styles for docking (minimal) */}
      <style>{`
        .dock-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; position: fixed; left: 12px; right: 12px; bottom: 12px; pointer-events: none; }
        .dock-area { background: rgba(0,0,0,.28); border-radius: 10px; padding: 8px; min-height: 220px; pointer-events: all; }
        .dock-tabbar { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 6px; }
        .dock-tab { padding: 6px 10px; border-radius: 8px; background: rgba(255,255,255,.06); cursor: grab; user-select: none; }
        .dock-tab.active { background: rgba(255,255,255,.12); }
        .dock-body { max-height: 320px; overflow: auto; }

        .floating { position: fixed; top: 60px; left: 60px; background: rgba(0,0,0,.45); border: 1px solid rgba(255,255,255,.08); border-radius: 10px; pointer-events: all; }
        .floating-title { display:flex; align-items:center; gap:8px; padding:6px 8px; cursor: move; user-select:none; border-bottom: 1px solid rgba(255,255,255,.08); }
        .floating-body { max-height: 420px; overflow:auto; padding:8px; }
        .panel .row.wrap { gap:10px; flex-wrap:wrap; align-items:center; }
        .panel .input.num { width: 48px; }
        .btn.danger { background:#a33; }
      `}</style>
    </div>
  )
}

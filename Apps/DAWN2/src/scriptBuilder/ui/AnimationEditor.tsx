import React, { useMemo, useState } from 'react'
import { ScriptHost } from '../core/ScriptHost'
import type { ScriptDef } from '../core/ScriptRuntime'

export default function AnimationEditor() {
  const host = useMemo(() => (window as any).__scriptHost as ScriptHost, [])
  const [selected, setSelected] = useState<string>('')
  const [def, setDef] = useState<ScriptDef | null>(null)

  const load = (name: string) => {
    setSelected(name)
    const all = (host as any).scripts as Map<string, ScriptDef> // internal
    const d = all?.get(name)
    setDef(d ? JSON.parse(JSON.stringify(d)) : null)
  }

  const save = () => {
    if (!def) return
    host.remove(def.name)
    host.add(def.name, def)
    host.saveToStorage?.()
  }

  const list = host?.list() || []

  return (
    <div className="panel" style={{ position: 'fixed', left: 8, bottom: 220, minWidth: 360, zIndex: 26 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <strong>Animation Editor</strong>
        <select className="input" value={selected} onChange={e => load(e.target.value)}>
          <option value="" disabled>Select script…</option>
          {list.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      {!def && <div className="label" style={{ opacity: .8 }}>Select a script to edit.</div>}

      {def && (
        <>
          <div className="row" style={{ gap: 6 }}>
            <label className="label" style={{ minWidth: 60 }}>Name</label>
            <input className="input" value={def.name} onChange={e => setDef({ ...def, name: e.target.value })} />
            <label className="label">Target</label>
            <input className="input" value={def.target} onChange={e => setDef({ ...def, target: e.target.value })} />
            <label className="row" style={{ gap: 6 }}>
              <input type="checkbox" checked={def.loop}
                     onChange={e => setDef({ ...def, loop: e.target.checked })} />
              <span className="label">Loop</span>
            </label>
          </div>

          <div style={{ marginTop: 8 }}>
            <div className="label" style={{ marginBottom: 4 }}>Frames</div>
            {def.frames.map((f, i) => (
              <div key={i} className="row" style={{ gap: 6, marginBottom: 4 }}>
                <input className="input" style={{ width: 60 }} type="number" step="0.01"
                       value={f.t} onChange={e => {
                  const v = parseFloat(e.target.value)
                  const frames = [...def.frames]; frames[i] = { ...frames[i], t: isFinite(v) ? v : 0 }
                  setDef({ ...def, frames })
                }} />
                <input className="input" style={{ width: 70 }} type="number" step="0.01"
                       value={f.rot?.[0] ?? 0} onChange={e => {
                  const v = parseFloat(e.target.value)
                  const frames = [...def.frames]; const rot = frames[i].rot || [0,0,0]; rot[0] = v
                  frames[i] = { ...frames[i], rot }
                  setDef({ ...def, frames })
                }} />
                <input className="input" style={{ width: 70 }} type="number" step="0.01"
                       value={f.rot?.[1] ?? 0} onChange={e => {
                  const v = parseFloat(e.target.value)
                  const frames = [...def.frames]; const rot = frames[i].rot || [0,0,0]; rot[1] = v
                  frames[i] = { ...frames[i], rot }
                  setDef({ ...def, frames })
                }} />
                <input className="input" style={{ width: 70 }} type="number" step="0.01"
                       value={f.rot?.[2] ?? 0} onChange={e => {
                  const v = parseFloat(e.target.value)
                  const frames = [...def.frames]; const rot = frames[i].rot || [0,0,0]; rot[2] = v
                  frames[i] = { ...frames[i], rot }
                  setDef({ ...def, frames })
                }} />
                <button className="btn" onClick={() => {
                  const frames = def.frames.filter((_, j) => j !== i)
                  setDef({ ...def, frames })
                }}>Del</button>
              </div>
            ))}
            <button className="btn" onClick={() => {
              const frames = [...def.frames, { t: (def.frames.at(-1)?.t ?? 0) + 0.5, rot: [0,0,0] }]
              setDef({ ...def, frames })
            }}>Add frame</button>
          </div>

          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn" onClick={save}>Save</button>
          </div>
        </>
      )}
    </div>
  )
}

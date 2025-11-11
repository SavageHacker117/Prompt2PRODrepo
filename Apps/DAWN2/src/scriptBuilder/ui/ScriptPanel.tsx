import React, { useEffect, useMemo, useState } from 'react'
import type { ScriptDef } from '../core/ScriptRuntime'
import { ScriptHost } from '../core/ScriptHost'

type PuppetPanelAPI = {
  toggle?: () => void
  _dockAnim?: (on?: boolean) => void
}

export default function ScriptPanel() {
  const [open, setOpen] = useState(false)
  const host = useMemo(() => {
    const w = window as any
    const h: ScriptHost = w.__scriptHost || (w.__scriptHost = new ScriptHost())
    // publish a minimal UI surface for console (“scripts ui”)
    const panel: PuppetPanelAPI = (w.__puppetPanel ||= {})
    panel.toggle = () => { setOpen(v => !v) }
    panel._dockAnim = () => { (w.__animPanel as any)?.__uiToggle?.() }
    return h
  }, [])

  const [list, setList] = useState<string[]>([])
  const [bones, setBones] = useState<string[]>([])
  const [name, setName] = useState('wave')
  const [target, setTarget] = useState('')

  useEffect(() => {
    setList(host.list())
    setBones(Array.from(host.boneMap.keys()))
  }, [host, open])

  const create = () => {
    const def: ScriptDef = {
      name,
      target: target || host.suggestBone('wave') || '',
      loop: true,
      mode: 'offset',
      frames: [{ t: 0, rot: [0, 0, 0] }, { t: 1, rot: [0, 0, 0] }],
    }
    host.add(name, def)
    host.saveToStorage?.()
    setList(host.list())
  }

  return !open ? null : (
    <div className="panel" style={{ position: 'fixed', left: 8, bottom: 8, minWidth: 320, zIndex: 25 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <strong>Scripts</strong>
        <button className="btn" onClick={() => setOpen(false)}>✕</button>
      </div>

      <div className="row" style={{ gap: 6 }}>
        <input className="input" placeholder="New script name" value={name} onChange={e => setName(e.target.value)} />
        <select className="input" value={target} onChange={e => setTarget(e.target.value)}>
          <option value="">(auto)</option>
          {bones.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <button className="btn" onClick={create}>New</button>
      </div>

      <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
        {list.map(n => (
          <div key={n} className="row" style={{ gap: 6 }}>
            <div className="label" style={{ minWidth: 160 }}>{n}</div>
            <button className="btn" onClick={() => { host.start(n) }}>Start</button>
            <button className="btn" onClick={() => { host.stop(n) }}>Stop</button>
            <button className="btn" onClick={() => { host.remove(n); setList(host.list()) }}>Del</button>
          </div>
        ))}
        {list.length === 0 && <div className="label" style={{ opacity: .8 }}>(no scripts)</div>}
      </div>
    </div>
  )
}

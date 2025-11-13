import React, { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'

type Spawn = {
  id: string
  type: 'npc' | 'player' | 'vendor'
  name?: string
  position: THREE.Vector3
  templateUrl?: string
  respawnDelay: number
  maxAlive: number
  alive: Set<string>
}

export default function SpawnPanel() {
  const eng = useMemo(() => (window as any).__engine || {}, [])
  const [list, setList] = useState<Spawn[]>([])
  const [type, setType] = useState<'npc' | 'player' | 'vendor'>(eng.spawns?.ui?.type ?? 'npc')
  const [template, setTemplate] = useState(eng.spawns?.ui?.templateUrl ?? '/assets/models/actors/dino1.glb')
  const [delay, setDelay] = useState<number>(eng.spawns?.ui?.respawnDelay ?? 5)
  const [maxAlive, setMaxAlive] = useState<number>(eng.spawns?.ui?.maxAlive ?? 1)
  const [tool, setTool] = useState<'none'|'place'|'attach'>(eng.spawns?.ui?.tool ?? 'none')

  const refresh = () => setList((eng.spawns?.list?.() || []).slice())

  useEffect(() => {
    const id = setInterval(refresh, 500); return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!eng.spawns?.ui) return
    eng.spawns.ui.type = type
    eng.spawns.ui.templateUrl = template
    eng.spawns.ui.respawnDelay = delay
    eng.spawns.ui.maxAlive = maxAlive
    eng.spawns.ui.tool = tool
  }, [type, template, delay, maxAlive, tool])

  const addAtCenterClick = () => setTool('place')
  const attachOnClick = () => setTool('attach')

  const attachToSelection = () => {
    const lastId: string | undefined = eng.spawns?.ui?.lastCreatedId
    const selected: THREE.Object3D | undefined =
      Array.isArray(eng.selected) ? eng.selected[eng.selected.length - 1] :
      (eng.selected && typeof eng.selected.values === 'function'
        ? Array.from(eng.selected.values()).slice(-1)[0]
        : eng.selected)
    if (!lastId || !selected) return
    eng.spawns.attachToObject?.(lastId, selected)
  }

  const remove = (id: string) => { eng.spawns.remove?.(id); refresh() }

  return (
    <div className="panel">
      <div className="row" style={{ gap:8, marginBottom:8 }}>
        <select className="input" value={type} onChange={e => setType(e.target.value as any)}>
          <option value="npc">NPC</option>
          <option value="player">Player</option>
          <option value="vendor">Vendor</option>
        </select>
        <input className="input" style={{ minWidth: 260 }} value={template} onChange={e => setTemplate(e.target.value)} placeholder="Template GLB URL" />
        <div className="label">Respawn</div>
        <input className="input num" type="number" min={0} max={300} value={delay} onChange={e => setDelay(parseInt(e.target.value || '0'))}/>
        <div className="label">Max</div>
        <input className="input num" type="number" min={1} max={10} value={maxAlive} onChange={e => setMaxAlive(parseInt(e.target.value || '1'))}/>
      </div>

      <div className="row" style={{ gap:8, marginBottom:8 }}>
        <button className={`btn ${tool==='place'?'ok':''}`} onClick={addAtCenterClick} title="Next click places a spawn on ground (Y=0)">Place on Click</button>
        <button className={`btn ${tool==='attach'?'ok':''}`} onClick={attachOnClick} title="Next click attaches last-created spawn to clicked object">Attach on Click</button>
        <button className="btn" onClick={attachToSelection} title="Attach last-created spawn to current selection">Attach to Selection</button>
      </div>

      <div style={{ maxHeight: 220, overflow: 'auto', display: 'grid', gap: 6 }}>
        {list.map((s: any) => (
          <div key={s.id} className="row" style={{ gap:8 }}>
            <div className="label" style={{ minWidth: 80 }}>{s.type.toUpperCase()}</div>
            <div className="label" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name || s.id}</div>
            <div className="label">Alive: {s.alive.size}/{s.maxAlive}</div>
            <button className="btn danger" onClick={() => remove(s.id)}>Remove</button>
          </div>
        ))}
        {list.length === 0 && <div className="label" style={{ opacity:.7 }}>(no spawn points)</div>}
      </div>
    </div>
  )
}

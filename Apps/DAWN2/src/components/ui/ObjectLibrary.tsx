import React, { useMemo, useState } from 'react'
import { useWorld } from '../../state/world'

export default function ObjectLibrary() {
  const blocks = useWorld(s=>s.blocks)
  const groups = useWorld(s=>s.groups)
  const selectedIds = useWorld(s=>s.selectedIds)
  const toggleSelect = useWorld(s=>s.toggleSelect)
  const selectOnly = useWorld(s=>s.selectOnly)
  const removeById = useWorld(s=>s.removeById)
  const groupSelection = useWorld(s=>s.groupSelection)
  const ungroupSelection = useWorld(s=>s.ungroupSelection)

  const [groupName, setGroupName] = useState('')

  const grouped = useMemo(() => {
    const byGroup: Record<string, any[]> = {}
    const ungrouped: any[] = []
    for (const b of blocks) {
      if (b.groupId) {
        byGroup[b.groupId] ||= []
        byGroup[b.groupId].push(b)
      } else ungrouped.push(b)
    }
    return { byGroup, ungrouped }
  }, [blocks])

  return (
    <div className="panel" style={{marginTop:8, minWidth:360}}>
      <div className="row" style={{justifyContent:'space-between'}}>
        <div className="label">Objects</div>
        <div className="row">
          <input className="input" placeholder="New group name" value={groupName} onChange={e=>setGroupName(e.target.value)} style={{width:140}} />
          <button className="btn" onClick={()=>groupSelection(groupName || undefined)}>Group</button>
          <button className="btn" onClick={()=>ungroupSelection()}>Ungroup</button>
        </div>
      </div>

      {groups.map(g => (
        <div key={g.id} style={{marginTop:6}}>
          <div className="label" style={{fontWeight:600}}>{g.name}</div>
          {blocks.filter(b=>b.groupId===g.id).map(b => (
            <Row key={b.id} b={b} selected={selectedIds.includes(b.id)} onClick={(multi)=> multi?toggleSelect(b.id):selectOnly(b.id)} onDelete={()=>removeById(b.id)} />
          ))}
        </div>
      ))}

      {grouped.ungrouped.length>0 && <div className="label" style={{fontWeight:600, marginTop:8}}>Ungrouped</div>}
      {grouped.ungrouped.map(b => (
        <Row key={b.id} b={b} selected={selectedIds.includes(b.id)} onClick={(multi)=> multi?toggleSelect(b.id):selectOnly(b.id)} onDelete={()=>removeById(b.id)} />
      ))}
    </div>
  )
}

function Row({ b, selected, onClick, onDelete }:{ b:any, selected:boolean, onClick:(multi:boolean)=>void, onDelete:()=>void }) {
  return (
    <div className="row" style={{marginTop:6, justifyContent:'space-between', background:selected?'#121722':'transparent', padding:'4px 6px', borderRadius:8}} onClick={(e)=>onClick((e as any).shiftKey)}>
      <div className="row" style={{gap:8, alignItems:'center'}}>
        <div style={{width:12, height:12, borderRadius:3, background:b.color}} />
        <div style={{fontSize:12}}>{b.name || b.type} <span className="label">({b.size.join('×')})</span></div>
      </div>
      <div className="row" style={{gap:6}}>
        <button className="btn" onClick={(e)=>{e.stopPropagation(); onDelete()}}>Del</button>
      </div>
    </div>
  )
}

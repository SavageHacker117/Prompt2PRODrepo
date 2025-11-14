// src/components/ui/SpawnPanel.tsx
import React, { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import type { SpawnPoint, SpawnType } from '../../runtime/scene/SpawnSystem'

type SpawnPresetId =
  | 'dino1'
  | 'dino2'
  | 'dino3'
  | 'mage1'
  | 'mage2'
  | 'rose'
  | 'custom'

const PRESETS: { id: SpawnPresetId; label: string; url?: string }[] = [
  { id: 'dino1', label: 'Dino #1', url: '/assets/models/actors/dino1.glb' },
  { id: 'dino2', label: 'Dino #2', url: '/assets/models/actors/dino2.glb' },
  { id: 'dino3', label: 'Dino #3', url: '/assets/models/actors/dino3.glb' },
  { id: 'mage1', label: 'Mage #1', url: '/assets/models/actors/mage1.glb' },
  { id: 'mage2', label: 'Mage #2', url: '/assets/models/actors/mage2.glb' },
  { id: 'rose', label: 'Rose (hero)', url: '/assets/models/actors/rose.glb' },
  { id: 'custom', label: 'Custom URL…' },
]

function getEngine() {
  return (window as any).__engine || {}
}

export default function SpawnPanel() {
  const eng = useMemo(getEngine, [])
  const [list, setList] = useState<SpawnPoint[]>([])
  const [type, setType] = useState<SpawnType>(eng.spawns?.ui?.type ?? 'npc')

  const initialTemplate: string =
    eng.spawns?.ui?.templateUrl ?? '/assets/models/actors/dino1.glb'

  const [presetId, setPresetId] = useState<SpawnPresetId>(() => {
    const match = PRESETS.find((p) => p.url === initialTemplate)
    return match ? match.id : 'custom'
  })

  const [template, setTemplate] = useState<string>(initialTemplate)
  const [delay, setDelay] = useState<number>(eng.spawns?.ui?.respawnDelay ?? 5)
  const [maxAlive, setMaxAlive] = useState<number>(eng.spawns?.ui?.maxAlive ?? 1)
  const [tool, setTool] = useState<'none' | 'place' | 'attach'>(
    eng.spawns?.ui?.tool ?? 'none',
  )

  const [selectedId, setSelectedId] = useState<string>('')

  const refresh = () => {
    const arr: SpawnPoint[] = (eng.spawns?.list?.() || []).slice()
    setList(arr)
    if (!selectedId && arr.length) {
      setSelectedId(arr[0].id)
    }
  }

  useEffect(() => {
    const id = setInterval(refresh, 500)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!eng.spawns?.ui) return
    eng.spawns.ui.type = type
    eng.spawns.ui.templateUrl = template
    eng.spawns.ui.respawnDelay = delay
    eng.spawns.ui.maxAlive = maxAlive
    eng.spawns.ui.tool = tool
  }, [type, template, delay, maxAlive, tool, eng.spawns])

  const onPresetChange = (id: SpawnPresetId) => {
    setPresetId(id)
    const preset = PRESETS.find((p) => p.id === id)
    if (preset?.url) {
      setTemplate(preset.url)
    }
  }

  const addAtCenterClick = () => setTool('place')
  const attachOnClick = () => setTool('attach')

  const attachToSelection = () => {
    const lastId: string | undefined = eng.spawns?.ui?.lastCreatedId
    const selected: THREE.Object3D | undefined =
      Array.isArray(eng.selected)
        ? eng.selected[eng.selected.length - 1]
        : eng.selected && typeof eng.selected.values === 'function'
        ? Array.from(eng.selected.values()).slice(-1)[0]
        : eng.selected

    if (!lastId || !selected) return
    eng.spawns.attachToObject?.(lastId, selected)
    refresh()
  }

  const remove = (id: string) => {
    eng.spawns.remove?.(id)
    if (selectedId === id) setSelectedId('')
    refresh()
  }

  const focusSpawn = (sp: SpawnPoint) => {
    if (!sp.marker) return
    eng.focus?.(sp.marker)
  }

  const duplicate = (sp: SpawnPoint) => {
    if (!eng.spawns?.create) return
    const worldPos = new THREE.Vector3()
    sp.marker.getWorldPosition(worldPos)

    eng.spawns.create({
      type: sp.type,
      name: sp.name ? sp.name + '_copy' : undefined,
      position: worldPos,
      templateUrl: sp.templateUrl,
      respawnDelay: sp.respawnDelay,
      maxAlive: sp.maxAlive,
      host: sp.host ?? null,
    })

    refresh()
  }

  const selected = list.find((s) => s.id === selectedId)

  return (
    <div className="panel">
      {/* Header / selected spawn preview */}
      {selected ? (
        <div
          className="row"
          style={{
            gap: 8,
            marginBottom: 10,
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div className="label" style={{ opacity: 0.9 }}>
            <b>{selected.name}</b> ({selected.type.toUpperCase()}) · alive{' '}
            {selected.alive.size}/{selected.maxAlive}
          </div>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn" onClick={() => focusSpawn(selected)}>
              Focus
            </button>
            <button className="btn" onClick={() => duplicate(selected)}>
              Dup
            </button>
            <button className="btn danger" onClick={() => remove(selected.id)}>
              X
            </button>
          </div>
        </div>
      ) : (
        <div className="label" style={{ marginBottom: 8, opacity: 0.7 }}>
          (no spawn selected)
        </div>
      )}

      {/* Controls for new spawns */}
      <div className="row" style={{ gap: 8, marginBottom: 8 }}>
        <select
          className="input"
          value={type}
          onChange={(e) => setType(e.target.value as SpawnType)}
        >
          <option value="npc">NPC</option>
          <option value="player">Player</option>
          <option value="vendor">Vendor</option>
        </select>

        <select
          className="input"
          value={presetId}
          onChange={(e) => onPresetChange(e.target.value as SpawnPresetId)}
          style={{ minWidth: 150 }}
        >
          {PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>

        <input
          className="input"
          style={{ minWidth: 260 }}
          value={template}
          onChange={(e) => {
            setTemplate(e.target.value)
            setPresetId('custom')
          }}
          placeholder="Template GLB URL"
        />

        <div className="label">Respawn</div>
        <input
          className="input num"
          type="number"
          min={0}
          max={300}
          value={delay}
          onChange={(e) => setDelay(parseInt(e.target.value || '0', 10))}
        />
        <div className="label">Max</div>
        <input
          className="input num"
          type="number"
          min={1}
          max={10}
          value={maxAlive}
          onChange={(e) => setMaxAlive(parseInt(e.target.value || '1', 10))}
        />
      </div>

      {/* Tool buttons */}
      <div className="row" style={{ gap: 8, marginBottom: 8 }}>
        <button
          className={`btn ${tool === 'place' ? 'ok' : ''}`}
          onClick={addAtCenterClick}
          title="Next click places a spawn on ground (Y=0)"
        >
          Place on Click
        </button>
        <button
          className={`btn ${tool === 'attach' ? 'ok' : ''}`}
          onClick={attachOnClick}
          title="Next click attaches last-created spawn to clicked object"
        >
          Attach on Click
        </button>
        <button
          className="btn"
          onClick={attachToSelection}
          title="Attach last-created spawn to current selection"
        >
          Attach to Selection
        </button>
      </div>

      {/* List of spawns in world */}
      <div
        style={{
          maxHeight: 220,
          overflow: 'auto',
          display: 'grid',
          gap: 6,
        }}
      >
        {list.map((s) => (
          <div
            key={s.id}
            className="row"
            style={{
              gap: 8,
              cursor: 'pointer',
              opacity: selectedId && selectedId !== s.id ? 0.7 : 1,
            }}
            onClick={() => setSelectedId(s.id)}
          >
            <div
              className="label"
              style={{
                minWidth: 70,
                fontWeight: 600,
              }}
            >
              {s.type.toUpperCase()}
            </div>
            <div
              className="label"
              style={{
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {s.name || s.id}
            </div>
            <div className="label">
              {s.alive.size}/{s.maxAlive}
            </div>
            <button
              className="btn"
              onClick={(e) => {
                e.stopPropagation()
                focusSpawn(s)
              }}
            >
              ⊕
            </button>
            <button
              className="btn"
              onClick={(e) => {
                e.stopPropagation()
                duplicate(s)
              }}
            >
              ⧉
            </button>
            <button
              className="btn danger"
              onClick={(e) => {
                e.stopPropagation()
                remove(s.id)
              }}
            >
              X
            </button>
          </div>
        ))}
        {list.length === 0 && (
          <div className="label" style={{ opacity: 0.7 }}>
            (no spawn points)
          </div>
        )}
      </div>
    </div>
  )
}

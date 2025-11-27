// src/components/ui/HUD/WorldPane.tsx
import React, { useRef, useState } from 'react'
import { useWorld } from '../../../state/world'   // ⬅ FIXED

export default function WorldPane() {
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

// src/components/ui/HUD/OptionsModal.tsx
import React from 'react'
import type { UiOpts } from './types'

export default function OptionsModal({
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
            <div className="label" style={{ width: 100 }}>
              GPU Quality
            </div>
            <select
              className="input"
              value={opts.quality}
              onChange={(e) =>
                setOpts({ quality: e.target.value as UiOpts['quality'] })
              }
            >
              <option value="low">Low</option>
              <option value="balanced">Balanced</option>
              <option value="high">High</option>
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

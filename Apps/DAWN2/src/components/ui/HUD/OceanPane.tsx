// src/components/ui/HUD/OceanPane.tsx
import React, { useEffect, useState } from 'react'

type Preset = 'pond' | 'ocean'

function getOcean():
  | {
      setVisible(on: boolean): void
      isVisible(): boolean
      setPreset(preset: Preset): void
      getPreset?: () => Preset
      setWaterLevel(y: number): void
      mesh?: { position?: { y: number } }
    }
  | undefined
{
  // Use the same namespace everywhere (iss.ocean)
  return (window as any).__engine?.iss?.ocean
}

export default function OceanPane() {
  const [available, setAvailable] = useState<boolean>(() => !!getOcean())
  const [enabled, setEnabled] = useState(false)
  const [preset, setPreset] = useState<Preset>('pond')
  const [level, setLevel] = useState(0)

  // Initial sync + light polling so it “just works” even if plugin installs late
  useEffect(() => {
    let cancelled = false

    const syncOnce = () => {
      const ocean = getOcean()
      if (!ocean) {
        if (!cancelled) setAvailable(false)
        return
      }
      if (!cancelled) setAvailable(true)

      try {
        if (!cancelled) setEnabled(!!ocean.isVisible())
      } catch {}

      try {
        const p = ocean.getPreset?.()
        if (p === 'pond' || p === 'ocean') setPreset(p)
      } catch {}

      // read water level from mesh if present (remove small epsilon if you added one)
      try {
        const y = ocean.mesh?.position?.y
        if (typeof y === 'number') setLevel(parseFloat((y).toFixed(2)))
      } catch {}
    }

    syncOnce()
    const onReady = () => syncOnce()
    window.addEventListener('sea:ready', onReady)
    const timer = setInterval(syncOnce, 1000)

    return () => {
      cancelled = true
      clearInterval(timer)
      window.removeEventListener('sea:ready', onReady)
    }
  }, [])

  // Push visibility to plugin
  useEffect(() => {
    const ocean = getOcean()
    if (!ocean) return
    try {
      ocean.setVisible(enabled)
    } catch {}
  }, [enabled])

  // Push preset to plugin
  useEffect(() => {
    const ocean = getOcean()
    if (!ocean) return
    try {
      ocean.setPreset(preset)
    } catch {}
  }, [preset])

  // Push water level to plugin
  useEffect(() => {
    const ocean = getOcean()
    if (!ocean) return
    try {
      ocean.setWaterLevel(level)
    } catch {}
  }, [level])

  const handleRefresh = () => {
    // Re-check and re-sync current values from the plugin
    const ocean = getOcean()
    const ok = !!ocean
    setAvailable(ok)
    if (!ocean) return

    try {
      setEnabled(ocean.isVisible())
    } catch {}

    try {
      const p = ocean.getPreset?.()
      if (p === 'pond' || p === 'ocean') setPreset(p)
    } catch {}

    try {
      const y = ocean.mesh?.position?.y
      if (typeof y === 'number') setLevel(parseFloat((y).toFixed(2)))
    } catch {}
  }

  const disabled = !available

  return (
    <div className="panel">
      {!available && (
        <div className="label" style={{ marginBottom: 8 }}>
          Ocean system not ready yet. Click <b>Refresh</b> once the scene is running.
        </div>
      )}

      <div className="row" style={{ gap: 8, marginBottom: 8 }}>
        <label className="label">
          <input
            type="checkbox"
            checked={enabled}
            disabled={disabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />{' '}
          Enable water
        </label>
        <span style={{ flex: 1 }} />
        <button className="btn" onClick={handleRefresh}>
          Refresh
        </button>
      </div>

      <div className="row" style={{ gap: 8, marginBottom: 8 }}>
        <span className="label">Preset</span>
        <select
          className="input"
          value={preset}
          disabled={disabled}
          onChange={(e) => setPreset(e.target.value as Preset)}
        >
          <option value="pond">Pond (calm, test)</option>
          <option value="ocean">Ocean (full scene)</option>
        </select>
      </div>

      <div className="row" style={{ gap: 8 }}>
        <span className="label" style={{ width: 90 }}>
          Water level
        </span>
        <input
          className="input"
          type="range"
          min={-10}
          max={10}
          step={0.1}
          disabled={disabled}
          value={level}
          onChange={(e) => setLevel(parseFloat(e.target.value))}
        />
        <span className="label" style={{ width: 50, textAlign: 'right' }}>
          {level.toFixed(1)}m
        </span>
      </div>
    </div>
  )
}

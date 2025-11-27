// src/components/ui/HUD/PerfHUD.tsx
import React, { useEffect, useState } from 'react'
import { getPerfSnapshot } from '../../../engine/perf'

type PerfSnap = any

export default function PerfHUD() {
  const [snap, setSnap] = useState<PerfSnap | null>(null)

  useEffect(() => {
    let cancelled = false

    const pullOnce = () => {
      try {
        const s = getPerfSnapshot()
        if (!cancelled && s) setSnap(s as any)
      } catch {
        // renderer / scene may not be ready yet; ignore
      }
    }

    // initial pull
    pullOnce()

    // keep polling every second so it works even if "perf watch" isn't running
    const id = window.setInterval(pullOnce, 1000)

    // ALSO listen to perf:snapshot events when "perf watch" is running,
    // so we reuse that data instead of re-traversing the scene.
    const onEvt = (e: any) => {
      if (!cancelled && e?.detail) setSnap(e.detail)
    }
    window.addEventListener('perf:snapshot', onEvt as any)

    return () => {
      cancelled = true
      window.clearInterval(id)
      window.removeEventListener('perf:snapshot', onEvt as any)
    }
  }, [])

  if (!snap) return null

  const tris = Math.round(snap.tris || 0)
  const texMB = typeof snap.textureMB === 'number' ? snap.textureMB : 0
  const draws = snap.drawCalls ?? snap.draws ?? 0
  const meshes = snap.meshes ?? 0
  const geoms = snap.geometries ?? snap.geoms ?? 0
  const textures = snap.textures ?? 0
  const fps = snap.fps ?? null

  return (
    <div className="perf-hud">
      <div className="perf-title">Perf</div>

      <div className="perf-row">
        <span>Tris</span>
        <span>{tris.toLocaleString()}</span>
      </div>
      <div className="perf-row">
        <span>Textures</span>
        <span>{texMB.toFixed(1)} MB</span>
      </div>
      <div className="perf-row">
        <span>Draws</span>
        <span>{draws.toLocaleString()}</span>
      </div>
      <div className="perf-row">
        <span>Meshes / Geom / Tex</span>
        <span>
          {meshes}/{geoms}/{textures}
        </span>
      </div>
      {fps != null && (
        <div className="perf-row">
          <span>FPS</span>
          <span>{fps.toFixed ? fps.toFixed(1) : fps}</span>
        </div>
      )}

      <div className="perf-foot">
        live scene snapshot · try <code>perf watch</code> for console logging
      </div>

      <style>{`
        .perf-hud {
          position: fixed;
          right: 12px;
          bottom: 12px;
          min-width: 190px;
          background: rgba(0,0,0,0.78);
          border: 1px solid rgba(255,255,255,0.18);
          border-radius: 10px;
          padding: 6px 8px;
          font-size: 11px;
          color: #f5f5f5;
          z-index: 60;             /* above HUD + console */
          pointer-events: none;    /* don't block clicks */
        }
        .perf-title {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: .06em;
          text-transform: uppercase;
          margin-bottom: 4px;
          opacity: .9;
        }
        .perf-row {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          line-height: 1.4;
        }
        .perf-row span:first-child {
          opacity: .75;
        }
        .perf-foot {
          margin-top: 4px;
          font-size: 10px;
          opacity: .55;
        }
      `}</style>
    </div>
  )
}

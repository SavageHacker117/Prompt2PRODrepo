import React, { useEffect, useMemo, useState } from 'react'

type AnimAPI = {
  list?: () => string[]
  play?: (name: string) => boolean
  fadeTo?: (name: string, t?: number) => boolean
  stop?: (name?: string) => boolean
  speed?: (v: number) => boolean
  _getSelectedAction?: () => {
    setEffectiveWeight: (v: number) => void
    setLoop: (mode: number, repeats: number) => void
  } | null
  __uiToggle?: () => boolean
  _updateClips?: (names: string[]) => void
}

const LOOP_REPEAT = 2201 // THREE.LoopRepeat
const LOOP_ONCE = 2200   // THREE.LoopOnce

export default function AnimPanel() {
  const [open, setOpen] = useState(false)
  const [clips, setClips] = useState<string[]>([])
  const [current, setCurrent] = useState<string>('')
  const [speed, setSpeed] = useState(1)
  const [weight, setWeight] = useState(1)
  const [loop, setLoop] = useState(true)

  // Stable global bridge
  const api = useMemo<AnimAPI>(() => ((window as any).__animPanel ||= {}) as AnimAPI, [])

  // Let Rose/console open this UI & push clip names
  useEffect(() => {
    api.__uiToggle = () => { setOpen(v => !v); return true }
    api._updateClips = (names: string[]) => setClips(names)
    return () => {
      const p: any = (window as any).__animPanel
      if (p) { delete p.__uiToggle; delete p._updateClips }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // On first mount, try to fetch names (Rose might already be ready)
  useEffect(() => {
    const first = api.list?.()
    if (first?.length) setClips(first)
    const t = setTimeout(() => {
      const retry = api.list?.()
      if (retry?.length) setClips(retry)
    }, 250)
    return () => clearTimeout(t)
  }, [api])

  // Mirror values so console `anim ...` reflects UI
  useEffect(() => {
    const panel = ((window as any).__animPanel ||= {}) as any
    panel.current = () => current
    panel.speed = (v?: number) => { if (typeof v === 'number') setSpeed(v); return speed }
    panel.weight = (v?: number) => { if (typeof v === 'number') setWeight(v); return weight }
    panel.loop = (onoff?: 'on' | 'off') => { if (onoff) setLoop(onoff === 'on'); return loop }
  }, [current, speed, weight, loop])

  const play = (name: string) => { api.play?.(name); setCurrent(name) }
  const fade = (name: string) => { api.fadeTo?.(name, 0.25); setCurrent(name) }
  const stop = () => api.stop?.()

  const onSpeed = (v: number) => { setSpeed(v); api.speed?.(v) }
  const onWeight = (v: number) => { setWeight(v); api._getSelectedAction?.()?.setEffectiveWeight(v) }
  const onLoop = (on: boolean) => { setLoop(on); api._getSelectedAction?.()?.setLoop(on ? LOOP_REPEAT : LOOP_ONCE, Infinity) }

  if (!open) return null

  const wave = (window as any).__engine?.wave

  return (
    <div className="panel" style={{ position: 'fixed', right: 8, top: 8, minWidth: 280, zIndex: 30 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontWeight: 600 }}>Animation</div>
        <button className="btn" onClick={() => setOpen(false)}>✕</button>
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        {clips.length === 0 && <div className="label">No clips detected.</div>}

        {clips.map(name => (
          <div key={name} className="row" style={{ gap: 6 }}>
            <button className="btn" onClick={() => play(name)}>Play</button>
            <button className="btn" onClick={() => fade(name)}>Fade</button>
            <div style={{ fontSize: 12, alignSelf: 'center', opacity: name === current ? 1 : 0.8 }}>
              {name}{name === current ? ' •' : ''}
            </div>
          </div>
        ))}

        <div className="row">
          <div className="label">Speed</div>
          <input className="input" type="range" min="0" max="3" step="0.05" value={speed}
            onChange={e => onSpeed(parseFloat(e.target.value))} />
          <div style={{ width: 36, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{speed.toFixed(2)}</div>
        </div>

        <div className="row">
          <div className="label">Weight</div>
          <input className="input" type="range" min="0" max="1" step="0.01" value={weight}
            onChange={e => onWeight(parseFloat(e.target.value))} />
          <div style={{ width: 36, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{weight.toFixed(2)}</div>
        </div>

        <div className="row">
          <label className="row" style={{ gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={loop} onChange={e => onLoop(e.target.checked)} />
            <span className="label">Loop</span>
          </label>
          <button className="btn" onClick={stop}>Stop</button>
        </div>

        {wave && (
          <div className="row">
            <label className="row" style={{ gap: 6, alignItems: 'center' }}>
              <input type="checkbox"
                onChange={e => { if (e.target.checked) wave.start(); else wave.stop(); }} />
              <span className="label">Wave</span>
            </label>
            <button className="btn" onClick={() => wave.toggle?.()}>Toggle</button>
          </div>
        )}
      </div>
    </div>
  )
}

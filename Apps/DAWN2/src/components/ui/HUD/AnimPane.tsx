// src/components/ui/HUD/AnimPane.tsx
import React, { useEffect, useState } from 'react'

export default function AnimPane() {
  const [names, setNames] = useState<string[]>([])
  const [speed, setSpeed] = useState(1)
  const [weight, setWeight] = useState(1)
  const [loop, setLoop] = useState(true)
  const [current, setCurrent] = useState<string>('')
  const [move, setMove] = useState<boolean>(
    () => !!(window as any).__engine?.movement?.enabled,
  )

  useEffect(() => {
    let mounted = true

    const refresh = () => {
      const ap = (window as any).__animPanel || {}
      const list: string[] = ap.list?.() || []

      if (!mounted) return

      const unique = Array.from(new Set(list))
      setNames((prev) => {
        if (
          prev.length === unique.length &&
          prev.every((v, i) => v === unique[i])
        ) {
          return prev
        }
        return unique
      })

      setCurrent((cur) => {
        if (!unique.length) return ''
        if (!cur || !unique.includes(cur)) return unique[0]
        return cur
      })
    }

    refresh()
    const id = window.setInterval(refresh, 600)
    return () => {
      mounted = false
      window.clearInterval(id)
    }
  }, [])

  const play = () => {
    const ap = (window as any).__animPanel || {}
    if (current) ap.play?.(current)
  }
  const fade = () => {
    const ap = (window as any).__animPanel || {}
    if (current) ap.fadeTo?.(current, 0.25)
  }
  const stop = () => {
    const ap = (window as any).__animPanel || {}
    ap.stop?.()
  }

  const onSpeed = (v: number) => {
    setSpeed(v)
    const ap = (window as any).__animPanel || {}
    ap.speed?.(v)
  }
  const onWeight = (v: number) => {
    setWeight(v)
    const ap = (window as any).__animPanel || {}
    ap.weight?.(v)
  }
  const onLoop = (v: boolean) => {
    setLoop(v)
    const ap = (window as any).__animPanel || {}
    ap.loop?.(v ? 'on' : 'off')
  }

  const toggleMove = () => {
    const eng = (window as any).__engine
    const next = !move
    setMove(next)
    eng?.movement?.enable?.(next)
  }

  const hasClips = names.length > 0

  return (
    <div className="panel">
      <div className="row" style={{ gap: 8, marginBottom: 8 }}>
        <select
          className="input"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          disabled={!hasClips}
        >
          {names.map((n: string) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <button className="btn" onClick={play} disabled={!hasClips}>
          Play
        </button>
        <button className="btn" onClick={fade} disabled={!hasClips}>
          Fade
        </button>
        <button className="btn" onClick={stop} disabled={!hasClips}>
          Stop
        </button>
        <span style={{ flex: 1 }} />
        <button
          className={`btn ${move ? 'ok' : ''}`}
          onClick={toggleMove}
          title="Enable WASD movement for the selected actor"
        >
          {move ? 'Movement: ON' : 'Movement: OFF'}
        </button>
      </div>

      <div className="row" style={{ gap: 8 }}>
        <div className="label" style={{ width: 60 }}>
          Speed
        </div>
        <input
          className="input"
          type="range"
          min={0}
          max={2}
          step={0.01}
          value={speed}
          onChange={(e) => onSpeed(parseFloat(e.target.value))}
          disabled={!hasClips}
        />
        <div className="label" style={{ width: 40, textAlign: 'right' }}>
          {speed.toFixed(2)}
        </div>
      </div>
      <div className="row" style={{ gap: 8 }}>
        <div className="label" style={{ width: 60 }}>
          Weight
        </div>
        <input
          className="input"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={weight}
          onChange={(e) => onWeight(parseFloat(e.target.value))}
          disabled={!hasClips}
        />
        <div className="label" style={{ width: 40, textAlign: 'right' }}>
          {weight.toFixed(2)}
        </div>
      </div>
      <div className="row" style={{ gap: 12, marginTop: 6 }}>
        <label className="label">
          <input
            type="checkbox"
            checked={loop}
            onChange={(e) => onLoop(e.target.checked)}
            disabled={!hasClips}
          />{' '}
          Loop
        </label>
        <label className="label">
          <input
            type="checkbox"
            onChange={() =>
              (window as any).__animPanel?.wave?.toggle?.()
            }
            disabled={!hasClips}
          />{' '}
          Wave
        </label>
      </div>
    </div>
  )
}

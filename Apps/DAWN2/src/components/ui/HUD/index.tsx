// src/components/ui/HUD/index.tsx
import React, { useEffect, useState } from 'react'
import { useWorld } from '../../../state/world'
import ActorManager from '../ActorManager'
import SpawnPanel from '../SpawnPanel'
import {
  ALL_WINS,
  DOCKH_LSK,
  Layout,
  defaultLayout,
  WinId,
  DockKey,
} from './types'
import { normalizeV4, useDockHeight, useLayout, useUiOpts } from './layoutHooks'
import { DockArea, Floating, Tab } from './primitives'
import WorldPane from './WorldPane'
import ActorsPane from './ActorsPane'
import AnimPane from './AnimPane'
import OptionsModal from './OptionsModal'
import OceanPane from './OceanPane' // 👈 NEW

export default function HUD() {
  // world state hooks
  const selectedIds = useWorld((s) => s.selectedIds)
  const clearSelection = useWorld((s) => s.clearSelection)

  // layout + options
  const [layout, setLayout] = useLayout()
  const [opts, setOpts] = useUiOpts()
  const [dockH, setDockH] = useDockHeight()

  const [activeTab, setActiveTab] = useState<Record<DockKey, WinId | null>>({
    left: layout.docks.left[0] || null,
    right: layout.docks.right[0] || null,
    bottomL: layout.docks.bottomL[0] || null,
    bottomR: layout.docks.bottomR[0] || null,
  })
  const [showOpts, setShowOpts] = useState(false)

  // which windows are visible (toolbar toggles)
  const [visibleWins, setVisibleWins] = useState<Record<WinId, boolean>>({
    world: true,
    spawns: true,
    actors: true,
    scene: true,
    anim: true,
    ocean: true, // 👈 show by default
  })

  const hasBottom = (['bottomL', 'bottomR'] as DockKey[]).some((side) =>
    layout.docks[side].some((id) => visibleWins[id]),
  )
  const hasTop = (['left', 'right'] as DockKey[]).some((side) =>
    layout.docks[side].some((id) => visibleWins[id]),
  )

  useEffect(() => {
    const root = document.querySelector('.hud')
    if (root) root.classList.toggle('has-bottom', hasBottom)
  }, [hasBottom])

  const onResizeDockStart = (e: React.MouseEvent) => {
    const startY = e.clientY
    const startH = dockH
    const onMove = (ev: MouseEvent) =>
      setDockH(Math.max(140, Math.min(520, startH + (startY - ev.clientY))))
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const winBodies: Record<WinId, React.ReactNode> = {
    world: <WorldPane />,
    actors: <ActorsPane />,
    anim: <AnimPane />,
    scene: <ActorManager />,
    spawns: <SpawnPanel />,
    ocean: <OceanPane />, // 👈 NEW
  }

  const moveToDock = (win: WinId, dest: DockKey) => {
    setLayout((prev) => {
      const next: Layout = JSON.parse(JSON.stringify(prev))
      ;(['left', 'right', 'bottomL', 'bottomR'] as DockKey[]).forEach((k) => {
        next.docks[k] = next.docks[k].filter((id) => id !== win)
      })
      next.floats = next.floats.filter((f) => f.id !== win)
      if (!next.docks[dest].includes(win)) next.docks[dest].push(win)
      return normalizeV4(next)
    })
    setActiveTab((a) => ({ ...a, [dest]: win }))
  }

  const tearOff = (win: WinId) => {
    setLayout((prev) => {
      const next: Layout = JSON.parse(JSON.stringify(prev))
      ;(['left', 'right', 'bottomL', 'bottomR'] as DockKey[]).forEach((k) => {
        next.docks[k] = next.docks[k].filter((id) => id !== win)
      })
      if (!next.floats.find((f) => f.id === win)) {
        next.floats.push({ id: win, x: 60, y: 60, w: 360 })
      }
      return normalizeV4(next)
    })
  }

  const closeFloat = (win: WinId) => {
    setLayout((prev) => ({
      ...prev,
      floats: prev.floats.filter((f) => f.id !== win),
    }))
  }

  const toggleBottomDock = () => {
    setLayout((prev) => {
      const next: Layout = JSON.parse(JSON.stringify(prev))
      const anyBottom = next.docks.bottomL.length || next.docks.bottomR.length

      if (anyBottom) {
        next.docks.right = Array.from(
          new Set([
            ...next.docks.right,
            ...next.docks.bottomL,
            ...next.docks.bottomR,
          ]),
        )
        next.docks.bottomL = []
        next.docks.bottomR = []
      } else {
        next.docks.bottomL = [...defaultLayout.docks.bottomL]
        next.docks.bottomR = [...defaultLayout.docks.bottomR]
        ;(['left', 'right'] as DockKey[]).forEach((side) => {
          next.docks[side] = next.docks[side].filter(
            (id) => !next.docks.bottomL.includes(id) && !next.docks.bottomR.includes(id),
          )
        })
      }
      return normalizeV4(next)
    })
  }

  useEffect(() => {
    ;(['left', 'right', 'bottomL', 'bottomR'] as DockKey[]).forEach((side) => {
      const ids = layout.docks[side].filter((id) => visibleWins[id])
      setActiveTab((a) => {
        const cur = a[side]
        return ids.length === 0
          ? { ...a, [side]: null }
          : !cur || !ids.includes(cur)
          ? { ...a, [side]: ids[0] }
          : a
      })
    })
  }, [
    layout.docks.left,
    layout.docks.right,
    layout.docks.bottomL,
    layout.docks.bottomR,
    visibleWins,
  ])

  const resetDockLayout = () => {
    localStorage.removeItem('hud-dock-layout-v4')
    localStorage.removeItem(DOCKH_LSK)
    setLayout(defaultLayout)
    setDockH(280)
    setActiveTab({
      left: defaultLayout.docks.left[0] || null,
      right: defaultLayout.docks.right[0] || null,
      bottomL: defaultLayout.docks.bottomL[0] || null,
      bottomR: defaultLayout.docks.bottomR[0] || null,
    })
    setVisibleWins({
      world: true,
      spawns: true,
      actors: true,
      scene: true,
      anim: true,
      ocean: true,
    })
  }

  const handleToolClick = (win: WinId) => {
    setVisibleWins((prev) => {
      const willShow = !prev[win]
      const next = { ...prev, [win]: willShow }

      if (willShow) {
        setActiveTab((a) => {
          const out = { ...a }
          ;(['left', 'right', 'bottomL', 'bottomR'] as DockKey[]).forEach((side) => {
            const ids = layout.docks[side]
            if (ids.includes(win)) out[side] = win
          })
          return out
        })
      } else {
        setActiveTab((a) => {
          const out = { ...a }
          ;(['left', 'right', 'bottomL', 'bottomR'] as DockKey[]).forEach((side) => {
            const ids = layout.docks[side].filter((id) => next[id])
            const cur = out[side]
            if (!cur || !next[cur] || !ids.includes(cur)) {
              out[side] = ids[0] || null
            }
          })
          return out
        })
      }

      return next
    })
  }

  // HUD hotkeys
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowOpts((o) => !o)
      else if (e.key === '=') {
        clearSelection()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [clearSelection])

  return (
    <div className="hud">
      <div className="dock-resizer" onMouseDown={onResizeDockStart} />
      <button
        className="btn dock-add"
        title={hasBottom ? 'Remove second dock' : 'Add a second dock'}
        onClick={toggleBottomDock}
      >
        {hasBottom ? '− Dock' : '+ Dock'}
      </button>

      {/* TOP TOOLBAR */}
      <div className="hud-toolbar">
        {ALL_WINS.map((id) => (
          <button
            key={id}
            className={`hud-tool-btn ${visibleWins[id] ? 'on' : ''}`}
            title={id.toUpperCase()}
            onClick={() => handleToolClick(id)}
          >
            <span className="hud-tool-label">
              {id === 'world' && 'W'}
              {id === 'spawns' && '+'}
              {id === 'actors' && 'A'}
              {id === 'scene' && 'C'}
              {id === 'anim' && '▶'}
              {id === 'ocean' && '🌊'}
            </span>
          </button>
        ))}
        <button
          className={`hud-tool-btn ${showOpts ? 'on' : ''}`}
          title="Options"
          onClick={() => setShowOpts(true)}
        >
          <span className="hud-tool-label">⚙</span>
        </button>
      </div>

      {/* TOP ROW */}
      {hasTop && (
        <div className="dock-row">
          {(['left', 'right'] as DockKey[]).map((side) => {
            const ids = layout.docks[side].filter((id) => visibleWins[id])
            const active =
              activeTab[side] && ids.includes(activeTab[side]!)
                ? activeTab[side]!
                : ids[0] || null
            const body = active ? winBodies[active] : null
            return (
              <DockArea key={side} ids={ids} onDrop={(id) => moveToDock(id, side)}>
                <div className="dock-tabbar">
                  {ids.map((id) => (
                    <Tab
                      key={id}
                      id={id}
                      active={active === id}
                      onClick={() => setActiveTab((a) => ({ ...a, [side]: id }))}
                      onTear={() => tearOff(id)}
                    />
                  ))}
                </div>
                <div className="dock-body">{body}</div>
              </DockArea>
            )
          })}
        </div>
      )}

      {/* BOTTOM ROW */}
      {hasBottom && (
        <div className="dock-bottom">
          {(['bottomL', 'bottomR'] as DockKey[]).map((side) => {
            const ids = layout.docks[side].filter((id) => visibleWins[id])
            const active =
              activeTab[side] && ids.includes(activeTab[side]!)
                ? activeTab[side]!
                : ids[0] || null
            const body = active ? winBodies[active] : null
            return (
              <DockArea key={side} ids={ids} onDrop={(id) => moveToDock(id, side)}>
                <div className="dock-tabbar">
                  {ids.map((id) => (
                    <Tab
                      key={id}
                      id={id}
                      active={active === id}
                      onClick={() => setActiveTab((a) => ({ ...a, [side]: id }))}
                      onTear={() => tearOff(id)}
                    />
                  ))}
                </div>
                <div className="dock-body">{body}</div>
              </DockArea>
            )
          })}
        </div>
      )}

      {/* floating windows */}
      {layout.floats
        .filter((f) => visibleWins[f.id])
        .map((f) => (
          <Floating
            key={f.id}
            id={f.id}
            x={f.x}
            y={f.y}
            w={f.w}
            body={winBodies[f.id]}
            onClose={() => closeFloat(f.id)}
            onMove={(dx, dy) => {
              if (opts.lock) return
              setLayout((prev) => ({
                ...prev,
                floats: prev.floats.map((ff) =>
                  ff.id === f.id ? { ...ff, x: ff.x + dx, y: ff.y + dy } : ff,
                ),
              }))
            }}
            onResize={(dw) => {
              if (opts.lock) return
              setLayout((prev) => ({
                ...prev,
                floats: prev.floats.map((ff) =>
                  ff.id === f.id ? { ...ff, w: Math.max(260, ff.w + dw) } : ff,
                ),
              }))
            }}
          />
        ))}

      <div className="ghost-note">
        Edit: click to place, right-click to delete, R to rotate. Grid=1m • Press Esc
        for Options • 9 toggles Play/Edit • = clears selection
      </div>

      {selectedIds.length > 0 && (
        <button
          className="spawn-quick"
          title="Attach a spawn to the selected object(s)"
          onClick={() => {
            setActiveTab((a) => ({ ...a, bottomR: 'spawns' }))
            ;(window as any).__engine?.spawns?.showHelpers?.(true)
            ;(window as any).__engine?.spawns?.attachToSelection?.()
          }}
        >
          <img src="/assets/ui/spawn_icon.png" alt="spawn" />
        </button>
      )}

      <OptionsModal
        open={showOpts}
        onClose={() => setShowOpts(false)}
        opts={opts}
        setOpts={setOpts}
        onResetLayout={resetDockLayout}
      />
    </div>
  )
}

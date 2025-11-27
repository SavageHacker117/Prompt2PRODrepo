// src/components/ui/HUD/primitives.tsx
import React, { useRef } from 'react'
import type { WinId } from './types'

export function Tab({
  id,
  active,
  onClick,
  onTear,
}: {
  id: WinId
  active: boolean
  onClick: () => void
  onTear: () => void
}) {
  return (
    <div
      className={`dock-tab ${active ? 'active' : ''}`}
      draggable
      onDragStart={(e) => e.dataTransfer.setData('text/plain', id)}
      onDoubleClick={onTear}
      onClick={onClick}
      title="Drag to move. Double-click to tear off."
    >
      {id.toUpperCase()}
    </div>
  )
}

export function DockArea({
  ids,
  onDrop,
  children,
}: {
  ids: WinId[]
  onDrop: (id: WinId) => void
  children: React.ReactNode
}) {
  return (
    <div
      className="dock-area"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => onDrop(e.dataTransfer.getData('text/plain') as WinId)}
    >
      {children}
    </div>
  )
}

export function Floating({
  id,
  x,
  y,
  w,
  body,
  onClose,
  onMove,
  onResize,
}: {
  id: WinId
  x: number
  y: number
  w: number
  body: React.ReactNode
  onClose: () => void
  onMove: (dx: number, dy: number) => void
  onResize: (dw: number, dh: number) => void
}) {
  const drag = useRef<{ x: number; y: number } | null>(null)
  const rez = useRef<{ x: number; y: number } | null>(null)
  return (
    <div className="floating" style={{ left: x, top: y, width: w }}>
      <div
        className="floating-title"
        onMouseDown={(e) => (drag.current = { x: e.clientX, y: e.clientY })}
        onMouseUp={() => (drag.current = null)}
        onMouseMove={(e) => {
          if (!drag.current) return
          const dx = e.clientX - drag.current.x
          const dy = e.clientY - drag.current.y
          drag.current = { x: e.clientX, y: e.clientY }
          onMove(dx, dy)
        }}
      >
        {id.toUpperCase()}
        <button className="btn" onClick={onClose} style={{ marginLeft: 'auto' }}>
          ✕
        </button>
      </div>
      <div className="floating-body">{body}</div>
      <div
        className="float-resizer"
        onMouseDown={(e) => (rez.current = { x: e.clientX, y: e.clientY })}
        onMouseUp={() => (rez.current = null)}
        onMouseMove={(e) => {
          if (!rez.current) return
          const dw = e.clientX - rez.current.x
          rez.current = { x: e.clientX, y: e.clientY }
          onResize(dw, 0)
        }}
      />
    </div>
  )
}

// src/input/useKeys.ts
import { useEffect } from 'react'
import { useWorld } from '../state/world'

export function useKeys() {
  const mode = useWorld((s) => s.mode)
  const setMode = useWorld((s) => s.setMode)
  const rotate = useWorld((s) => s.rotate)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()

      // Play/Edit toggle: Tab or 9
      if (key === 'tab' || e.key === '9') {
        e.preventDefault()
        setMode(mode === 'edit' ? 'play' : 'edit')
        return
      }

      // Rotate world brush
      if (key === 'r') {
        rotate()
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode, setMode, rotate])
}

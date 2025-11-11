import { useEffect } from 'react'
import { useWorld } from '../state/world'

export function useKeys() {
  const mode = useWorld(s=>s.mode)
  const setMode = useWorld(s=>s.setMode)
  const rotate = useWorld(s=>s.rotate)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'tab') { e.preventDefault(); setMode(mode==='edit'?'play':'edit') }
      if (e.key.toLowerCase() === 'r') rotate()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode, setMode, rotate])
}

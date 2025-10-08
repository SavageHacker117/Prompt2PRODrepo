import React, { createContext, useContext, useMemo, useState } from 'react'
import meta from '../data/levels.json'

const Ctx = createContext(null)
export const useGame = () => useContext(Ctx)

export function GameProvider({ children }) {
  const [screen, setScreen] = useState('menu') // 'menu' | 'game' | 'over'
  const [level, setLevel] = useState(1)
  const [score, setScore] = useState(0)
  const [shots, setShots] = useState(2)
  const [best, setBest] = useState(0)
  const [settings, setSettings] = useState({ animations: true })

  const startGame = () => { setScore(0); setShots(2); setLevel(1); setScreen('game') }
  const nextLevel = () => {
    const next = level + 1
    if (next > meta.levels.length) endGame()
    else { setLevel(next); setShots(2) }
  }
  const endGame = () => { setScreen('over'); setBest(b => Math.max(b, score)) }
  const toggleAnimations = () => setSettings(s => ({...s, animations: !s.animations}))
  const addShots = (n=1) => setShots(x => x + n)

  const value = useMemo(() => ({
    screen, setScreen, level, setLevel,
    score, setScore, shots, setShots, addShots,
    best, startGame, nextLevel, endGame,
    meta, settings, toggleAnimations
  }), [screen, level, score, shots, best, settings])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

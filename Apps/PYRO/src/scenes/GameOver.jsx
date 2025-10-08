import React from 'react'
import { useGame } from '../context/GameContext.jsx'

export default function GameOver() {
  const { score, best, setScreen } = useGame()
  return (
    <div className="center">
      <div className="panel" style={{padding:'20px 24px', textAlign:'center', width: 420}}>
        <h2 style={{fontFamily:'Orbitron, sans-serif'}}>Game Over</h2>
        <p>Score: <b>{score}</b></p>
        <p>Best: <b>{best}</b></p>
        <div style={{display:'grid', gap:8, marginTop:12}}>
          <button onClick={() => setScreen('menu')}>Main Menu</button>
        </div>
      </div>
    </div>
  )
}

import React from 'react'
import { useGame } from '../context/GameContext.jsx'

export default function MainMenu() {
  const { startGame } = useGame()
  return (
    <div className="center">
      <div className="panel" style={{padding:'20px 24px', textAlign:'center', width: 420}}>
        <h1 style={{fontFamily:'Orbitron, sans-serif', letterSpacing:'1px'}}>PYRO</h1>
        <p style={{opacity:.8, margin:'6px 0 18px'}}>Light all torches with your fireball.<br/>Click & drag to set power and trajectory.</p>
        <div style={{display:'grid', gap:8}}>
          <button onClick={startGame}>Play Game</button>
          <button className="secondary" onClick={()=>alert('Light all required torches with limited shots. Some levels have powerups. Good luck!')}>
            Instructions
          </button>
          <button className="secondary" onClick={()=>alert('Original concept homage. Built with Vite + React + Three.js.')}>Credits</button>
        </div>
      </div>
    </div>
  )
}

import React from 'react'
import { GameProvider, useGame } from './context/GameContext.jsx'
import MainMenu from './scenes/MainMenu.jsx'
import GameScene from './scenes/GameScene.jsx'
import GameOver from './scenes/GameOver.jsx'

function Router() {
  const { screen } = useGame()
  if (screen === 'menu') return <MainMenu />
  if (screen === 'game') return <GameScene />
  return <GameOver />
}

export default function App() {
  return (
    <GameProvider>
      <Router />
    </GameProvider>
  )
}

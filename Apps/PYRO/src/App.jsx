import React from "react";
import { GameProvider } from "@/context/GameContext.jsx";
import GameScene from "@/scenes/GameScene.jsx";

export default function App(){
  return (
    <GameProvider>
      <div style={{position:"fixed", inset:0}}>
        <GameScene />
      </div>
    </GameProvider>
  );
}

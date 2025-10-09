import React, { useCallback, useRef } from "react";
import { useGame } from "@/context/GameContext.jsx";
import HUD from "@/components/HUD.jsx";
import GameCanvas from "@/components/GameCanvas.jsx";

export default function GameScene() {
  const { level, shots, setShots, nextLevel, endGame, setScore, addShots, settings = {} } = useGame();
  const sceneRef = useRef(null);

  const onComplete = useCallback((bonus=0) => { setScore(s => s + 100 + bonus); nextLevel(); }, [nextLevel, setScore]);
  const onFail     = useCallback(() => { endGame(); }, [endGame]);
  const onConsume  = useCallback(() => { setShots(n => n - 1); }, [setShots]);
  const onScene    = useCallback((scene) => { sceneRef.current = scene; }, []);

  return (
    <div style={{height:"100%", position:"relative"}}>
      <HUD />
      <GameCanvas
        key={level}
        level={level}
        shots={shots}
        settings={settings}
        addShots={addShots}
        onComplete={onComplete}
        onFail={onFail}
        onConsumeShot={onConsume}
        onSceneReady={onScene}
      />
    </div>
  );
}

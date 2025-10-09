import React, { createContext, useContext, useMemo, useState } from "react";

const GameCtx = createContext(null);

export function GameProvider({ children }) {
  const [level, setLevel]   = useState(1);
  const [shots, setShots]   = useState(5);
  const [score, setScore]   = useState(0);
  const [settings, setSettings] = useState({
    preset: "Medium",
    animations: true,
    trail: true,
    caustics: true,
    bloom: true,
    bloomStrength: 0.85,
    fireballGlow: 0.65,
    exposure: 1.0,
    showModelLab: false,
  });

  const nextLevel = () => setLevel(l => Math.min(99, l + 1));
  const endGame   = () => setLevel(1);

  const addShots = (inc=1) => setShots(n => n + inc);

  const value = useMemo(() => ({
    level, setLevel,
    shots, setShots,
    score, setScore,
    settings, setSettings,
    nextLevel, endGame, addShots
  }), [level, shots, score, settings]);

  return <GameCtx.Provider value={value}>{children}</GameCtx.Provider>;
}

export function useGame(){ return useContext(GameCtx); }

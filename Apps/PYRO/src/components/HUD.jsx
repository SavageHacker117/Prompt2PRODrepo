import React from "react";
import { useGame } from "../context/GameContext.jsx";

export const DEFAULT_SETTINGS = {
  animations: true,
  trail: true,
  caustics: true,
  bloom: true,
  bloomStrength: 0.85,
  preset: "Medium", // Low / Medium / High
};

export default function HUD() {
  const { level, shots, score, settings = {}, setSettings = () => {} } = useGame();
  const s = { ...DEFAULT_SETTINGS, ...settings };

  function applyPreset(name) {
    const map = {
      Low:   { bloom: false, caustics: false, trail: false, bloomStrength: 0.6 },
      Medium:{ bloom: true,  caustics: true,  trail: true,  bloomStrength: 0.85 },
      High:  { bloom: true,  caustics: true,  trail: true,  bloomStrength: 1.3 },
    };
    setSettings(prev => ({ ...(prev||{}), ...map[name], preset: name }));
  }

  return (
    <div style={{
      position:"absolute", top:10, left:10, color:"#cfd8e3",
      fontFamily:"system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif",
      userSelect:"none", zIndex:10
    }}>
      <div style={{padding:"8px 10px", background:"rgba(0,0,0,.45)", borderRadius:8, minWidth:240}}>
        <div>Level: <strong>{String(level).padStart(2,"0")}</strong></div>
        <div>Shots: <strong>x{shots}</strong></div>
        <div>Score: <strong>{score}</strong></div>

        <hr style={{border:"none", borderTop:"1px solid rgba(255,255,255,.1)", margin:"8px 8px"}}/>

        {/* Preset */}
        <div style={{display:"flex", alignItems:"center", gap:8}}>
          <span style={{fontSize:12, opacity:.85}}>Quality</span>
          <select
            value={s.preset}
            onChange={e => applyPreset(e.target.value)}
            style={{background:"#0e1522", color:"#cfd8e3", border:"1px solid #263241", borderRadius:6, padding:"3px 6px"}}
          >
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
          </select>
        </div>

        {/* Toggles */}
        <label style={{display:"flex", alignItems:"center", gap:8, cursor:"pointer", marginTop:6}}>
          <input type="checkbox"
            checked={!!s.animations}
            onChange={e => setSettings(v => ({...(v||{}), animations:e.target.checked}))}
          />
          FX: {s.animations ? "On" : "Off"}
        </label>
        <label style={{display:"flex", alignItems:"center", gap:8, cursor:"pointer", marginTop:6}}>
          <input type="checkbox"
            checked={s.trail}
            onChange={e => setSettings(v => ({...(v||{}), trail:e.target.checked}))}
          />
          Trail: {s.trail ? "On" : "Off"}
        </label>
        <label style={{display:"flex", alignItems:"center", gap:8, cursor:"pointer", marginTop:6}}>
          <input type="checkbox"
            checked={s.caustics}
            onChange={e => setSettings(v => ({...(v||{}), caustics:e.target.checked}))}
          />
          Caustics: {s.caustics ? "On" : "Off"}
        </label>
        <label style={{display:"flex", alignItems:"center", gap:8, cursor:"pointer", marginTop:6}}>
          <input type="checkbox"
            checked={s.bloom}
            onChange={e => setSettings(v => ({...(v||{}), bloom:e.target.checked}))}
          />
          Bloom
        </label>
        <div style={{display:"flex", alignItems:"center", gap:6, opacity:s.bloom?1:.5}}>
          <span style={{fontSize:12, width:110}}>Bloom Strength</span>
          <input
            type="range" min="0" max="2" step="0.05"
            disabled={!s.bloom}
            value={s.bloomStrength}
            onChange={e => setSettings(v => ({...(v||{}), bloomStrength: parseFloat(e.target.value)}))}
            style={{flex:1}}
          />
          <span style={{fontSize:12, width:40, textAlign:"right"}}>{s.bloomStrength.toFixed(2)}</span>
        </div>

        <div style={{marginTop:8, fontSize:12, opacity:.8}}>
          Click + drag the fireball. Press <b>R</b> to reset. Move with <b>WASD</b>.
        </div>
      </div>
    </div>
  );
}

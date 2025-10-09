import React from "react";
import { useGame } from "@/context/GameContext.jsx";

export const DEFAULT_SETTINGS = {
  preset: "Medium",      // Low / Medium / High
  animations: true,
  trail: true,
  caustics: true,
  bloom: true,
  bloomStrength: 0.85,
  fireballGlow: 0.65,
  exposure: 1.0,
  showModelLab: false,
};

export default function HUD() {
  const { level, shots, score, settings = {}, setSettings = () => {}, nextLevel } = useGame();
  const s = { ...DEFAULT_SETTINGS, ...settings };

  const applyPreset = (name) => {
    const map = {
      Low:    { bloom:false, caustics:false, trail:false, bloomStrength:0.6,  exposure:0.9  },
      Medium: { bloom:true,  caustics:true,  trail:true,  bloomStrength:0.85, exposure:1.0  },
      High:   { bloom:true,  caustics:true,  trail:true,  bloomStrength:1.2,  exposure:1.15 },
    };
    setSettings((prev) => ({ ...(prev || {}), ...(map[name] || {}), preset: name }));
  };

  // keep HUD clickable even over canvas
  const stopAll = (e) => { e.stopPropagation(); };

  return (
    <div
      style={{
        position: "absolute", top: 10, left: 10, zIndex: 20,
        color: "#cfd8e3", fontFamily: "system-ui, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
        userSelect: "none",
      }}
      onPointerDown={stopAll}
      onPointerMove={stopAll}
      onWheel={stopAll}
    >
      <div style={{ padding:"10px 12px", background:"rgba(0,0,0,.45)", borderRadius:8, minWidth: 270 }}>
        {/* top row */}
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
          <div><b>Level</b>: {String(level).padStart(2,"0")}</div>
          <div>Shots: <b>x{shots}</b></div>
          <div>Score: <b>{score}</b></div>
          <div style={{ flex:1 }} />
          <button
            onClick={() => setSettings(v => ({ ...(v||{}), showModelLab: !Boolean((v||{}).showModelLab) }))}
            style={{ background:"#1e2b3b", color:"#cfd8e3", border:"1px solid #2b3b50", borderRadius:6, padding:"4px 8px", cursor:"pointer" }}
          >Models</button>
          <button
            onClick={nextLevel}
            style={{ background:"#2b3b1e", color:"#e3f5cf", border:"1px solid #405a2d", borderRadius:6, padding:"4px 8px", cursor:"pointer" }}
          >Next ▶</button>
        </div>

        {/* Quality preset */}
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:12, opacity:.85 }}>Quality</span>
          <select
            value={s.preset}
            onChange={(e) => applyPreset(e.target.value)}
            style={{ background:"#0e1522", color:"#cfd8e3", border:"1px solid #263241", borderRadius:6, padding:"3px 6px" }}
          >
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
          </select>
        </div>

        {/* toggles */}
        <label style={{display:"flex", alignItems:"center", gap:8, cursor:"pointer", marginTop:8}}>
          <input type="checkbox"
            checked={!!s.animations}
            onChange={e => setSettings(v => ({...(v||{}), animations:e.target.checked}))}
          /> FX: {s.animations ? "On" : "Off"}
        </label>

        <label style={{display:"flex", alignItems:"center", gap:8, cursor:"pointer", marginTop:6}}>
          <input type="checkbox"
            checked={!!s.trail}
            onChange={e => setSettings(v => ({...(v||{}), trail:e.target.checked}))}
          /> Trail: {s.trail ? "On" : "Off"}
        </label>

        <label style={{display:"flex", alignItems:"center", gap:8, cursor:"pointer", marginTop:6}}>
          <input type="checkbox"
            checked={!!s.caustics}
            onChange={e => setSettings(v => ({...(v||{}), caustics:e.target.checked}))}
          /> Caustics: {s.caustics ? "On" : "Off"}
        </label>

        <label style={{display:"flex", alignItems:"center", gap:8, cursor:"pointer", marginTop:6}}>
          <input type="checkbox"
            checked={!!s.bloom}
            onChange={e => setSettings(v => ({...(v||{}), bloom:e.target.checked}))}
          /> Bloom
        </label>

        {/* sliders */}
        <div style={{display:"flex", alignItems:"center", gap:6, marginTop:6, opacity:s.bloom?1:.5}}>
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

        <div style={{display:"flex", alignItems:"center", gap:6, marginTop:6}}>
          <span style={{fontSize:12, width:110}}>Fireball Glow</span>
          <input
            type="range" min="0" max="2" step="0.05"
            value={s.fireballGlow}
            onChange={e => setSettings(v => ({...(v||{}), fireballGlow: parseFloat(e.target.value)}))}
            style={{flex:1}}
          />
          <span style={{fontSize:12, width:40, textAlign:"right"}}>{s.fireballGlow.toFixed(2)}</span>
        </div>

        <div style={{display:"flex", alignItems:"center", gap:6, marginTop:6}}>
          <span style={{fontSize:12, width:110}}>Exposure</span>
          <input
            type="range" min="0.5" max="1.8" step="0.01"
            value={s.exposure}
            onChange={e => setSettings(v => ({...(v||{}), exposure: parseFloat(e.target.value)}))}
            style={{flex:1}}
          />
          <span style={{fontSize:12, width:40, textAlign:"right"}}>{s.exposure.toFixed(2)}</span>
        </div>

        <div style={{marginTop:8, fontSize:12, opacity:.8}}>
          Click + drag the fireball. Press <b>R</b> to reset. Move with <b>WASD</b>.
        </div>
      </div>
    </div>
  );
}

import React, { useMemo, useState } from "react";

type Props = {
  fps: number;
  camPos: { x: number; y: number; z: number };
  lookAt: { x: number; y: number; z: number };
  zoom: number;
  markers: number;
  gizmos: boolean;
  logs: string[];
  onSpawn: () => void;
  onClear: () => void;
  onToggle: () => void;
  onCommand: (cmd: string) => void;
};

export default function DebugOverlay(p: Props) {
  const [cmd, setCmd] = useState("");
  const row = (k: string, v: string | number) => (
    <div style={{display:"flex", justifyContent:"space-between"}}>
      <span style={{opacity:.7}}>{k}</span><span>{v}</span>
    </div>
  );
  const cam = useMemo(() => `${p.camPos.x.toFixed(2)}, ${p.camPos.y.toFixed(2)}, ${p.camPos.z.toFixed(2)}`, [p.camPos]);
  const look = useMemo(() => `${p.lookAt.x.toFixed(2)}, ${p.lookAt.y.toFixed(2)}, ${p.lookAt.z.toFixed(2)}`, [p.lookAt]);

  return (
    <div style={{
      position:"fixed", left:12, top:90, zIndex: 9999, width: 300,
      background:"rgba(10,16,24,0.85)", border:"1px solid rgba(255,255,255,.12)",
      borderRadius:14, padding:12, color:"#dfe7ff", fontFamily:"ui-monospace,Consolas,monospace", fontSize:12,
      boxShadow:"0 12px 40px rgba(0,0,0,.45)"
    }}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8}}>
        <b style={{letterSpacing:.5}}>DEBUG</b>
        <div style={{opacity:.9}}>FPS <b>{p.fps}</b></div>
      </div>
      {row("Camera", cam)}
      {row("LookAt", look)}
      {row("Zoom", p.zoom.toFixed(2))}
      {row("Markers", p.markers)}
      {row("Gizmos", p.gizmos ? "on" : "off")}
      <div style={{display:"flex", gap:8, marginTop:10}}>
        <button onClick={p.onSpawn} style={btn}>Spawn</button>
        <button onClick={p.onClear} style={btn}>Clear</button>
        <button onClick={p.onToggle} style={btn}>{p.gizmos ? "Hide" : "Show"}</button>
      </div>
      <div style={{marginTop:10}}>
        <div style={{opacity:.8, marginBottom:4}}>Console</div>
        <form onSubmit={(e)=>{e.preventDefault(); if(cmd.trim()) {p.onCommand(cmd.trim()); setCmd("");}}}>
          <input value={cmd} onChange={e=>setCmd(e.target.value)}
            placeholder='e.g. spawn, clear, cam 0 8 26'
            style={{
              width:"100%", borderRadius:10, border:"1px solid rgba(255,255,255,.12)",
              background:"#0c1522", color:"#e8f0ff", padding:"8px 10px"
            }}
          />
        </form>
        <div style={{maxHeight:120, overflow:"auto", marginTop:6, paddingRight:4}}>
          {p.logs.slice(0,12).map((l,i)=> <div key={i} style={{opacity:.9, whiteSpace:"nowrap", textOverflow:"ellipsis", overflow:"hidden"}}>{l}</div>)}
        </div>
      </div>
    </div>
  );
}

const btn: React.CSSProperties = {
  padding:"6px 10px",
  borderRadius:10,
  border:"1px solid rgba(255,255,255,.12)",
  background:"#21314e",
  color:"#eaf1ff",
  cursor:"pointer"
};

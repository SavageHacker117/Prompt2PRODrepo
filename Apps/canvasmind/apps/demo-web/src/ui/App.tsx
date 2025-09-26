import React from "react";

function call<T>(fn: (api: any) => Promise<T> | void) {
  const api = (window as any).CanvasMindApp;
  if (!api) return;
  return fn(api);
}

export default function App() {
  const [prompt, setPrompt] = React.useState("aurora nebula, photoreal");
  const [batch, setBatch] = React.useState(5);
  const [ground, setGround] = React.useState({ y: 0, rx: 0, rz: 0 });
  const [state, setState] = React.useState({ fps: 0, draws: 0, assets: 0 });

  // poll the engine HUD numbers so we can show them inline if we want later
  React.useEffect(() => {
    const t = setInterval(() => {
      const api = (window as any).CanvasMindApp;
      if (api?.getState) setState(api.getState());
    }, 500);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <input
        value={prompt}
        onChange={(e)=>setPrompt(e.target.value)}
        placeholder='e.g. "volcanic coastline with stormy sky"'
        style={{padding:8,borderRadius:8,border:"1px solid #1e2a44",background:"#0b1222",color:"#e6edf3"}}
      />

      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <button onClick={()=>call(api=>api.applySkybox(prompt))}>Generate Skybox</button>
        <button onClick={()=>call(api=>api.spawnMesh())}>Spawn Mesh</button>
        <button onClick={()=>call(api=>api.clearScene())}>Clear Scene</button>
        <button onClick={()=>call(api=>api.screenshot())}>Screenshot</button>
      </div>

      <h3 style={{margin:"8px 0 4px"}}>MCP Servers</h3>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        <button onClick={()=>call(api=>api.refreshRegistry())}>Refresh Registry</button>
        <span style={{opacity:.7,fontSize:12}}>Assets: {state.assets}</span>
      </div>

      <h3 style={{margin:"8px 0 4px"}}>Batch</h3>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        <input type="range" min={1} max={30} value={batch}
          onChange={(e)=>setBatch(parseInt(e.target.value))}
          onMouseUp={()=>call(api=>api.batchSpawn(batch))} />
        <span>{batch}</span>
        <button onClick={()=>call(api=>api.batchSpawn(batch))}>Spawn {batch}</button>
      </div>

      <h3 style={{margin:"8px 0 4px"}}>Ground Align</h3>
      <label style={{fontSize:12,opacity:.85,display:"flex",gap:6,alignItems:"center"}}>
        Height
        <input type="range" min={-2} max={2} step={0.01}
          onChange={(e)=>{ const y=parseFloat(e.target.value); setGround(g=>({...g,y})); call(api=>api.setGround(y, ground.rx, ground.rz)); }} />
      </label>
      <label style={{fontSize:12,opacity:.85,display:"flex",gap:6,alignItems:"center"}}>
        TiltX
        <input type="range" min={-0.5} max={0.5} step={0.005}
          onChange={(e)=>{ const rx=parseFloat(e.target.value); setGround(g=>({...g,rx})); call(api=>api.setGround(ground.y, rx, ground.rz)); }} />
      </label>
      <label style={{fontSize:12,opacity:.85,display:"flex",gap:6,alignItems:"center"}}>
        TiltZ
        <input type="range" min={-0.5} max={0.5} step={0.005}
          onChange={(e)=>{ const rz=parseFloat(e.target.value); setGround(g=>({...g,rz})); call(api=>api.setGround(ground.y, ground.rx, rz)); }} />
      </label>
    </div>
  );
}

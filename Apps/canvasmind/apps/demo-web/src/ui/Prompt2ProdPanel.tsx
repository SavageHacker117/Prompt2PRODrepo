import React from "react";

function call<T>(fn: (api: any) => Promise<T> | void) {
  const api = (window as any).CanvasMindApp;
  if (!api) return;
  return fn(api);
}

type GrassQuality = "low" | "med" | "high";

export default function Prompt2ProdPanel() {
  const [prompt, setPrompt] = React.useState("aurora nebula, photoreal");
  const [batch, setBatch] = React.useState(5);
  const [ground, setGround] = React.useState({ y: 0, rx: 0, rz: 0 });
  const [state, setState] = React.useState({ fps: 0, draws: 0, assets: 0 });

  // HUD poll
  React.useEffect(() => {
    const t = setInterval(() => {
      const api = (window as any).CanvasMindApp;
      if (api?.getState) setState(api.getState());
    }, 500);
    return () => clearInterval(t);
  }, []);

  // Grass UI state
  const [grass, setGrass] = React.useState({
    size: 12,
    density: 700,
    bladeHeight: 0.35,
    windStrength: 0.6,
    windSpeed: 1.1,
    quality: "med" as GrassQuality,
  });

  // Debounced push to engine
  const raf = React.useRef<number | null>(null);
  const pushGrass = (partial?: Partial<typeof grass>) => {
    const next = { ...grass, ...(partial || {}) };
    setGrass(next);
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      call(api => api.updateGrass?.(next));
    });
  };

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {/* Prompt + actions */}
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

      {/* MCP */}
      <h3 style={{margin:"8px 0 4px"}}>MCP Servers</h3>
      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
        <button onClick={()=>call(api=>api.refreshRegistry())}>Refresh Registry</button>
        <span style={{opacity:.7,fontSize:12}}>Assets: {state.assets}</span>
      </div>

      {/* Batch */}
      <h3 style={{margin:"8px 0 4px"}}>Batch</h3>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        <input
          type="range" min={1} max={30} value={batch}
          onChange={(e)=>setBatch(parseInt(e.target.value))}
          onMouseUp={()=>call(api=>api.batchSpawn(batch))}/>
        <span>{batch}</span>
        <button onClick={()=>call(api=>api.batchSpawn(batch))}>Spawn {batch}</button>
      </div>

      {/* Ground */}
      <h3 style={{margin:"8px 0 4px"}}>Ground Align</h3>
      <label style={{fontSize:12,opacity:.85,display:"flex",gap:6,alignItems:"center"}}>
        Height
        <input
          type="range" min={-2} max={2} step={0.01}
          onChange={(e)=>{ const y=parseFloat(e.target.value); setGround(g=>({...g,y})); call(api=>api.setGround(y, ground.rx, ground.rz)); }}
        />
      </label>
      <label style={{fontSize:12,opacity:.85,display:"flex",gap:6,alignItems:"center"}}>
        TiltX
        <input
          type="range" min={-0.5} max={0.5} step={0.005}
          onChange={(e)=>{ const rx=parseFloat(e.target.value); setGround(g=>({...g,rx})); call(api=>api.setGround(ground.y, rx, ground.rz)); }}
        />
      </label>
      <label style={{fontSize:12,opacity:.85,display:"flex",gap:6,alignItems:"center"}}>
        TiltZ
        <input
          type="range" min={-0.5} max={0.5} step={0.005}
          onChange={(e)=>{ const rz=parseFloat(e.target.value); setGround(g=>({...g,rz})); call(api=>api.setGround(ground.y, ground.rx, rz)); }}
        />
      </label>

      {/* Grass */}
      <h3 style={{margin:"10px 0 6px"}}>Grass</h3>
      <div style={{display:"grid", gap:8}}>
        <label style={{display:"grid", gridTemplateColumns:"110px 1fr", alignItems:"center", gap:8}}>
          <span>Patch Size</span>
          <input type="range" min={6} max={24} step={1} value={grass.size}
            onChange={(e)=>pushGrass({ size: Number(e.target.value) })}/>
        </label>

        <label style={{display:"grid", gridTemplateColumns:"110px 1fr", alignItems:"center", gap:8}}>
          <span>Density</span>
          <input type="range" min={200} max={1200} step={50} value={grass.density}
            onChange={(e)=>pushGrass({ density: Number(e.target.value) })}/>
        </label>

        <label style={{display:"grid", gridTemplateColumns:"110px 1fr", alignItems:"center", gap:8}}>
          <span>Blade Height</span>
          <input type="range" min={0.15} max={0.7} step={0.01} value={grass.bladeHeight}
            onChange={(e)=>pushGrass({ bladeHeight: Number(e.target.value) })}/>
        </label>

        <label style={{display:"grid", gridTemplateColumns:"110px 1fr", alignItems:"center", gap:8}}>
          <span>Wind Strength</span>
          <input type="range" min={0} max={1.5} step={0.01} value={grass.windStrength}
            onChange={(e)=>pushGrass({ windStrength: Number(e.target.value) })}/>
        </label>

        <label style={{display:"grid", gridTemplateColumns:"110px 1fr", alignItems:"center", gap:8}}>
          <span>Wind Speed</span>
          <input type="range" min={0} max={2.0} step={0.01} value={grass.windSpeed}
            onChange={(e)=>pushGrass({ windSpeed: Number(e.target.value) })}/>
        </label>

        <label style={{display:"grid", gridTemplateColumns:"110px 1fr", alignItems:"center", gap:8}}>
          <span>Quality</span>
          <select
            value={grass.quality}
            onChange={(e)=>pushGrass({ quality: e.target.value as GrassQuality })}
            style={{padding:6,borderRadius:8,background:"#0b1222",color:"#e6edf3",border:"1px solid #1e2a44"}}
          >
            <option value="low">Low (fast)</option>
            <option value="med">Medium</option>
            <option value="high">High</option>
          </select>
        </label>

        <div style={{display:"flex", gap:8, flexWrap:"wrap", alignItems:"center", marginTop:4}}>
          <button onClick={()=>call(api=>api.loadGrass?.(grass))}>Load Grass</button>
          <button onClick={()=>call(api=>api.unloadGrass?.())}>Unload Grass</button>
        </div>
      </div>

      {/* Rose / Props quick controls */}
      <h3 style={{margin:"10px 0 6px"}}>Rose / Props</h3>
      <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
        <button onClick={()=>call(api=>api.loadRose?.("/assets/rose.glb"))}>Load Rose</button>
        <button onClick={()=>call(api=>api.unloadRose?.())}>Unload Rose</button>
        <button onClick={()=>call(api=>api.loadTestBall?.())}>Load TestBall</button>
        <button onClick={()=>call(api=>api.unloadTestBall?.())}>Unload TestBall</button>
      </div>
    </div>
  );
}

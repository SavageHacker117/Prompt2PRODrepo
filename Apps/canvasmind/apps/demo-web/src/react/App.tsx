import React from "react";
import CanvasPane from "./CanvasPane";

declare global {
  interface Window {
    CanvasMindApp?: {
      refreshRegistry(): Promise<void>;
      applySkybox(prompt: string): Promise<void>;
      spawnMesh(): Promise<void>;
      batchSpawn(n: number): Promise<void>;
      clearScene(): void;
      screenshot(): void;
      setGround(y: number, rx: number, rz: number): void;
      setQuality(mode: "performance" | "balanced" | "quality"): void;

      loadRose(url?: string): Promise<any>;
      unloadRose(): void;
      playRoseAction(a: "walk" | "run" | "jump", loops?: number): void;

      loadTestBall(): void;
      unloadTestBall(): void;
      loadImportedBall(url: string): Promise<any>;
      unloadImportedBall(): void;

      loadGrass(opts?: any): void;
      unloadGrass(): void;
      updateGrass(opts?: any): void;

      setGizmoMode(mode: "translate"|"rotate"|"scale"): void;
      clearSelection(): void;
      deleteSelection(): void;
      duplicateSelection(): void;
      flipSelectionXZ(): void;

      setBackgroundExposure(v: number): void;
      setBackgroundBlur(v: number): void;

      // procedural
      startProcedural(): Promise<void>;
      stopProcedural(): void;

      getState(): { assets: number; fps: number; draws: number; budget: any };
    };
  }
}

function Tab({label, active, onClick}:{label:string; active:boolean; onClick:()=>void}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding:"6px 10px",
        borderRadius:10,
        border:"1px solid #1e2a44",
        background: active ? "#162036" : "#0b1222",
        color:"#e6edf3",
        fontSize:13,
        marginRight:8,
        cursor:"pointer",
        whiteSpace:"nowrap"
      }}
    >
      {label}
    </button>
  );
}

function Row({children}:{children:React.ReactNode}) {
  return <div style={{display:"flex", gap:10, alignItems:"center", marginBottom:10, flexWrap:"wrap"}}>{children}</div>;
}

function Panel({title, children}:{title:string; children:React.ReactNode}) {
  return (
    <div style={{
      border:"1px solid #1e2a44", background:"#0b1222", borderRadius:12, padding:14
    }}>
      <h3 style={{marginTop:0, marginBottom:12, color:"#e6edf3"}}>{title}</h3>
      {children}
    </div>
  );
}

export default function App() {
  const [tab, setTab] = React.useState<
    "Skybox/Mesh" | "Ground" | "Grass" | "Character" | "Props" | "Editor" | "Quality" | "Procedural" | "MCP"
  >("Skybox/Mesh");

  // HUD loop
  const [fps, setFps] = React.useState<number>(0);
  const [draws, setDraws] = React.useState<number>(0);
  const [assets, setAssets] = React.useState<number>(0);
  React.useEffect(() => {
    const t = setInterval(() => {
      const s = window.CanvasMindApp?.getState();
      if (!s) return;
      setFps(s.fps); setDraws(s.draws); setAssets(s.assets);
    }, 500);
    return () => clearInterval(t);
  }, []);

  // shared local UI state
  const [prompt, setPrompt] = React.useState("aurora nebula, photoreal");
  const [batch, setBatch] = React.useState(5);
  const [roseUrl, setRoseUrl] = React.useState("/assets/rose.glb");
  const [remoteBallUrl, setRemoteBallUrl] = React.useState("https://threejs.org/examples/models/gltf/DamagedHelmet/glTF/DamagedHelmet.gltf");
  const [ground, setGround] = React.useState({ y: 0, rx: 0, rz: 0 });
  const [grass, setGrass] = React.useState({ quality: "med", patchSize: 1.0, density: 1.0, bladeHeight: 0.8, windStrength: 0.6, windSpeed: 1.1 });
  const [exposure, setExposure] = React.useState(1.0);
  const [bgBlur, setBgBlur] = React.useState(0);

  // Procedural controls (drives custom events handled in boot.ts)
  const [proc, setProc] = React.useState({
    width: 14,
    curvature: 1.25,
    bank: 21.5,
    segLen: 80,
    heightAmp: 7,
  });
  const emitProc = (detail: any) => window.dispatchEvent(new CustomEvent("proc.set", { detail }));

  return (
    <div
      style={{
        display:"grid",
        gridTemplateColumns:"420px minmax(0,1fr)",
        width:"100vw",
        height:"100vh",
        color:"#c9d1d9"
      }}
    >
      {/* LEFT: Controls */}
      <div
        style={{
          height:"100vh",
          overflow:"auto",
          background:"#0b1222",
          borderRight:"1px solid #1e2a44"
        }}
      >
        <div className="sticky top-0 z-10" style={{padding:10, background:"#0b1222", borderBottom:"1px solid #1e2a44", display:"flex", flexWrap:"wrap"}}>
          {["Skybox/Mesh","Ground","Grass","Character","Props","Editor","Quality","Procedural","MCP"].map((t)=>(
            <Tab key={t} label={t} active={tab===t} onClick={()=>setTab(t as any)} />
          ))}
        </div>

        <div style={{padding:14, display:"grid", gap:12}}>
          {tab==="Skybox/Mesh" && (
            <Panel title="Skybox & Mesh">
              <Row>
                <input
                  value={prompt}
                  onChange={e=>setPrompt(e.target.value)}
                  placeholder="skybox prompt"
                  style={{flex:1, background:"#091424", color:"#e6edf3", border:"1px solid #1e2a44", borderRadius:10, padding:"8px 10px"}}
                />
              </Row>
              <Row>
                <button className="chip" onClick={()=>window.CanvasMindApp?.applySkybox(prompt)}>Generate Skybox</button>
                <button className="chip" onClick={()=>window.CanvasMindApp?.spawnMesh()}>Spawn Mesh</button>
                <input type="range" min={1} max={20} value={batch} onChange={e=>setBatch(parseInt(e.target.value))} />
                <button className="chip" onClick={()=>window.CanvasMindApp?.batchSpawn(batch)}>Spawn {batch}</button>
              </Row>
              <Row>
                <button className="chip" onClick={()=>window.CanvasMindApp?.clearScene()}>Clear Scene</button>
                <button className="chip" onClick={()=>window.CanvasMindApp?.screenshot()}>Screenshot</button>
              </Row>
              <Row>
                <label>Exposure</label>
                <input type="range" min={0.2} max={2.5} step={0.05} value={exposure}
                  onChange={e=>{ const v=parseFloat(e.target.value); setExposure(v); window.CanvasMindApp?.setBackgroundExposure(v); }} />
                <label>BG Blur</label>
                <input type="range" min={0} max={1} step={0.01} value={bgBlur}
                  onChange={e=>{ const v=parseFloat(e.target.value); setBgBlur(v); window.CanvasMindApp?.setBackgroundBlur(v); }} />
              </Row>
            </Panel>
          )}

          {tab==="Ground" && (
            <Panel title="Ground / Shadow Catcher Align">
              <Row>
                <label>Height</label>
                <input type="range" min={-1} max={1} step={0.001} value={ground.y}
                  onChange={e=>{ const y=parseFloat(e.target.value); setGround(g=>({...g,y})); window.CanvasMindApp?.setGround(y, ground.rx, ground.rz); }} />
              </Row>
              <Row>
                <label>Tilt X</label>
                <input type="range" min={-0.2} max={0.2} step={0.001} value={ground.rx}
                  onChange={e=>{ const rx=parseFloat(e.target.value); setGround(g=>({...g,rx})); window.CanvasMindApp?.setGround(ground.y, rx, ground.rz); }} />
              </Row>
              <Row>
                <label>Tilt Z</label>
                <input type="range" min={-0.2} max={0.2} step={0.001} value={ground.rz}
                  onChange={e=>{ const rz=parseFloat(e.target.value); setGround(g=>({...g,rz})); window.CanvasMindApp?.setGround(ground.y, ground.rx, rz); }} />
              </Row>
            </Panel>
          )}

          {tab==="Grass" && (
            <Panel title="Grass">
              <Row>
                <label>Quality</label>
                <select
                  value={grass.quality as any}
                  onChange={e=>{ const quality=e.target.value; setGrass(g=>({...g, quality} as any)); window.CanvasMindApp?.updateGrass({ quality }); }}
                  style={{background:"#091424", color:"#e6edf3", border:"1px solid #1e2a44", borderRadius:10, padding:"8px 10px"}}
                >
                  <option value="low">Low</option>
                  <option value="med">Medium</option>
                  <option value="high">High</option>
                </select>
                <button className="chip" onClick={()=>window.CanvasMindApp?.loadGrass(grass)}>Load Grass</button>
                <button className="chip" onClick={()=>window.CanvasMindApp?.unloadGrass()}>Unload Grass</button>
              </Row>
              <Row>
                <label>Patch Size</label>
                <input type="range" min={0.2} max={3} step={0.05} value={grass.patchSize}
                  onChange={e=>{ const patchSize=parseFloat(e.target.value); setGrass(g=>({...g,patchSize})); window.CanvasMindApp?.updateGrass({ patchSize }); }} />
              </Row>
              <Row>
                <label>Density</label>
                <input type="range" min={0.1} max={3} step={0.05} value={grass.density}
                  onChange={e=>{ const density=parseFloat(e.target.value); setGrass(g=>({...g,density})); window.CanvasMindApp?.updateGrass({ density }); }} />
              </Row>
              <Row>
                <label>Blade Height</label>
                <input type="range" min={0.2} max={3} step={0.05} value={grass.bladeHeight}
                  onChange={e=>{ const bladeHeight=parseFloat(e.target.value); setGrass(g=>({...g,bladeHeight})); window.CanvasMindApp?.updateGrass({ bladeHeight }); }} />
              </Row>
              <Row>
                <label>Wind Strength</label>
                <input type="range" min={0} max={2} step={0.05} value={grass.windStrength}
                  onChange={e=>{ const windStrength=parseFloat(e.target.value); setGrass(g=>({...g,windStrength})); window.CanvasMindApp?.updateGrass({ windStrength }); }} />
              </Row>
              <Row>
                <label>Wind Speed</label>
                <input type="range" min={0} max={3} step={0.05} value={grass.windSpeed}
                  onChange={e=>{ const windSpeed=parseFloat(e.target.value); setGrass(g=>({...g,windSpeed})); window.CanvasMindApp?.updateGrass({ windSpeed }); }} />
              </Row>
            </Panel>
          )}

          {tab==="Character" && (
            <Panel title="Rose (Character)">
              <Row>
                <input
                  value={roseUrl}
                  onChange={e=>setRoseUrl(e.target.value)}
                  placeholder="/assets/rose.glb"
                  style={{flex:1, background:"#091424", color:"#e6edf3", border:"1px solid #1e2a44", borderRadius:10, padding:"8px 10px"}}
                />
              </Row>
              <Row>
                <button className="chip" onClick={()=>window.CanvasMindApp?.loadRose(roseUrl)}>Load Rose</button>
                <button className="chip" onClick={()=>window.CanvasMindApp?.unloadRose()}>Unload</button>
              </Row>
              <Row>
                <button className="chip" onClick={()=>window.CanvasMindApp?.playRoseAction("walk")}>Walk</button>
                <button className="chip" onClick={()=>window.CanvasMindApp?.playRoseAction("run")}>Run</button>
                <button className="chip" onClick={()=>window.CanvasMindApp?.playRoseAction("jump")}>Jump</button>
              </Row>
            </Panel>
          )}

          {tab==="Props" && (
            <Panel title="Props">
              <Row>
                <button className="chip" onClick={()=>window.CanvasMindApp?.loadTestBall()}>Load TestBall</button>
                <button className="chip" onClick={()=>window.CanvasMindApp?.unloadTestBall()}>Unload TestBall</button>
              </Row>
              <Row>
                <input
                  value={remoteBallUrl}
                  onChange={e=>setRemoteBallUrl(e.target.value)}
                  placeholder="https://…/model.glb"
                  style={{flex:1, background:"#091424", color:"#e6edf3", border:"1px solid #1e2a44", borderRadius:10, padding:"8px 10px"}}
                />
                <button className="chip" onClick={()=>window.CanvasMindApp?.loadImportedBall(remoteBallUrl)}>Load Remote</button>
                <button className="chip" onClick={()=>window.CanvasMindApp?.unloadImportedBall()}>Unload Remote</button>
              </Row>
            </Panel>
          )}

          {tab==="Editor" && (
            <Panel title="Editor / Selection">
              <Row>
                <button className="chip" onClick={()=>window.CanvasMindApp?.setGizmoMode("translate")}>Translate (W)</button>
                <button className="chip" onClick={()=>window.CanvasMindApp?.setGizmoMode("rotate")}>Rotate (E)</button>
                <button className="chip" onClick={()=>window.CanvasMindApp?.setGizmoMode("scale")}>Scale (R)</button>
              </Row>
              <Row>
                <button className="chip" onClick={()=>window.CanvasMindApp?.clearSelection()}>Clear Selection</button>
                <button className="chip" onClick={()=>window.CanvasMindApp?.deleteSelection()}>Delete (X)</button>
                <button className="chip" onClick={()=>window.CanvasMindApp?.duplicateSelection()}>Duplicate (D)</button>
                <button className="chip" onClick={()=>window.CanvasMindApp?.flipSelectionXZ()}>Flip XZ (F)</button>
              </Row>
            </Panel>
          )}

          {tab==="Quality" && (
            <Panel title="Render Quality">
              <Row>
                <button className="chip" onClick={()=>window.CanvasMindApp?.setQuality("performance")}>Performance</button>
                <button className="chip" onClick={()=>window.CanvasMindApp?.setQuality("balanced")}>Balanced</button>
                <button className="chip" onClick={()=>window.CanvasMindApp?.setQuality("quality")}>Quality</button>
              </Row>
              <div style={{opacity:0.8, fontSize:12, marginTop:6}}>
                Tip: Quality also adapts dynamically to FPS; shadows + pixel ratio relax during gizmo drags.
              </div>
            </Panel>
          )}

          {tab==="Procedural" && (
            <Panel title="Terrain / Road (Procedural)">
              <Row>
                <button className="chip" onClick={()=>window.CanvasMindApp?.startProcedural()}>Start</button>
                <button className="chip" onClick={()=>window.CanvasMindApp?.stopProcedural()}>Stop</button>
                <button className="chip" onClick={()=>window.dispatchEvent(new CustomEvent("proc.regen"))}>Regenerate</button>
              </Row>
              <Row>
                <label>Road Width</label>
                <input type="range" min={3} max={20} step={0.5} value={proc.width}
                  onChange={e=>{ const v=parseFloat(e.target.value); setProc(p=>({...p,width:v})); emitProc({ roadWidth:v }); }} />
              </Row>
              <Row>
                <label>Curvature</label>
                <input type="range" min={0} max={2} step={0.05} value={proc.curvature}
                  onChange={e=>{ const v=parseFloat(e.target.value); setProc(p=>({...p,curvature:v})); emitProc({ curvature:v }); }} />
              </Row>
              <Row>
                <label>Bank (°)</label>
                <input type="range" min={0} max={35} step={0.5} value={proc.bank}
                  onChange={e=>{ const v=parseFloat(e.target.value); setProc(p=>({...p,bank:v})); emitProc({ bank:v }); }} />
              </Row>
              <Row>
                <label>Seg Len</label>
                <input type="range" min={20} max={160} step={1} value={proc.segLen}
                  onChange={e=>{ const v=parseFloat(e.target.value); setProc(p=>({...p,segLen:v})); emitProc({ segLen:v }); }} />
              </Row>
              <Row>
                <label>Height Amp</label>
                <input type="range" min={1} max={40} step={1} value={proc.heightAmp}
                  onChange={e=>{ const v=parseFloat(e.target.value); setProc(p=>({...p,heightAmp:v})); emitProc({ heightScale:v }); }} />
              </Row>
              <div style={{opacity:0.8, fontSize:12}}>Changes apply instantly; “Regenerate” randomizes the seed.</div>
            </Panel>
          )}

          {tab==="MCP" && (
            <Panel title="MCP Servers">
              <Row>
                <button className="chip" onClick={()=>window.CanvasMindApp?.refreshRegistry()}>Refresh</button>
                <select id="serverSelect"
                  style={{flex:1, minWidth:240, background:"#091424", color:"#e6edf3", border:"1px solid #1e2a44", borderRadius:10, padding:"8px 10px"}}
                >
                  <option value="">(no registry loaded yet)</option>
                </select>
              </Row>
              <div style={{opacity:0.8, fontSize:12}}>
                Pick a server; Skybox/Mesh actions prefer the selected server if it supports that tag.
              </div>
            </Panel>
          )}

          {/* HUD in sidebar */}
          <Panel title="Stats">
            <Row><div className="chip">FPS: {fps}</div><div className="chip">Draws: {draws}</div><div className="chip">Assets: {assets}</div></Row>
          </Panel>
        </div>
      </div>

      {/* RIGHT: Canvas */}
      <div style={{height:"100vh"}}>
        <CanvasPane />
      </div>
    </div>
  );
}

import React from "react";

type Props = {
  selected?: string;
  picks: number;
  fps: number;
  cam: { x: number; y: number; z: number };
  showHits: boolean;
  logs: string[];

  onToggleHits: () => void;
  onClearPicks: () => void;
  onSpawnGizmo: () => void;
  onClearGizmos: () => void;
};

export default function DevTools(p: Props) {
  const camStr = `${p.cam.x.toFixed(2)}, ${p.cam.y.toFixed(2)}, ${p.cam.z.toFixed(2)}`;

  return (
    <div style={{
      position:"fixed", right:12, top:90, zIndex:9999, width:320,
      background:"rgba(9,13,20,0.88)", border:"1px solid rgba(255,255,255,.12)",
      borderRadius:14, padding:12, color:"#eaf1ff", fontFamily:"ui-monospace,Consolas,monospace",
      boxShadow:"0 12px 40px rgba(0,0,0,.45)", fontSize:12
    }}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <b style={{letterSpacing:.5}}>DEV TOOLS</b>
        <div>FPS <b>{p.fps}</b></div>
      </div>

      <div style={{display:"grid",gap:4}}>
        <Row k="Selected" v={p.selected ?? "(none)"} />
        <Row k="Picks" v={p.picks} />
        <Row k="Camera" v={camStr} />
        <Row k="Hitboxes" v={p.showHits ? "visible" : "hidden"} />
      </div>

      <div style={{display:"grid", gap:8, marginTop:10, gridTemplateColumns:"1fr 1fr"}}>
        <Btn onClick={p.onToggleHits}>{p.showHits ? "Hide" : "Show"} Hitboxes</Btn>
        <Btn onClick={p.onClearPicks}>Clear Picks</Btn>
        <Btn onClick={p.onSpawnGizmo}>Spawn Gizmo</Btn>
        <Btn onClick={p.onClearGizmos}>Clear Gizmos</Btn>
      </div>

      <div style={{marginTop:10}}>
        <div style={{opacity:.8, marginBottom:4}}>Log</div>
        <div style={{maxHeight:120, overflow:"auto", paddingRight:4}}>
          {p.logs.slice(-10).reverse().map((l, i) => (
            <div key={i} style={{whiteSpace:"nowrap", textOverflow:"ellipsis", overflow:"hidden"}}>{l}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Row({k, v}:{k:string; v:string|number}) {
  return (
    <div style={{display:"flex",justifyContent:"space-between"}}>
      <span style={{opacity:.7}}>{k}</span><span>{v}</span>
    </div>
  );
}
function Btn(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...props} style={{
      padding:"8px 10px", borderRadius:10, cursor:"pointer",
      border:"1px solid rgba(255,255,255,.12)",
      background:"#21314e", color:"#eaf1ff"
    }}/>
  );
}

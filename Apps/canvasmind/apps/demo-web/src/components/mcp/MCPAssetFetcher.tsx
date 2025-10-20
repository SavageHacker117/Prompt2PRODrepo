import React, { useState } from "react";

export default function MCPAssetFetcher() {
  const [q, setQ] = useState("lush green grass");
  const [status, setStatus] = useState<string>("");

  async function tryInject(kind: "texture"|"hdri"|"glb") {
    setStatus("Fetching…");
    try {
      if (kind === "texture") {
        const texUrl = "https://threejs.org/examples/textures/uv_grid_opengl.jpg";

        // Ensure the ball exists, then apply the map
        (window as any).CanvasMindApp?.loadTestBall?.();
        await (window as any).__CM_INJECT?.applyTextureToTestBall?.({
          pbr_albedo: texUrl
        });
        setStatus("Applied texture to TestBall.");
      } else if (kind === "hdri") {
        const hdr = "https://threejs.org/examples/textures/2294472375_24a3b8ef46_o.jpg";
        await (window as any).__CM_INJECT?.loadHDRIEnvironment?.(hdr);
        setStatus("Environment updated.");
      } else {
        const glb = "https://threejs.org/examples/models/gltf/DamagedHelmet/glTF/DamagedHelmet.gltf";
        await (window as any).__CM_INJECT?.loadGLBModel?.(glb);
        setStatus("Model loaded.");
      }
    } catch (e:any) {
      setStatus(`Error: ${e.message || e}`);
    }
  }

  return (
    <div style={{display:"grid", gap:8}}>
      <h3 className="text-sm font-semibold">Poly Haven • Fetch</h3>
      <input
        value={q}
        onChange={(e)=>setQ(e.target.value)}
        placeholder="describe asset (e.g. 'mossy rock tile')"
        style={{padding:8,borderRadius:8,border:"1px solid #1e2a44",background:"#0b1222",color:"#e6edf3"}}
      />
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <button onClick={()=>tryInject("texture")}>Fetch Texture</button>
        <button onClick={()=>tryInject("hdri")}>Fetch HDRI</button>
        <button onClick={()=>tryInject("glb")}>Fetch GLB</button>
        <button onClick={()=> (window as any).__CM_INJECT?.unloadGLBModel?.() }>Unload GLB</button>
      </div>
      <div style={{fontSize:12,opacity:.8}}>{status}</div>
      <p style={{fontSize:11,opacity:.6}}>
        Backend crawler can map prompt→PolyHaven asset; these buttons call injectors that
        apply results to the live Three.js scene (env, test ball, or GLB).
      </p>
    </div>
  );
}

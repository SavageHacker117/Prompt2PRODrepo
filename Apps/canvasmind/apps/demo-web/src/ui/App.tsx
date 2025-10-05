import React from "react";
import CanvasPane from "../react/CanvasPane";
import Prompt2ProdPanel from "./Prompt2ProdPanel";
import MCPAssetFetcher from "../components/mcp/MCPAssetFetcher";
import ChatQwen from "../components/mcp/ChatQwen";

function TabHeader({
  value, current, set
}: {value:string; current:string; set:(v:string)=>void}) {
  const active = value===current;
  return (
    <button
      onClick={()=>set(value)}
      style={{
        padding:"6px 10px",
        borderRadius:8,
        border:"1px solid #1e2a44",
        background: active ? "#162036" : "#0b1222",
        color:"#e6edf3",
        fontSize:12,
        marginRight:6
      }}
    >
      {value}
    </button>
  );
}

export default function App() {
  const [tab, setTab] = React.useState<"Prompt2PROD"|"MCP • Fetch & Chat">("Prompt2PROD");

  return (
    <div className="w-screen h-screen grid" style={{gridTemplateColumns:"360px minmax(0,1fr)"}}>
      {/* Left column: Controls */}
      <div className="h-full overflow-auto" style={{background:"#0b1222", borderRight:"1px solid #1e2a44"}}>
        <div className="sticky top-0 z-10" style={{padding:8, background:"#0b1222", borderBottom:"1px solid #1e2a44"}}>
          <TabHeader value="Prompt2PROD" current={tab} set={v=>setTab(v as any)} />
          <TabHeader value="MCP • Fetch & Chat" current={tab} set={v=>setTab(v as any)} />
        </div>

        <div style={{padding:8}}>
          {tab === "Prompt2PROD" && <Prompt2ProdPanel />}
          {tab === "MCP • Fetch & Chat" && (
            <div style={{display:"grid", gap:12}}>
              <MCPAssetFetcher />
              <div style={{height:8}} />
              <ChatQwen />
            </div>
          )}
        </div>
      </div>

      {/* Right column: Canvas */}
      <div className="h-full">
        <CanvasPane />
      </div>
    </div>
  );
}

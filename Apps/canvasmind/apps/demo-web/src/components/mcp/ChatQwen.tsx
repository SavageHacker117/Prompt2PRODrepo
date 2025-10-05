import React, { useState } from "react";

export default function ChatQwen() {
  const [msg, setMsg] = useState("");
  const [log, setLog] = useState<{who:"you"|"qwen"; text:string}[]>([]);

  async function send() {
    if (!msg.trim()) return;
    const text = msg.trim();
    setMsg("");
    setLog((L)=>[...L, {who:"you", text}]);

    try {
      const res = await fetch("/api/chat/qwen", {
        method: "POST",
        headers: { "content-type":"application/json" },
        body: JSON.stringify({ prompt: text })
      });
      if (res.ok) {
        const data = await res.json();
        setLog((L)=>[...L, {who:"qwen", text: String(data.reply ?? "(ok)")}]);
      } else {
        setLog((L)=>[...L, {who:"qwen", text: "(local echo) " + text}]);
      }
    } catch {
      setLog((L)=>[...L, {who:"qwen", text: "(offline) " + text}]);
    }
  }

  return (
    <div style={{display:"grid", gap:8}}>
      <h3 className="text-sm font-semibold">Qwen • Assistant</h3>
      <div style={{display:"grid", gap:6, gridTemplateRows:"auto 120px"}}>
        <div style={{maxHeight:160, overflow:"auto", background:"#0b1222", border:"1px solid #1e2a44", borderRadius:8, padding:8}}>
          {log.map((l,i)=>(
            <div key={i} style={{opacity:.9, fontSize:12, marginBottom:6}}>
              <b>{l.who}:</b> {l.text}
            </div>
          ))}
        </div>
        <div style={{display:"flex", gap:8}}>
          <input
            value={msg}
            onChange={(e)=>setMsg(e.target.value)}
            onKeyDown={(e)=>{ if(e.key==="Enter") send(); }}
            placeholder="Ask Qwen to fetch a grass texture…"
            style={{flex:1,padding:8,borderRadius:8,border:"1px solid #1e2a44",background:"#0b1222",color:"#e6edf3"}}
          />
          <button onClick={send}>Send</button>
        </div>
      </div>
    </div>
  );
}

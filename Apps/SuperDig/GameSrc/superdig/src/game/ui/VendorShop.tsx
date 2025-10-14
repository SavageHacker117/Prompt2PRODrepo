import React from "react";
import { createPortal } from "react-dom";
import type { VendorInfo } from "../gameplay/vendors";

type Props = {
  vendor: VendorInfo;
  credits: number;
  onBuy: (item: { id: string; label: string; price: number }) => void;
  onClose: () => void;
};

function Shop({ vendor, credits, onBuy, onClose }: Props) {
  return (
    <div style={{
      position:"fixed", inset:0, background:"rgba(5,10,20,0.75)", zIndex:10000,
      display:"grid", placeItems:"center", color:"#fff", fontFamily:"Inter,system-ui,sans-serif"
    }}>
      <div style={{
        width:520, background:"linear-gradient(180deg,#101827,#0b1322)",
        border:"1px solid rgba(255,255,255,.12)", borderRadius:16, boxShadow:"0 24px 64px rgba(0,0,0,.6)",
        padding:18
      }}>
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8}}>
          <h3 style={{margin:0, fontFamily:"Orbitron,system-ui"}}>{vendor.name}</h3>
          <div style={{opacity:.8}}>Credits: <b>{credits}</b></div>
        </div>
        <div style={{display:"grid", gap:10}}>
          {vendor.items.map(item => (
            <div key={item.id} style={{
              display:"flex", justifyContent:"space-between", alignItems:"center",
              padding:"10px 12px", borderRadius:12, background:"rgba(255,255,255,.06)",
              border:"1px solid rgba(255,255,255,.1)"
            }}>
              <div>
                <div style={{fontWeight:700}}>{item.label}</div>
                {item.desc && <div style={{fontSize:12, opacity:.8}}>{item.desc}</div>}
              </div>
              <button
                disabled={credits < item.price}
                onClick={() => onBuy(item)}
                style={{
                  padding:"8px 12px", borderRadius:10, cursor:"pointer",
                  background: credits < item.price ? "#2b3347" : "linear-gradient(90deg,#ffd84d,#ff9b3d)",
                  color: credits < item.price ? "#9aa6c8" : "#190e00",
                  border:"1px solid rgba(255,255,255,.15)", fontWeight:800
                }}
              >
                {item.price} cr
              </button>
            </div>
          ))}
        </div>
        <div style={{display:"flex", justifyContent:"flex-end", marginTop:12}}>
          <button onClick={onClose} style={{padding:"8px 12px", borderRadius:10, background:"#1b2a49", color:"#eef3ff", border:"1px solid rgba(255,255,255,.15)", cursor:"pointer"}}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default function VendorShop(props: Props) {
  return createPortal(<Shop {...props} />, document.body);
}

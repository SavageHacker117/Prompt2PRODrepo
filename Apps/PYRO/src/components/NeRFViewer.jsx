import React, { useEffect, useRef } from "react";

export default function NeRFViewer({ scene, enabled, quality }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!enabled || !scene || !ref.current) return;
    const el = ref.current; el.textContent = `NeRF ${quality || "medium"}`; el.style.opacity = "1";
    return () => { el.textContent = ""; el.style.opacity = "0"; };
  }, [scene, enabled, quality]);
  return (
    <div ref={ref} style={{
      position:"absolute", right:12, bottom:12, zIndex:9,
      minWidth:120, minHeight:28, padding:"6px 10px",
      background:"rgba(0,0,0,.45)", color:"#cfd8e3",
      border:"1px solid rgba(255,255,255,.08)", borderRadius:8,
      transition:"opacity .2s", pointerEvents:"none"
    }}/>
  );
}

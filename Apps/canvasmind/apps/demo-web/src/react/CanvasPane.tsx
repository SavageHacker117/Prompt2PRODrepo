import React, { useEffect, useRef } from "react";
import type { CanvasMindAPI } from "../boot";
import { bootOnCanvas } from "../boot";

declare global {
  interface Window { CanvasMindApp?: CanvasMindAPI }
}

export default function CanvasPane() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let api: CanvasMindAPI | undefined;
    (async () => {
      if (hostRef.current) api = await bootOnCanvas(hostRef.current);
    })();

    return () => {
      try { api?.dispose(); } catch {}
    };
  }, []);

  return (
    <div
      ref={hostRef}
      style={{ width: "100%", height: "100%", background: "#071118" }}
    />
  );
}

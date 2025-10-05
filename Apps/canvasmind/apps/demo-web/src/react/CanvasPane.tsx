import React, { useEffect, useRef } from "react";
import { bootOnCanvas } from "../boot";

export default function CanvasPane() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    let api: any;
    (async () => { api = await bootOnCanvas(ref.current); })();
    return () => api?.dispose?.();
  }, []);

  return <div ref={ref} className="w-full h-full" />;
}

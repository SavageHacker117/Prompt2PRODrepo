import React, { useEffect, useMemo, useRef, useState } from "react";
import type { CanvasMindAPI } from "../boot";
import { bootOnCanvas } from "../boot";

export type FillMode = "none" | "keep-aspect" | "fill-window";
export type ResolutionMode = "auto" | "fixed";

type Props = {
  className?: string;
  style?: React.CSSProperties;
  fillMode?: FillMode;           // reserved for future expansion
  resolutionMode?: ResolutionMode; // reserved
  children?: React.ReactNode;    // optional React UI overlay
};

export const ThreeApplication: React.FC<Props> = ({
  className = "cm-app",
  style = { width: "100%", height: "100%" },
  fillMode = "keep-aspect",
  resolutionMode = "auto",
  children
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  const cfgKey = useMemo(() => `${fillMode}|${resolutionMode}`, [fillMode, resolutionMode]);

  useEffect(() => {
    let canceled = false;
    let api: CanvasMindAPI | null = null;

    (async () => {
      const mount = mountRef.current;
      if (!mount) return;
      api = await bootOnCanvas(mount);
      if (canceled) { api.dispose(); return; }
      setReady(true);
    })();

    return () => {
      canceled = true;
      setReady(false);
      api?.dispose();
    };
  }, [cfgKey]);

  return (
    <>
      <div ref={mountRef} className={className} style={style} />
      {ready ? children : null}
    </>
  );
};

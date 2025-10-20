import React, { useEffect, useRef, useState } from "react";

type BusEvent =
  | { type: "proc.regen"; payload?: any }
  | { type: "proc.set"; payload: Partial<ProcState> };

type ProcState = {
  roadWidth: number;
  bank: number;
  curvature: number;
  segLen: number;
  heightScale: number;
};

function emit(ev: BusEvent) {
  window.dispatchEvent(new CustomEvent(ev.type, { detail: ev.payload }));
}

export default function ProceduralPanel() {
  const [s, setS] = useState<ProcState>({
    roadWidth: 7,
    bank: 5,
    curvature: 0.7,
    segLen: 80,
    heightScale: 18,
  });

  useEffect(() => { emit({ type: "proc.set", payload: s }); }, []);

  return (
    <div style={{ padding: 10 }}>
      <h3 style={{ fontWeight: 700 }}>Procedural Controls</h3>

      <label>Road Width: {s.roadWidth.toFixed(1)} m</label>
      <input type="range" min={4} max={12} step={0.1}
        value={s.roadWidth}
        onChange={e => { const v = parseFloat(e.target.value); setS({ ...s, roadWidth: v }); emit({ type:"proc.set", payload:{ roadWidth: v }}); }}
      />

      <label>Bank Angle: {s.bank.toFixed(1)}°</label>
      <input type="range" min={-15} max={15} step={0.5}
        value={s.bank}
        onChange={e => { const v = parseFloat(e.target.value); setS({ ...s, bank: v }); emit({ type:"proc.set", payload:{ bank: v }}); }}
      />

      <label>Curvature: {s.curvature.toFixed(2)}</label>
      <input type="range" min={0.2} max={1.2} step={0.05}
        value={s.curvature}
        onChange={e => { const v = parseFloat(e.target.value); setS({ ...s, curvature: v }); emit({ type:"proc.set", payload:{ curvature: v }}); }}
      />

      <label>Segment Length: {s.segLen} m</label>
      <input type="range" min={40} max={140} step={5}
        value={s.segLen}
        onChange={e => { const v = parseFloat(e.target.value); setS({ ...s, segLen: v }); emit({ type:"proc.set", payload:{ segLen: v }}); }}
      />

      <label>Height Amplitude: {s.heightScale} m</label>
      <input type="range" min={8} max={40} step={1}
        value={s.heightScale}
        onChange={e => { const v = parseFloat(e.target.value); setS({ ...s, heightScale: v }); emit({ type:"proc.set", payload:{ heightScale: v }}); }}
      />

      <div style={{ height: 8 }} />
      <button onClick={() => emit({ type: "proc.regen" })}>Regenerate</button>
    </div>
  );
}

/*
Integration tip (do once):
- In your scene bootstrap, listen for window events to reconfigure systems:

window.addEventListener("proc.set", (e: any) => {
  const p = e.detail || {};
  road.opts.width = p.roadWidth ?? road.opts.width;
  road.opts.bankAngleDeg = p.bank ?? road.opts.bankAngleDeg;
  road.opts.curvature = p.curvature ?? road.opts.curvature;
  road.opts.segmentLen = p.segLen ?? road.opts.segmentLen;
  terrain.setHeightParams({ amplitude: p.heightScale });
  road.build();
});

window.addEventListener("proc.regen", () => {
  road.path = SplinePath.generate(/* seed * / Date.now() & 0xffff, road.opts.segmentCount, road.opts.segmentLen, road.opts.curvature);
  road.build();
});
*/

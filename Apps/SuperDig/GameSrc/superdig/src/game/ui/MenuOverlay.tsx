import React from "react";
import { createPortal } from "react-dom";

type Props = {
  current: "superdigger_rig.glb" | "mech.glb";
  onSwap: (next: "superdigger_rig.glb" | "mech.glb") => void;
  onBackdrop: (name: "HomeBase" | "BioDome" | "OilRefine") => void;
  onClose: () => void;
};

function MenuOverlayContent({ current, onSwap, onBackdrop, onClose }: Props) {
  const other = current === "superdigger_rig.glb" ? "mech.glb" : "superdigger_rig.glb";
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(5,10,20,0.75)",
        display: "grid",
        placeItems: "center",
        zIndex: 10000,
        color: "#fff",
        fontFamily: "Inter,system-ui,sans-serif",
      }}
    >
      <div
        style={{
          width: 560,
          borderRadius: 16,
          padding: 20,
          background: "linear-gradient(180deg,#0c1220,#0a0f1c)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 20px 60px rgba(0,0,0,.55)",
        }}
      >
        <h2 style={{ margin: "0 0 12px 0", fontFamily: "Orbitron,system-ui", letterSpacing: 1 }}>
          SuperDig — Menu
        </h2>

        <div style={{ display: "grid", gap: 10 }}>
          <button onClick={() => onSwap(other)} style={btn}>
            Switch Miner → {other.replace(".glb", "")}
          </button>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => onBackdrop("HomeBase")} style={btn}>
              Backdrop: HomeBase
            </button>
            <button onClick={() => onBackdrop("BioDome")} style={btn}>
              Backdrop: BioDome
            </button>
            <button onClick={() => onBackdrop("OilRefine")} style={btn}>
              Backdrop: OilRefine
            </button>
          </div>

          <button onClick={onClose} style={{ ...btn, background: "#1b2a49" }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

const btn: React.CSSProperties = {
  padding: "10px 14px",
  background: "#243452",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 12,
  color: "#eef3ff",
  cursor: "pointer",
  fontWeight: 600,
};

export default function MenuOverlay(props: Props) {
  return createPortal(<MenuOverlayContent {...props} />, document.body);
}

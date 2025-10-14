import React from "react";

export default function FabMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Menu (M)"
      style={{
        position: "fixed",
        right: 16,
        top: 80,
        zIndex: 1000,
        width: 44,
        height: 44,
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.15)",
        background: "linear-gradient(180deg,#223452,#101826)",
        color: "#eef3ff",
        cursor: "pointer",
        boxShadow: "0 8px 28px rgba(0,0,0,.45)",
        display: "grid",
        placeItems: "center",
        fontSize: 18,
      }}
    >
      ⚙️
    </button>
  );
}

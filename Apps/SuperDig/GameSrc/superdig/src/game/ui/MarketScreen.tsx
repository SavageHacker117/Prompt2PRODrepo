export default function MarketScreen({ onClose }: { onClose: () => void }) {
  return (
    <div style={{
      position: "absolute", inset: 0, display: "grid", placeItems: "center",
      background: "linear-gradient(180deg, rgba(0,0,0,.62), rgba(0,0,0,.82))"
    }}>
      <div style={{ width: 520, padding: 20, borderRadius: 16, background: "#0b121a", color: "#f6c56f", border: "1px solid #2c3a48" }}>
        <div style={{ fontSize: 22, marginBottom: 8 }}>🪙 Market</div>
        <div style={{ color: "#a6b6c8", fontSize: 14, marginBottom: 12 }}>Sell mined ore here (v1: auto-sell soon™).</div>
        <button onClick={onClose} style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid #2c3a48", background: "#14202b", color: "#dbe9ff", cursor: "pointer" }}>Close</button>
      </div>
    </div>
  );
}

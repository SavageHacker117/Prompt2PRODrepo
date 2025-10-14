export default function HUD(props: { health: number; fuel: number; depth: number; credits: number; hint?: string }) {
  return (
    <div style={{
      position: "absolute", top: 16, left: 16, padding: 14, borderRadius: 12,
      background: "linear-gradient(180deg, rgba(10,20,28,.85), rgba(10,20,28,.65))",
      color: "#cfe9ff", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace",
      fontSize: 16, boxShadow: "0 8px 32px rgba(0,0,0,.35)", pointerEvents: "none"
    }}>
      <div>Health: <b style={{ color: "#7bf79f" }}>{props.health}</b></div>
      <div>Fuel: <b style={{ color: "#ffd66b" }}>{props.fuel}</b></div>
      <div>Depth: <b style={{ color: "#8dbbff" }}>{props.depth}m</b></div>
      <div>Credits: <b style={{ color: "white" }}>{props.credits} CR</b></div>
      {props.hint && <div style={{ marginTop: 6, color: "#d7ff9c" }}>{props.hint}</div>}
      <div style={{ marginTop: 8, opacity: .6, fontSize: 12 }}>
        WASD: Move &nbsp;|&nbsp; Space: Drill Down &nbsp;|&nbsp; Mouse: Mine Block &nbsp;|&nbsp; X: Use Station
      </div>
    </div>
  );
}

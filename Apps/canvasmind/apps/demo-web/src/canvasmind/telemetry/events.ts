export type TelemetryEvent =
  | { type: "skybox_applied"; model: string; seed: number; texMB: number }
  | { type: "mesh_spawned"; model: string; seed: number; tris: number }
  | { type: "budget_violation"; kind: string; value: number; cap: number }
  | { type: "fps_tick"; fps: number; draws: number; assets: number };

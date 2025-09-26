import type { TelemetryEvent } from "./events";

export function sendTelemetry(ev: TelemetryEvent) {
  try {
    navigator.sendBeacon?.("/telemetry", JSON.stringify(ev));
  } catch (e) {
    console.warn("Telemetry send failed", e);
  }
}

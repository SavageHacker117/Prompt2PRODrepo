// apps/demo-web/src/canvasmind/telemetry/client.ts

// ---- Types ----
export type TelemetryEvent = {
  prompt: string;
  candidate: Record<string, unknown>;
  chosen?: boolean;
  dwell_time?: number;
};

// ---- Utils ----
async function postJSON(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    keepalive: true, // allows send during unload in many browsers
  });
  if (!res.ok) throw new Error(await res.text());
  return res;
}

/**
 * Send a telemetry event.
 * - Uses `sendBeacon` when target is same-origin; otherwise falls back to fetch.
 * - `base` defaults to localhost:8088 (your dev collector).
 */
export async function sendTelemetry(
  base = "http://localhost:8088",
  evt: TelemetryEvent
) {
  try {
    const path = "/telemetry";
    const absolute = base.endsWith("/") ? `${base.slice(0, -1)}${path}` : `${base}${path}`;

    // Same-origin beacon optimization
    const sameOrigin =
      typeof window !== "undefined" &&
      (absolute.startsWith(window.location.origin) || absolute.startsWith("/"));

    const payload = JSON.stringify({
      prompt: evt.prompt,
      candidate: evt.candidate,
      chosen: evt.chosen ?? true,
      dwell_time: evt.dwell_time ?? 0,
    });

    if (sameOrigin && typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      // Non-blocking attempt; not awaited.
      const ok = navigator.sendBeacon(absolute, new Blob([payload], { type: "application/json" }));
      if (ok) return;
      // fall through to fetch if beacon refused
    }

    await postJSON(absolute, {
      prompt: evt.prompt,
      candidate: evt.candidate,
      chosen: evt.chosen ?? true,
      dwell_time: evt.dwell_time ?? 0,
    });
  } catch (e) {
    console.warn("[telemetry] send failed:", e);
  }
}

/**
 * Score UI candidates via policy server.
 * - `features`: shape [N][inDim]
 * - returns `scores: number[]` (falls back to random if server unavailable)
 */
export async function scoreCandidates(
  base = "http://localhost:8088",
  features: number[][],
  inDim = 16
): Promise<number[]> {
  try {
    const url = base.endsWith("/")
      ? `${base}score`
      : `${base}/score`;

    const res = await postJSON(url, {
      features,
      in_dim: inDim,
      model_path: "policy.pt",
    });

    const json = await res.json();
    return (json?.scores as number[]) ?? features.map(() => Math.random());
  } catch (e) {
    console.warn("[policy] scoring failed, falling back to random:", e);
    return features.map(() => Math.random());
  }
}

// apps/demo-web/src/canvasmind/plugins/animator/animationCompleter.ts
import { sendTelemetry } from "../../telemetry/client";

export type AnimTarget = "skybox" | "mesh";

export type AnimationFrame = {
  frame: number;          // 1..N
  prompt: string;         // human/computable "crumb"
  type: AnimTarget;       // skybox or mesh
  assetId: string;        // source asset this frame belongs to
  track?: string;         // optional: object/bone name (e.g., "Armature/Spine/Neck" or mesh node)
  t?: number;             // normalized time hint 0..1 (useful when compiling to runtime)
};

export type AnimationResult = {
  animId: string;         // stable ID for this generated sequence
  assetId: string;
  type: AnimTarget;
  frames: AnimationFrame[];
  version: string;
  meta: {
    count: number;
    seed: number;
    createdAt: number;
    tracks?: string[];    // optional: tracks (bone/object names) used
  };
};

const TELEMETRY_URL = "http://localhost:8081"; // change here if your collector moves

function hashSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 1_000_000_007;
}

function pad3(n: number) {
  return String(n).padStart(3, "0");
}

export class AnimationCompleter {
  private static version = "v1.0";

  /**
   * Build N crumb prompts. Default is 200. Deterministic when given the same assetId+type.
   * You can pass `tracks` (object/bone names) to generate per-track prompts too.
   */
  static generatePrompts(
    assetId: string,
    type: AnimTarget,
    opts?: { count?: number; tracks?: string[]; seed?: number; label?: string }
  ): AnimationResult {
    const count = Math.max(1, Math.floor(opts?.count ?? 200));
    const tracks = opts?.tracks ?? []; // leave empty for single-track
    const seed = opts?.seed ?? hashSeed(`${assetId}:${type}:${count}:${(opts?.label ?? "wave")}`);
    const label = opts?.label ?? "wave";

    const animId = `${type}_${label}_${assetId}_${seed}`;
    const frames: AnimationFrame[] = [];

    // base: simple wave descriptor with phase info
    for (let i = 1; i <= count; i++) {
      const t = (i - 1) / (count - 1 || 1);
      // main track (whole skybox/mesh)
      frames.push({
        frame: i,
        t,
        prompt: `${type} ${label} crumb ${pad3(i)} of ${count} for ${assetId} • phase=${i}/${count} • seed=${seed}`,
        type,
        assetId
      });

      // optional extra per-track crumbs (objects/bones)
      for (const track of tracks) {
        frames.push({
          frame: i,
          t,
          prompt: `${type} ${label} track:${track} crumb ${pad3(i)} of ${count} for ${assetId} • phase=${i}/${count} • seed=${seed}`,
          type,
          assetId,
          track
        });
      }
    }

    return {
      animId,
      assetId,
      type,
      frames,
      version: AnimationCompleter.version,
      meta: {
        count,
        seed,
        createdAt: Date.now(),
        tracks: tracks.length ? tracks.slice() : undefined
      }
    };
  }

  /** Keep your existing one-liner, but include animId + counts in the event. */
  static async logAnimation(result: AnimationResult) {
    try {
      await sendTelemetry(TELEMETRY_URL, {
        prompt: `Animation started: ${result.animId}`,
        candidate: {
          type: result.type,
          frames: result.frames.length,
          version: result.version,
          assetId: result.assetId,
          animId: result.animId,
          meta: result.meta
        },
        chosen: true,
        dwell_time: 0
      });
    } catch (e) {
      console.warn("[telemetry] failed:", e);
    }
  }
}

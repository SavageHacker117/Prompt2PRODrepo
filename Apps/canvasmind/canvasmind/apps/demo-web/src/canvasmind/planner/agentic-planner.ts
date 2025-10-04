import type { CanvasMindContext } from "../init";

export type MCPItem = {
  id: string;
  name: string;
  server_url: string;
  tags: string[];
  capabilities: string[];
};

export class AgenticPlanner {
  async chooseServer(ctx: CanvasMindContext, tag: string, registry: MCPItem[]): Promise<MCPItem | null> {
    const candidates = registry.filter((s) => s.tags.includes(tag));
    if (!candidates.length) return null;
    // Naive scoring: pick first, but log telemetry
    return candidates[0];
  }

  async guardedCall<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
    let lastErr: any;
    for (let i = 0; i <= retries; i++) {
      try {
        return await fn();
      } catch (e) {
        lastErr = e;
        await new Promise((res) => setTimeout(res, 200 * (i + 1)));
      }
    }
    throw lastErr;
  }
}

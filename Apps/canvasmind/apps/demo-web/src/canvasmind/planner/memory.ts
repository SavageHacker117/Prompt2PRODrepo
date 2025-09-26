// Lightweight in-memory stats for ranking MCP servers.

export type Stat = {
  n: number;
  success: number;
  fail: number;
  latencyAvg: number;
  texMemAvg?: number;
  trisAvg?: number;
  lastErrAt?: number;
};

const STATS = new Map<string, Stat>(); // key: serverId:endpoint

export function recordSample(
  key: string,
  sample: { ok: boolean; latency: number; texMemMB?: number; tris?: number }
) {
  const s = STATS.get(key) ?? { n: 0, success: 0, fail: 0, latencyAvg: 0 };
  s.n += 1;
  if (sample.ok) s.success++; else { s.fail++; s.lastErrAt = Date.now(); }
  s.latencyAvg = s.latencyAvg ? s.latencyAvg * 0.8 + sample.latency * 0.2 : sample.latency;
  if (sample.texMemMB !== undefined) s.texMemAvg = s.texMemAvg ? s.texMemAvg * 0.8 + sample.texMemMB * 0.2 : sample.texMemMB;
  if (sample.tris !== undefined) s.trisAvg = s.trisAvg ? s.trisAvg * 0.8 + sample.tris * 0.2 : sample.tris;
  STATS.set(key, s);
}

export function score(key: string, budgets?: { texMemSoftCapMB?: number; trisSoftCap?: number }): number {
  const s = STATS.get(key);
  if (!s) return 1;
  let sc = 1;
  const succRate = s.success / Math.max(1, s.success + s.fail);
  sc += succRate * 2;
  const lat = s.latencyAvg || 1000;
  sc += Math.max(0, 1 - Math.min(lat / 1500, 1));
  if (budgets?.texMemSoftCapMB && s.texMemAvg) sc -= Math.max(0, s.texMemAvg / budgets.texMemSoftCapMB - 0.5);
  if (budgets?.trisSoftCap && s.trisAvg) sc -= Math.max(0, s.trisAvg / budgets.trisSoftCap - 0.5);
  return sc;
}

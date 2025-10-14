export type Upgrade = { id: string; costCR: number; effects: Record<string, number> };
export type Applied = Record<string, number>;

export function applyUpgrade(state: Applied, up: Upgrade): Applied {
  const next = { ...state };
  for (const k of Object.keys(up.effects)) next[k] = (next[k] || 0) + up.effects[k];
  return next;
}

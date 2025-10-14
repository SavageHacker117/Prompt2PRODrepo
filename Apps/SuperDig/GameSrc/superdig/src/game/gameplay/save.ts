const KEY = "superdig.save.v1";

export type SaveState = {
  credits: number;
  upgrades: Record<string, number>;
};

export function save(state: SaveState) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
}

export function load(): SaveState | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) as SaveState : null;
  } catch {
    return null;
  }
}

// Simple Poisson disk sampler in a rect region
export type Pt = { x: number; y: number };

export function poissonDisk(
  width: number,
  height: number,
  radius: number,
  maxTries = 30
) {
  const cell = radius / Math.SQRT2;
  const gridW = Math.ceil(width / cell);
  const gridH = Math.ceil(height / cell);
  const grid: (Pt | null)[] = Array(gridW * gridH).fill(null);
  const active: Pt[] = [];
  const samples: Pt[] = [];

  function gridIdx(x: number, y: number) {
    return Math.floor(x / cell) + Math.floor(y / cell) * gridW;
  }

  function inNeighbors(p: Pt) {
    const gi = Math.floor(p.x / cell);
    const gj = Math.floor(p.y / cell);
    for (let j = -2; j <= 2; j++) {
      for (let i = -2; i <= 2; i++) {
        const x = gi + i, y = gj + j;
        if (x < 0 || y < 0 || x >= gridW || y >= gridH) continue;
        const n = grid[x + y * gridW];
        if (!n) continue;
        const dx = n.x - p.x, dy = n.y - p.y;
        if (dx * dx + dy * dy < radius * radius) return true;
      }
    }
    return false;
  }

  function add(p: Pt) {
    samples.push(p);
    active.push(p);
    grid[gridIdx(p.x, p.y)] = p;
  }

  add({ x: width / 2, y: height / 2 });

  while (active.length) {
    const a = active[(Math.random() * active.length) | 0];
    let placed = false;
    for (let k = 0; k < maxTries; k++) {
      const ang = Math.random() * Math.PI * 2;
      const rad = radius * (1 + Math.random());
      const p = { x: a.x + Math.cos(ang) * rad, y: a.y + Math.sin(ang) * rad };
      if (p.x <= 0 || p.y <= 0 || p.x >= width || p.y >= height) continue;
      if (!inNeighbors(p)) {
        add(p); placed = true; break;
      }
    }
    if (!placed) active.splice(active.indexOf(a), 1);
  }

  return samples;
}

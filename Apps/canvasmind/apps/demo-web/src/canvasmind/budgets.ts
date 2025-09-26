export type BudgetCaps = {
  texMemMB: number;
  tris: number;
  nodes: number;
};

export type Trackable = {
  id: string;
  kind: "texture" | "mesh" | "env";
  estMB: number;
  estTris?: number;
  node?: any;
  dispose: () => void;
};

export class BudgetManager {
  caps: BudgetCaps;
  totalMB = 0;
  totalTris = 0;
  nodes = 0;
  private lru: Trackable[] = [];

  constructor(caps: Partial<BudgetCaps> = {}) {
    this.caps = { texMemMB: 512, tris: 1_500_000, nodes: 120, ...caps };
  }

  track(t: Trackable) {
    this.lru.push(t);
    this.totalMB += t.estMB;
    if (t.estTris) this.totalTris += t.estTris;
    if (t.kind === "mesh") this.nodes += 1;
    this.trimIfNeeded();
  }

  untrackByNode(node: any) {
    const idx = this.lru.findIndex(v => v.node === node);
    if (idx >= 0) this.removeAt(idx);
  }

  clearAll() {
    while (this.lru.length) this.removeAt(0);
  }

  private removeAt(i: number) {
    const v = this.lru.splice(i, 1)[0];
    this.totalMB -= v.estMB;
    if (v.estTris) this.totalTris -= v.estTris;
    if (v.kind === "mesh") this.nodes -= 1;
    try { v.dispose(); } catch {}
  }

  private trimIfNeeded() {
    while (
      this.totalMB > this.caps.texMemMB ||
      this.totalTris > this.caps.tris ||
      this.nodes > this.caps.nodes
    ) {
      if (!this.lru.length) break;
      this.removeAt(0);
    }
  }

  stats() {
    return { mb: this.totalMB, tris: this.totalTris, nodes: this.nodes, caps: { ...this.caps } };
  }
}

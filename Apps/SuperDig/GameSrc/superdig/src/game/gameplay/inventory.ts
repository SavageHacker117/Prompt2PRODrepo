// src/game/gameplay/inventory.ts
export type ItemStack = { id: string; qty: number };

export type Inventory = {
  capacity: number;
  stacks: ItemStack[];
  add: (id: string, qty: number) => number; // returns qty actually added
  clear: () => void;
  remove: (id: string, qty: number) => number; // returns qty actually removed
  count: (id: string) => number;
};

export function createInventory(capacity = 12): Inventory {
  const inv: Inventory = {
    capacity,
    stacks: [],
    add(id, qty) {
      const total = inv.stacks.reduce((a, s) => a + s.qty, 0);
      const free = Math.max(0, capacity - total);
      const put = Math.min(qty, free);
      if (put <= 0) return 0;
      const s = inv.stacks.find((t) => t.id === id);
      if (s) s.qty += put;
      else inv.stacks.push({ id, qty: put });
      return put;
    },
    clear() {
      inv.stacks = [];
    },
    remove(id, qty) {
      const s = inv.stacks.find((t) => t.id === id);
      if (!s) return 0;
      const take = Math.min(qty, s.qty);
      s.qty -= take;
      if (s.qty <= 0) inv.stacks = inv.stacks.filter((t) => t !== s);
      return take;
    },
    count(id) {
      const s = inv.stacks.find((t) => t.id === id);
      return s?.qty ?? 0;
    },
  };
  return inv;
}

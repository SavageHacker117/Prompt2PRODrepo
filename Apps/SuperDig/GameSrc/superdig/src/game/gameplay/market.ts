import type { Inventory } from "./inventory";
import type { PriceFn } from "./economy";

export function sellAll(inv: Inventory, price: PriceFn): number {
  let cr = 0;
  for (const s of inv.stacks) cr += price(s.id, s.qty);
  inv.clear();
  return cr;
}

export type PriceRow = { itemId: string; base: number; rarity?: number; biomeMod?: number; purityMaxPct?: number };
export type PriceFn = (id: string, qty: number) => number;

export function makePricer(rows: PriceRow[]): PriceFn {
  const map = new Map(rows.map(r => [r.itemId, r.base]));
  return (id, qty) => (map.get(id) || 0) * qty;
}

// Inventory.ts
export type Item = { id: string; name: string; meta?: Record<string, any> }
export class Inventory {
  items: Item[] = []
  add(it: Item) { this.items.push(it) }
  remove(id: string) { this.items = this.items.filter(i => i.id !== id) }
}

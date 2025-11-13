// Vendor.ts
export class Vendor {
  constructor(public id:string, public inventory:string[] = []){}
  buy(itemId:string){ /* ... */ }
  sell(itemId:string){ /* ... */ }
}

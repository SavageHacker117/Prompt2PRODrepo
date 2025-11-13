// StateMachine.ts
export class StateMachine<S extends string> {
  private s: S
  private handlers = new Map<S, { enter?: () => void; exit?: () => void; tick?: (dt:number)=>void }>()
  constructor(initial: S) { this.s = initial }
  def(state: S, h: { enter?():void; exit?():void; tick?(dt:number):void }) { this.handlers.set(state,h); return this }
  set(next: S){ if (this.s===next) return; this.handlers.get(this.s)?.exit?.(); this.s=next; this.handlers.get(this.s)?.enter?.() }
  tick(dt:number){ this.handlers.get(this.s)?.tick?.(dt) }
  get value(){ return this.s }
}

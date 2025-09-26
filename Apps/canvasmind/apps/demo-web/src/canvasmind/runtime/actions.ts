import type { CanvasMindContext } from "../init";

export type Action = { op: string; [k: string]: any };

export function applyAction(ctx: CanvasMindContext, action: Action) {
  ctx.bus.emit(action.op, action);
}

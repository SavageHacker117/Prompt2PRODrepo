import type { CanvasMindContext } from "../init";
import { applyAction, Action } from "./actions";

export function execute(ctx: CanvasMindContext, actions: Action[]) {
  for (const a of actions) {
    try {
      applyAction(ctx, a);
    } catch (e) {
      console.error("Action failed", a, e);
    }
  }
}

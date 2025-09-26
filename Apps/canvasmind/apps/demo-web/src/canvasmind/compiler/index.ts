import type { CanvasMindContext } from "../init";
import { policyPass } from "./passes/policy-pass";
import { budgetPass } from "./passes/budget-pass";

export function compileAndExecute(ctx: CanvasMindContext, actions: any[]) {
  const results: { action: any; allowed: boolean; reason?: string }[] = [];

  for (const action of actions) {
    const policy = policyPass(ctx, action);
    if (!policy.allowed) {
      results.push({ action, allowed: false, reason: policy.reason });
      continue;
    }

    const budget = budgetPass(action, { maxTris: ctx.budgets.trisSoftCap, maxTexMemMB: ctx.budgets.texMemSoftCapMB });
    if (!budget.allowed) {
      results.push({ action, allowed: false, reason: budget.reason });
      continue;
    }

    ctx.bus.emit(action.op, action);
    results.push({ action, allowed: true });
  }

  return results;
}

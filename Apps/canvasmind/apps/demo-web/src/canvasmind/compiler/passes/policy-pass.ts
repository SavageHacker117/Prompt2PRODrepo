import type { CanvasMindContext } from "../../init";

export type PolicyResult = {
  allowed: boolean;
  reason?: string;
};

export function policyPass(ctx: CanvasMindContext, action: { op: string; [k: string]: any }): PolicyResult {
  // Check DCWO ACLs
  if (action.targetId) {
    const dcwo = ctx.dcwo.get(action.targetId) as any;
    if (dcwo && dcwo.context?.acl?.roles?.ai) {
      const aiPerms = dcwo.context.acl.roles.ai;
      if (!aiPerms.includes(action.op) && !aiPerms.includes("all")) {
        return { allowed: false, reason: `Policy denied: ${action.op} on ${action.targetId}` };
      }
    }
  }

  return { allowed: true };
}

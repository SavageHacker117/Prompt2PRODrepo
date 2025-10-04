export type BudgetResult = {
  allowed: boolean;
  reason?: string;
};

export function budgetPass(
  action: { op: string; tris?: number; texMemMB?: number },
  limits: { maxTris?: number; maxTexMemMB?: number }
): BudgetResult {
  if (action.tris && limits.maxTris && action.tris > limits.maxTris) {
    return { allowed: false, reason: `Triangles exceed budget (${action.tris} > ${limits.maxTris})` };
  }
  if (action.texMemMB && limits.maxTexMemMB && action.texMemMB > limits.maxTexMemMB) {
    return { allowed: false, reason: `Texture mem exceeds budget (${action.texMemMB}MB > ${limits.maxTexMemMB}MB)` };
  }
  return { allowed: true };
}

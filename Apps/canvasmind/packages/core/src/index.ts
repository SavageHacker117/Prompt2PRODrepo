export type { BudgetCaps, Trackable } from "../../../apps/demo-web/src/canvasmind/budgets";
export { BudgetManager } from "../../../apps/demo-web/src/canvasmind/budgets";

// Common types (mirrors app-side)
export type DCWO<T = unknown> = {
  id: string;
  node?: T;
  context: {
    semantics: string[];
    provenance: Record<string, unknown>;
    constraints?: Record<string, unknown>;
    acl?: { roles: Record<string, string[]> };
    telemetry?: Record<string, unknown>;
  };
  policy: Record<string, unknown>;
};

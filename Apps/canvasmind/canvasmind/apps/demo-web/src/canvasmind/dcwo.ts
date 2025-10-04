// DCWO (Direct-Context Wrapped Object) helper types

export type DCWO<T = unknown> = {
  id: string;
  node?: T;
  context: {
    semantics: string[];
    constraints?: Record<string, unknown>;
    acl?: { roles: Record<string, string[]> };
    provenance?: Record<string, unknown>;
    telemetry?: Record<string, unknown>;
  };
  policy: Record<string, unknown>;
};

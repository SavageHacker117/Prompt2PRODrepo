// You can keep this even if init.ts already defines a bus; some modules import it directly.
export type Handler = (payload: unknown) => void;

export function createSceneBus() {
  const map = new Map<string, Set<Handler>>();
  return {
    on(type: string, fn: Handler) { if (!map.has(type)) map.set(type, new Set()); map.get(type)!.add(fn); },
    off(type: string, fn: Handler) { map.get(type)?.delete(fn); },
    emit(type: string, payload: unknown) { map.get(type)?.forEach((fn) => fn(payload)); }
  };
}

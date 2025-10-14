export type Input = {
  pressed: (code: string) => boolean;
  onKey: (fn: (code: string, down: boolean) => void) => void;
  consumeWheel: () => number; // positive = scroll down, negative = scroll up
  dispose: () => void;
};

export function createInput(target: HTMLElement): Input {
  const keys = new Map<string, boolean>();
  const onKeySubs = new Set<(code: string, down: boolean) => void>();
  let wheelDelta = 0;

  const kd = (e: KeyboardEvent) => { keys.set(e.code, true); onKeySubs.forEach(fn => fn(e.code, true)); };
  const ku = (e: KeyboardEvent) => { keys.set(e.code, false); onKeySubs.forEach(fn => fn(e.code, false)); };
  const wheel = (e: WheelEvent) => { wheelDelta += e.deltaY; };

  window.addEventListener("keydown", kd);
  window.addEventListener("keyup", ku);
  target.addEventListener("wheel", wheel, { passive: true });

  return {
    pressed: (code: string) => !!keys.get(code),
    onKey: (fn) => onKeySubs.add(fn),
    consumeWheel: () => { const v = wheelDelta; wheelDelta = 0; return v; },
    dispose: () => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      target.removeEventListener("wheel", wheel as any);
      onKeySubs.clear();
      keys.clear();
    }
  };
}

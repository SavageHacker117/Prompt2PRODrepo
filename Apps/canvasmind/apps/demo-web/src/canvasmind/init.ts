import type * as THREE from "three";

export type CanvasMindFeatures = {
  worldField?: boolean;
};

export type Budgets = {
  texMemSoftCapMB?: number;
  trisSoftCap?: number;
};

export type SceneBus = {
  on: (type: string, fn: (payload: unknown) => void) => void;
  off: (type: string, fn: (payload: unknown) => void) => void;
  emit: (type: string, payload: unknown) => void;
};

export type CanvasMindContext = {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  budgets: Budgets;
  features: CanvasMindFeatures;
  dcwo: Map<string, unknown>;
  bus: SceneBus;
  tickers: Array<(dt: number) => void>;
  guard: {
    allowShaderNodes: string[];
  };
  validators: {
    materialLimit: number;
    checkTextureBudget: (sizeMB: number) => boolean;
  };
};

export type InitOpts = {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  budgets?: Budgets;
  features?: CanvasMindFeatures;
};

export async function initCanvasMind(opts: InitOpts): Promise<CanvasMindContext> {
  const ctx: CanvasMindContext = {
    scene: opts.scene,
    renderer: opts.renderer,
    budgets: opts.budgets ?? {},
    features: opts.features ?? {},
    dcwo: new Map(),
    bus: createSceneBus(),
    tickers: [],
    guard: {
      // enforce via validators later
      allowShaderNodes: ["Lambert", "Phong", "Standard"]
    },
    validators: {
      materialLimit: 256,
      checkTextureBudget(sizeMB: number) {
        const cap = ctx.budgets?.texMemSoftCapMB ?? 128;
        return sizeMB <= cap;
      }
    }
  };

  return ctx;
}

export function createSceneBus(): SceneBus {
  const map = new Map<string, Set<(payload: unknown) => void>>();
  return {
    on(type, fn) {
      if (!map.has(type)) map.set(type, new Set());
      map.get(type)!.add(fn);
    },
    off(type, fn) {
      map.get(type)?.delete(fn);
    },
    emit(type, payload) {
      map.get(type)?.forEach((fn) => fn(payload));
    }
  };
}

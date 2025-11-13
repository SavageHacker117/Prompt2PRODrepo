// src/scriptBuilder/core/Telemetry.ts
import type * as THREE from 'three'

/** A single roll-up sample the HUD can render */
export type TelemetrySample = {
  ts: number               // ms since page load (performance.now)
  fps: number              // smoothed FPS
  frameMs: number          // smoothed frame duration in ms
  cpuLoad: number          // 0..1 approx (frameMs / 16.67)
  gpuMs?: number | null    // proxy: CPU time spent inside renderer.render
  gpuLoad?: number | null  // gpuMs / frameMs (if available)
  mem?: {
    usedMB?: number
    totalMB?: number
    limitMB?: number
  }
  actors?: number
  activeActorId?: string
}

/** Internal rolling average helper */
class EMA {
  private _v = 16.67
  constructor(private alpha = 0.12, seed = 16.67) { this._v = seed }
  push(v: number) { this._v = this._v * (1 - this.alpha) + v * this.alpha; return this._v }
  value() { return this._v }
}

type Unsub = () => void

/** Minimal event bus for counters/marks */
type CounterMap = Record<string, number>
type TimerMap = Record<string, number>

const logAdd: ((...lines: string[]) => void) | undefined =
  (window as any).__log?.add ?? undefined

class TelemetryCore {
  // sampling
  private rafId: number | null = null
  private last = performance.now()
  private emaFrame = new EMA(0.12, 16.67)
  private emaGpu = new EMA(0.20, 4.0)
  private sample: TelemetrySample = {
    ts: 0, fps: 60, frameMs: 16.67, cpuLoad: 0.5, gpuMs: null, gpuLoad: null,
  }
  private subs = new Set<(s: TelemetrySample) => void>()

  // counters/marks
  private counters: CounterMap = {}
  private timers: TimerMap = {}

  // renderer wrapping (GPU proxy)
  private wrappedRenderer?: THREE.WebGLRenderer
  private renderWrapInstalled = false

  /** Start the self-ticking sampler (idempotent) */
  start() {
    if (this.rafId != null) return
    const tick = (t: number) => {
      const dt = t - this.last
      this.last = t
      const sm = this.emaFrame.push(dt)
      const fps = 1000 / Math.max(1e-6, sm)

      // actor stats
      const eng: any = (window as any).__engine || {}
      const actors = eng.actors ? Object.keys(eng.actors).length : 0
      const activeActorId: string | undefined = eng.activeActorId

      // memory (Chrome)
      const mem: any = (performance as any).memory
        ? {
            usedMB: (memRound(mem.usedJSHeapSize)),
            totalMB: (memRound(mem.totalJSHeapSize)),
            limitMB: (memRound(mem.jsHeapSizeLimit)),
          }
        : undefined

      // gpu proxy load (if we were attached)
      const gpuMs = this.renderWrapInstalled ? this.emaGpu.value() : null
      const gpuLoad = gpuMs != null ? clamp(gpuMs / sm, 0, 2) : null

      this.sample = {
        ts: t, fps, frameMs: sm, cpuLoad: clamp(sm / 16.667, 0, 3),
        gpuMs, gpuLoad, mem, actors, activeActorId
      }
      this.emit()

      // basic “health” notifier
      if (fps < 25) maybeLogOncePer5s('low-fps', () =>
        logAdd?.(`⚠️ FPS low: ${fps.toFixed(1)} (frame ${sm.toFixed(1)}ms)`))

      this.rafId = requestAnimationFrame(tick)
    }
    this.last = performance.now()
    this.rafId = requestAnimationFrame(tick)
  }

  /** Stop the sampler */
  stop() {
    if (this.rafId != null) cancelAnimationFrame(this.rafId)
    this.rafId = null
  }

  /** Current snapshot */
  get(): TelemetrySample { return this.sample }

  /** Subscribe to live samples */
  subscribe(fn: (s: TelemetrySample) => void): Unsub {
    this.subs.add(fn); fn(this.sample)
    return () => this.subs.delete(fn)
  }

  /** Increment a named counter (for your own analytics) */
  inc(name: string, by = 1) {
    this.counters[name] = (this.counters[name] || 0) + by
  }
  /** Read a counter */
  getCount(name: string) { return this.counters[name] || 0 }
  /** Mark a timestamp */
  mark(name: string) { this.timers[name] = performance.now() }
  /** End a mark and return elapsed ms */
  end(name: string) {
    const t0 = this.timers[name]; delete this.timers[name]
    return t0 ? performance.now() - t0 : 0
  }

  /**
   * Attach to a THREE.WebGLRenderer to capture a GPU-time *proxy*.
   * We wrap `renderer.render()` and measure CPU time spent in it.
   * It’s not true GPU utilization but correlates well frame-to-frame.
   */
  attachThreeRenderer(renderer: THREE.WebGLRenderer) {
    if (this.renderWrapInstalled && this.wrappedRenderer === renderer) return
    const self = this
    const orig = renderer.render
    ;(renderer as any).__telemetryWrapped__ = true
    ;(renderer as any).__telemetryOrigRender__ = orig
    renderer.render = function (...args: any[]) {
      const t0 = performance.now()
      const out = (orig as any).apply(this, args)
      const dt = performance.now() - t0
      self.emaGpu.push(dt)
      return out
    } as any
    this.wrappedRenderer = renderer
    this.renderWrapInstalled = true
    logAdd?.('telemetry: attached render wrapper (gpu proxy)')
  }

  /** Detach previously wrapped renderer */
  detachThreeRenderer() {
    const r: any = this.wrappedRenderer
    if (r?.__telemetryWrapped__ && r.__telemetryOrigRender__) {
      r.render = r.__telemetryOrigRender__
      delete r.__telemetryWrapped__
      delete r.__telemetryOrigRender__
      this.renderWrapInstalled = false
      this.wrappedRenderer = undefined
      logAdd?.('telemetry: detached render wrapper')
    }
  }

  /** Manually report a GPU frame time if you time it elsewhere */
  reportGpuMs(ms: number) { this.emaGpu.push(ms) }

  // ── internals ──────────────────────────────────────────────────────────────
  private emit() { this.subs.forEach(fn => fn(this.sample)) }
}

function clamp(v: number, a: number, b: number) { return Math.min(b, Math.max(a, v)) }
function memRound(bytes?: number) { return bytes == null ? undefined : Math.round(bytes / 1024 / 1024) }

// avoid chatty logs: one message key per 5s
const lastLog: Record<string, number> = {}
function maybeLogOncePer5s(key: string, fn: () => void) {
  const now = performance.now()
  if (!lastLog[key] || now - lastLog[key] > 5000) { lastLog[key] = now; fn() }
}

// ── singleton export + window handle ─────────────────────────────────────────
export const Telemetry = new TelemetryCore()
;(window as any).__telemetry = {
  start: () => Telemetry.start(),
  stop:  () => Telemetry.stop(),
  get:   () => Telemetry.get(),
  subscribe: (fn: (s: TelemetrySample)=>void) => Telemetry.subscribe(fn),
  inc: (n: string, by?: number) => Telemetry.inc(n, by),
  mark: (n: string) => Telemetry.mark(n),
  end: (n: string) => Telemetry.end(n),
  attachThreeRenderer: (r: THREE.WebGLRenderer) => Telemetry.attachThreeRenderer(r),
  detachThreeRenderer: () => Telemetry.detachThreeRenderer(),
  reportGpuMs: (ms: number) => Telemetry.reportGpuMs(ms),
}

// auto-start so the HUD has data immediately
Telemetry.start()

export default Telemetry

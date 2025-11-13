import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type Handler = (args: string[]) => string | string[] | Promise<string | string[]>

// ───────────────────────────────────────────────────────────────────────────────
// tiny global log bus so ANYTHING can push lines into the HUD/console
// window.__log.add('text'), window.__log.clear(), window.__log.subscribe(cb)
// ───────────────────────────────────────────────────────────────────────────────
type LogBus = {
  add: (...lines: string[]) => void
  clear: () => void
  get: () => string[]
  subscribe: (fn: (lines: string[]) => void) => () => void
}
function ensureLog(): LogBus {
  const w = window as any
  if (!w.__log) {
    const listeners = new Set<(l: string[]) => void>()
    const state = { lines: [] as string[] }
    w.__log = {
      add: (...lines: string[]) => {
        const ts = new Date().toISOString().split('T')[1].split('.')[0]
        for (const l of lines) state.lines.push(`[${ts}] ${l}`)
        listeners.forEach(fn => fn(state.lines))
      },
      clear: () => { state.lines = []; listeners.forEach(fn => fn(state.lines)) },
      get: () => state.lines.slice(),
      subscribe: (fn: (l: string[]) => void) => { listeners.add(fn); fn(state.lines); return () => listeners.delete(fn) }
    }
  }
  return w.__log as LogBus
}

class ConsoleCore {
  commands = new Map<string, Handler>()
  help = new Map<string, string>()
  extend(name: string, handler: Handler, help?: string) {
    this.commands.set(name.toLowerCase(), handler)
    if (help) this.help.set(name.toLowerCase(), help)
  }
  async run(line: string): Promise<string> {
    const parts = line.trim().split(/\s+/)
    let cmd = (parts.shift() || '').toLowerCase()
    // forgiving aliases / typos
    if (cmd === 'bione' || cmd === 'bone') cmd = 'bones'
    if (!cmd) return ''
    const handler = this.commands.get(cmd)
    if (!handler) return `Unknown command: ${cmd}`
    const res = await handler(parts)
    return Array.isArray(res) ? res.join('\n') : `${res ?? ''}`
  }
}
const core = new ConsoleCore(); (window as any).__dbg = core
export function useDebugConsole() { return core }

export function DebugConsole() {
  const logBus = useMemo(() => ensureLog(), [])
  const [open, setOpen] = useState(true)           // start visible while iterating
  const [text, setText] = useState('')
  const [log, setLog] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  // subscribe to global log
  useEffect(() => logBus.subscribe(setLog), [logBus])

  useEffect(() => {
    core.extend('help', () => {
      const names = Array.from(core.help.entries()).map(([n, h]) => `${n} — ${h}`)
      return ['Commands:', ...names.length ? names : ['(no commands registered)']]
    }, 'List available commands')

    core.extend('clear', () => { logBus.clear(); return '' }, 'Clear console/log')

    // log ops
    core.extend('log', (args) => {
      const sub = (args[0] || '').toLowerCase()
      if (sub === 'clear') { logBus.clear(); return 'log cleared' }
      const n = Math.max(1, Math.min(500, parseInt(args[1] || '30')))
      if (sub === 'tail')  return logBus.get().slice(-n)
      return 'log tail [n] | log clear'
    }, 'log tail [n] | log clear')

    // scripts ui
    core.extend('scripts', (args) => {
      if ((args[0] || '').toLowerCase() === 'ui') {
        (window as any).__scriptPanel?.__uiToggle?.()
        return 'toggled script UI'
      }
      return 'Usage: scripts ui'
    }, 'scripts ui — toggle Script UI')

    // actor helpers
    core.extend('actor', (args) => {
      const eng = (window as any).__engine || {}
      const sub = (args[0] || '').toLowerCase()
      if (sub === 'list') {
        const ids = Object.keys(eng.actors || {})
        return ids.length ? ['> ACTOR LIST', ...ids] : '(no actors)'
      }
      if (sub === 'select') {
        const id = args[1]; eng.setActiveActor?.(id); return `selected ${id}`
      }
      if (sub === 'scale') {
        const v = parseFloat(args[1] || '1')
        const a: any = eng.activeActor || (eng.actors && Object.values<any>(eng.actors)[0])
        a?.setScale?.(v); return `scale ${isFinite(v) ? v.toFixed(2) : 'NaN'}`
      }
      if (sub === 'stats') {
        const root: any = (eng.activeActor && eng.activeActor.object) || null
        if (!root) return '(no active actor)'
        let skinned = 0, bones = 0
        root.traverse((o: any) => { if (o.isSkinnedMesh) skinned++; if (o.isBone) bones++ })
        return `skinned meshes=${skinned}, bones=${bones}`
      }
      return 'actor list | actor select <id> | actor scale <v> | actor stats'
    }, 'Actor management: list/select/scale/stats')

    // bones / helper / overlay
    core.extend('bones', (args) => {
      const eng = (window as any).__engine || {}
      const a: any = eng.activeActor || (eng.actors && Object.values<any>(eng.actors)[0])
      if (!a) return 'no active actor'
      const sub = (args[0] || '').toLowerCase()
      const onwords = new Set(['on','son','oon'])      // accept minor typos
      if (sub === 'on' || onwords.has(sub))  { a.bones?.show?.(true);  return 'bones: on' }
      if (sub === 'off')                     { a.bones?.show?.(false); return 'bones: off' }
      if (sub === 'toggle')                  { a.bones?.toggle?.();    return 'bones: toggle' }
      if (sub === 'helper') {
        const s = (args[1] || '').toLowerCase()
        if      (s === 'on')  { a.bones?.setOverlay?.(true);  return 'bones helper: overlay on' }
        else if (s === 'off') { a.bones?.setOverlay?.(false); return 'bones helper: overlay off' }
        else if (s === 'toggle') { a.bones?.setOverlay?.(); return 'bones helper: overlay toggled' }
        return 'bones helper [on|off|toggle]'
      }
      return 'bones on|off|toggle | bones helper [on|off|toggle]'
    }, 'Show/hide skeleton helper (and overlay/x-ray)')

    // UI controls
    core.extend('ui', (args) => {
      const sub = (args[0] || '').toLowerCase()
      if (sub === 'compact') {
        const on = /^(1|on|true)$/i.test(args[1] || '')
        document.body.classList.toggle('hud-compact', on)
        return `UI compact: ${on?'on':'off'}`
      }
      if (sub === 'pos') {
        const p = (args[1] || 'top').toLowerCase()
        document.body.classList.toggle('hud-top', p !== 'bottom')
        document.body.classList.toggle('hud-bottom', p === 'bottom')
        return `UI position: ${p}`
      }
      if (sub === 'opacity') {
        const v = Math.max(0.2, Math.min(1, parseFloat(args[1] || '1')))
        document.documentElement.style.setProperty('--hudOpacity', String(v))
        return `UI opacity: ${v.toFixed(2)}`
      }
      return 'ui compact on|off | ui pos top|bottom | ui opacity <0.2..1>'
    }, 'Small display tweaks for the HUD/console')
  }, [logBus])

  // hotkeys
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '`') { setOpen(v => !v); setTimeout(() => inputRef.current?.focus(), 0) }
      if (e.key.toLowerCase() === 'h') {
        const eng = (window as any).__engine || {}
        const a: any = eng.activeActor || (eng.actors && Object.values<any>(eng.actors)[0])
        a?.bones?.toggle?.()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const onSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    const line = text.trim(); if (!line) return
    logBus.add(`> ${line}`)
    try {
      const out = await core.run(line)
      if (out) logBus.add(out)
    } catch (err: any) {
      logBus.add(String(err?.message || err))
    }
    setText('')
  }, [text, logBus])

  if (!open) return null
  return (
    <div className="console">
      <form onSubmit={onSubmit}>
        <input
          ref={inputRef}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder='type a command, e.g. "actor list", "bone inject 8", "bones on"'
        />
      </form>
      <div className="help">{log.join('\n')}</div>

      <style>{`
        :root { --hudOpacity: 1; }
        .console {
          position: fixed;
          left: 12px; right: 12px;
          top: 54px;
          background: rgba(0,0,0,calc(.35 * var(--hudOpacity)));
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 10px;
          padding: 6px; pointer-events: all; color: #ddd; font-size: 12px;
        }
        body.hud-bottom .console { top: auto; bottom: 84px; }
        .console input {
          width: 100%; background: rgba(0,0,0,.45); border: 1px solid rgba(255,255,255,.15);
          padding: 6px 8px; border-radius: 8px; color: #eee;
        }
        .help { margin-top: 8px; white-space: pre-wrap; max-height: 160px; overflow: auto; }
        body.hud-compact .console { top: 6px; font-size: 11px; }
      `}</style>
    </div>
  )
}

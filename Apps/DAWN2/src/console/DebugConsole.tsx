import React, { useCallback, useEffect, useRef, useState } from 'react'
type Handler = (args: string[]) => string | string[] | Promise<string | string[]>
class ConsoleCore {
  commands = new Map<string, Handler>()
  help = new Map<string, string>()
  extend(name: string, handler: Handler, help?: string) {
    this.commands.set(name.toLowerCase(), handler)
    if (help) this.help.set(name.toLowerCase(), help)
  }
  async run(line: string): Promise<string> {
    const parts = line.trim().split(/\s+/)
    const cmd = (parts.shift() || '').toLowerCase()
    const handler = this.commands.get(cmd)
    if (!cmd) return ''
    if (!handler) return `Unknown command: ${cmd}`
    const res = await handler(parts)
    return Array.isArray(res) ? res.join('\n') : `${res ?? ''}`
  }
}
const core = new ConsoleCore(); (window as any).__dbg = core
export function useDebugConsole() { return core }
export function DebugConsole() {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [log, setLog] = useState<string[]>(['Console ready. Type "anim help". Press ` to toggle.'])
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    core.extend('help', () => {
      const names = Array.from(core.help.entries()).map(([n, h]) => `${n} — ${h}`)
      return ['Commands:', ...names.length?names:['(no commands registered)']]
    }, 'List available commands')
    core.extend('clear', () => { setLog([]); return '' }, 'Clear console')
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === '`') { setOpen(v => !v); setTimeout(() => inputRef.current?.focus(), 0) } }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  }, [])
  const onSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault(); const line = text.trim(); if (!line) return
    setLog(l => [...l, `> ${line}`]); try { const out = await core.run(line); if (out) setLog(l => [...l, out]) } catch (err:any) { setLog(l => [...l, String(err?.message || err)]) }
    setText('')
  }, [text])
  if (!open) return null
  return (<div className="console"><form onSubmit={onSubmit}><input ref={inputRef} value={text} onChange={e=>setText(e.target.value)} placeholder='type a command, e.g. "anim list"' /></form><div className="help" style={{whiteSpace:'pre-wrap', marginTop:8}}>{log.join('\n')}</div></div>)
}

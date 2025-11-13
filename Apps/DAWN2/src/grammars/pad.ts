export function registerPadGrammar(dbg: any) {
  const help = [
    'pad help        — show help',
    'pad show        — show controller overlay (if available)',
    'pad hide        — hide controller overlay',
    'pad map         — show button/axis map (debug)',
    'pad info        — dump active pad info',
  ]

  dbg.extend(
    'pad',
    (args: string[]) => {
      const sub = (args[0] || '').toLowerCase()
      const pad = (window as any).__pad || {}

      if (!sub || sub === 'help') return help
      if (sub === 'show') { pad.show?.(); return 'overlay shown' }
      if (sub === 'hide') { pad.hide?.(); return 'overlay hidden' }
      if (sub === 'map')  { pad.map?.();  return 'map overlay toggled' }
      if (sub === 'info') { return pad.info?.() || 'no active gamepad' }

      return 'Unknown "pad" subcommand (try "pad help").'
    },
    'Gamepad tools'
  )
}

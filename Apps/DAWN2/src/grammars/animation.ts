// Animation grammar: talks to the AnimPanel bridge that Rose.tsx exposes
type AnimAPI = {
  list?: () => string[]
  play?: (name: string) => boolean
  fadeTo?: (name: string, t?: number) => boolean
  stop?: (name?: string) => boolean
  speed?: (v: number) => boolean
  current?: () => string
  _getSelectedAction?: () => {
    setEffectiveWeight: (v: number) => void
    setLoop: (mode: number, repeats: number) => void
  } | null
  __uiToggle?: () => boolean
}

export function registerAnimGrammar(
  dbg: any,
  _engine?: any,
  _levels?: any,
  extras: { animPanel?: AnimAPI } = {}
) {
  const api: AnimAPI = extras.animPanel || (window as any).__animPanel || {}

  const handler = (args: string[]) => {
    const sub = (args[0] || '').toLowerCase()

    if (!sub || sub === 'help') {
      return [
        'anim ui|toggle              — open/close animation panel',
        'anim list                   — list clips',
        'anim play <name>            — play a clip',
        'anim fade <name> [t=0.25]   — cross-fade to a clip',
        'anim speed <v>              — mixer timeScale (0..3)',
        'anim weight <v>             — selected action weight (0..1)',
        'anim loop on|off            — toggle loop on selected action',
        'anim stop [name]            — stop selected or named action',
        'anim current                — print current action name',
      ]
    }

    if (sub === 'ui' || sub === 'toggle') {
      api.__uiToggle?.()
      return 'anim panel toggled'
    }

    if (sub === 'list' || sub === 'ls') {
      const names = api.list?.() || []
      return names.length ? names.join('\n') : '(no clips)'
    }

    if (sub === 'play') {
      const name = args.slice(1).join(' ')
      if (!name) return 'usage: anim play <name>'
      return api.play?.(name) ? `playing ${name}` : `no such clip: ${name}`
    }

    if (sub === 'fade') {
      const name = args.slice(1, -1).join(' ') || args[1]
      const t = parseFloat(args[args.length - 1])
      const dur = Number.isFinite(t) ? t : 0.25
      if (!name) return 'usage: anim fade <name> [duration]'
      return api.fadeTo?.(name, dur) ? `fading to ${name} (${dur}s)` : `no such clip: ${name}`
    }

    if (sub === 'speed') {
      const v = parseFloat(args[1])
      if (!Number.isFinite(v)) return 'usage: anim speed <number>'
      api.speed?.(v)
      return `speed = ${v.toFixed(2)}`
    }

    if (sub === 'weight') {
      const v = parseFloat(args[1])
      if (!Number.isFinite(v)) return 'usage: anim weight <0..1>'
      api._getSelectedAction?.()?.setEffectiveWeight(v)
      return `weight = ${v.toFixed(2)}`
    }

    if (sub === 'loop') {
      const onoff = (args[1] || '').toLowerCase()
      const on = onoff !== 'off'
      // THREE.LoopOnce = 2200, LoopRepeat = 2201
      api._getSelectedAction?.()?.setLoop(on ? 2201 : 2200, Infinity)
      return `loop = ${on ? 'on' : 'off'}`
    }

    if (sub === 'stop') {
      const name = args.slice(1).join(' ') || undefined
      api.stop?.(name)
      return name ? `stopped ${name}` : 'stopped'
    }

    if (sub === 'current') {
      return api.current?.() || '(none)'
    }

    return 'Unknown "anim" subcommand (try "anim help").'
  }

  dbg.extend('anim', handler, 'Animation tooling commands (type "anim help").')
  dbg.extend('animation', handler, 'Animation tooling commands (type "anim help").')
}

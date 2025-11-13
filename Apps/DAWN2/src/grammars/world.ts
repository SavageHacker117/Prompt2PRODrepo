export function registerWorldGrammar(dbg: any) {
  dbg.extend(
    'world',
    (args: string[]) => {
      const sub = (args[0] || '').toLowerCase()
      const api = (window as any).__world

      if (!sub || sub === 'help') {
        return [
          'world reset         — reset to defaults',
          'world clear         — clear blocks/groups',
          'world groups clear  — remove all groups',
          'world export        — download world.json',
        ]
      }

      if (!api) return 'world API not ready'

      if (sub === 'reset') {
        api.reset?.()
        return 'world reset'
      }

      if (sub === 'clear') {
        api.clear?.()
        return 'cleared'
      }

      if (sub === 'groups' && (args[1] || '').toLowerCase() === 'clear') {
        api.clearGroups?.()
        return 'groups cleared'
      }

      if (sub === 'export') {
        const data = api.export?.() || '{}'
        const blob = new Blob([data], { type: 'application/json' })
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = 'world.json'
        a.click()
        setTimeout(() => URL.revokeObjectURL(a.href), 500)
        return 'exported world.json'
      }

      return 'Unknown "world" subcommand (try "world help").'
    },
    'World tools (type "world help").',
  )
}

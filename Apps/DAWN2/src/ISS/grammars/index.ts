// Entry point for ISS grammars (Independent Sub Systems)
// Right now it just wires the ocean system.

import { registerOceanGrammar } from './ocean'

type Dbg = {
  extend: (
    name: string,
    fn: (args: string[]) => string | string[],
    help: string,
  ) => void
}

export function registerISSGrammar(
  dbg: Dbg,
  engine: any,
  levels: Record<string, unknown> = {},
  extras: Record<string, unknown> = {},
) {
  // Ensure ISS namespace exists on the engine
  // (EngineBridge creates it too; this is just defensive.)
  const iss = (engine.iss ||= {})
  iss._dbg = dbg

  registerOceanGrammar(dbg, engine, levels, extras)
}

export { registerOceanGrammar } from './ocean'

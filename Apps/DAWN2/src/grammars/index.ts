// DAWN2/src/grammars/index.ts
import { registerAnimGrammar } from './animation'
import { registerPadGrammar } from './pad'
import { registerEnvGrammar } from './env'
import { registerPuppetGrammar } from './puppet'
import { registerWorldGrammar } from './world'
import { registerBonesGrammar } from './bones'
import { initPlayerControls } from './AnimationState'

type Dbg = {
  extend: (
    name: string,
    fn: (args: string[]) => string | string[],
    help: string,
  ) => void
}

export function registerGrammars(
  dbg: Dbg,
  engine: any,
  levels: Record<string, unknown> = {},
  extras: Record<string, unknown> = {},
) {
  // Ensure player controls are wired once per engine
  if (!engine.__playerControls) {
    engine.__playerControls = initPlayerControls()
  }

  registerAnimGrammar(dbg, engine, levels, extras)
  registerPadGrammar(dbg, engine, levels, extras)
  registerEnvGrammar(dbg, engine, levels, extras)
  registerPuppetGrammar(dbg, engine, levels, extras)
  registerWorldGrammar(dbg)
  registerBonesGrammar(dbg)
}

export { registerWorldGrammar } from './world'

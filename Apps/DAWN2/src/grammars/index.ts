// src/grammars/index.ts
import { registerAnimGrammar } from './animation'
import { registerPadGrammar } from './pad'
import { registerEnvGrammar } from './env'
import { registerPuppetGrammar } from './puppet'
import { registerWorldGrammar } from './world'
import { registerBonesGrammar } from './bones'
import { initPlayerControls } from './AnimationState'
import { registerMobGrammar } from './mobs'
import { registerISSGrammar } from '../ISS/grammars'
import { registerGunsGrammar } from './guns'
import { registerMemeGrammar } from './meme'
import { registerPerfGrammar } from './perf'

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
  registerWorldGrammar(dbg, engine, levels, extras)
  registerBonesGrammar(dbg, engine, levels, extras)
  registerMobGrammar(dbg, engine, levels, extras)
  registerGunsGrammar(dbg, engine, levels, extras)

  // Independent Sub Systems (ISS): oceans, etc.
  registerISSGrammar(dbg, engine, levels, extras)

  // Perf + GPU tuning
  registerPerfGrammar(dbg, engine, levels, extras)

  // MemeTo3D / backend integration commands
  registerMemeGrammar(dbg, engine, levels, extras)
}

export { registerWorldGrammar } from './world'
export { registerGunsGrammar } from './guns'

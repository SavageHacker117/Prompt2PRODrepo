// index.ts
import { registerAnimGrammar } from './animation';
import { registerPadGrammar } from './pad';
import { registerEnvGrammar } from './env';
import { registerPuppetGrammar } from './puppet';
import { registerWorldGrammar } from './world';
import { registerBonesGrammar } from './bones';

type Dbg = {
  extend: (name: string, fn: (args: string[]) => string | string[], help: string) => void;
};

export function registerGrammars(
  dbg: Dbg,
  engine: any,
  levels: Record<string, unknown> = {},
  extras: Record<string, unknown> = {}
) {
  registerAnimGrammar(dbg, engine, levels, extras);
  registerPadGrammar(dbg, engine, levels, extras);
  registerEnvGrammar(dbg, engine, levels, extras);
  registerPuppetGrammar(dbg, engine, levels, extras);
  registerWorldGrammar(dbg);
  registerBonesGrammar(dbg);
}

export { registerWorldGrammar } from './world';

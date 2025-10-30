// grammar/index.js
import { registerAnimationGrammar } from './animation.js';
import { registerPuppetGrammar }    from './puppet.js';
import { registerPadGrammar }       from './pad.js';
import { registerEnvGrammar }       from './env.js';

export function registerGrammars(dbg, engine, levels, extras = {}) {
  registerAnimationGrammar(dbg, engine, levels, extras);
  registerPuppetGrammar(dbg, engine, levels, extras);
  registerPadGrammar(dbg, engine, levels, extras);
  registerEnvGrammar(dbg, engine, levels, extras);
}

// Backward compat (some code calls registerGrammar singular)
export const registerGrammar = registerGrammars;
export default registerGrammars;

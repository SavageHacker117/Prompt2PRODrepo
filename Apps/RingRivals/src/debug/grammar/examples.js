import { tokens } from './tokens.js';

/** tiny pattern helper for autocomplete prompts */
export const patterns = {
  'cam.mode':      ['MODE'],
  'cam.follow':    ['WHO'],
  'cam.fov':       ['<number>'],
  'arena':         ['ARENA'],
  'time':          ['<0.1..1.5>'],
  'ai':            ['on|off'],
  'spawn.powerup': ['POWER'],
  'reset.spawn':   [],
  'hud':           ['on|off']
};

export function suggest(cmd, arg) {
  const pats = patterns[cmd];
  if (!pats || !pats.length) return [];
  const key = pats[0];
  if (tokens[key]) {
    const q = (arg || '').toLowerCase();
    return tokens[key].filter(v => v.toLowerCase().startsWith(q));
  }
  return [];
}

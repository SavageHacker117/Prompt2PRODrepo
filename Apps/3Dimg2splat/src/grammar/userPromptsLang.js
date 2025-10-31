// src/grammar/userPromptsLang.js
// Lightweight prompt grammar → structured TerrainSpec

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const has  = (words, text) => words.some(w => new RegExp(`\\b${w}\\b`, 'i').test(text));

const DIR_WORDS = {
  north: 'N', south: 'S', east: 'E', west: 'W',
  northeast: 'NE', northwest: 'NW', southeast: 'SE', southwest: 'SW',
  'ne-sw': 'NE-SW', 'nw-se': 'NW-SE', 'e-w': 'E-W', 'n-s': 'N-S',
};
function dirFrom(text) {
  for (const k in DIR_WORDS) if (new RegExp(`\\b${k}\\b`, 'i').test(text)) return DIR_WORDS[k];
  return null;
}

const BIOMES = {
  desert:    { temp: 0.9,  moisture: 0.1,  treeDensity: 0.02, grass: 0.05 },
  temperate: { temp: 0.55, moisture: 0.55, treeDensity: 0.35, grass: 0.8  },
  alpine:    { temp: 0.2,  moisture: 0.5,  treeDensity: 0.25, grass: 0.5  },
  tropical:  { temp: 0.85, moisture: 0.85, treeDensity: 0.7,  grass: 0.9  },
};

export function parsePrompt(prompt) {
  const p = String(prompt || '').toLowerCase();

  const spec = {
    seedText: prompt || 'world',
    scaleKm: has(['huge', 'massive', 'continent'], p) ? 64 : has(['small', 'tiny', 'islet'], p) ? 4 : 16,
    features: [],
    coast: null,
    dunes: null,
    plateaus: [],
    mesas: [],
    canyons: [],
    lakes: [],
    poi: []
  };

  // Mountains / ridges
  if (has(['mountain', 'mountains', 'range', 'ridge', 'ridges', 'alps', 'rockies'], p)) {
    let ridges = 1;
    const rm = p.match(/\b(\d+)\s*ridges?\b/);
    if (rm) ridges = parseInt(rm[1], 10);
    else if (/\branges?\b/.test(p)) ridges = 2;

    const steepness = /\bsteep|jagged|rugged\b/.test(p) ? 0.8 : /\bgentle|rolling\b/.test(p) ? 0.35 : 0.6;
    const snowline  = /\bsnow|snowy|alpine|glacier\b/.test(p) ? 0.6 : 0.95;
    const orientation = (dirFrom(p) || pick(['E-W', 'NE-SW', 'NW-SE', 'N-S']));

    spec.features.push({ type: 'mountainRange', ridges, steepness, snowline, orientation });
  }

  // Valley
  if (has(['valley', 'valleys', 'vale'], p)) {
    const width = /\bbroad|wide\b/.test(p) ? 0.6 : /\bnarrow\b/.test(p) ? 0.2 : 0.35;
    const depth = /\bdeep\b/.test(p) ? 0.6 : /\bshallow\b/.test(p) ? 0.2 : 0.35;
    const vegetation = /\bgreen|lush|fertile\b/.test(p) ? 0.9 : 0.5;
    spec.features.push({ type: 'valley', width, depth, vegetation });
  }

  // Rivers
  if (/\briver|rivers\b/.test(p)) {
    let count = 2;
    const m = p.match(/\b(\d+)\s*rivers?\b/);
    if (m) count = parseInt(m[1], 10);
    else if (/\bmany\b/.test(p)) count = 3;
    else if (/\bfew\b/.test(p)) count = 1;

    const meander = /\bmeander|meandering|winding\b/.test(p) ? 0.7 : 0.45;
    const source  = /\bspring|lake\b/.test(p) ? 'spring' : 'mountain';
    const width   = /\bwide|delta\b/.test(p) ? 3 : 2;
    spec.features.push({ type: 'river', count, meander, source, width });
  }

  // Lakes
  if (/\blake|lakes\b/.test(p)) spec.lakes.push({ count: /\bmany\b/.test(p) ? 5 : 2, size: 0.3 });

  // Coast / ocean
  if (/\bcoast|shore|ocean|sea|beach\b/.test(p)) {
    let pos = dirFrom(p);
    if (!pos) {
      // phrases like "west coast", "coast to the west", "western coast"
      if (/\b(west|western)\b.*\bcoast\b/.test(p) || /\bcoast\b.*\b(west|western)\b/.test(p)) pos = 'W';
      else if (/\b(east|eastern)\b.*\bcoast\b/.test(p) || /\bcoast\b.*\b(east|eastern)\b/.test(p)) pos = 'E';
      else if (/\b(north|northern)\b.*\bcoast\b/.test(p) || /\bcoast\b.*\b(north|northern)\b/.test(p)) pos = 'N';
      else if (/\b(south|southern)\b.*\bcoast\b/.test(p) || /\bcoast\b.*\b(south|southern)\b/.test(p)) pos = 'S';
    }
    spec.coast = { type: 'ocean', position: pos || pick(['N', 'S', 'E', 'W']), bays: /\bbays|coves\b/.test(p) ? 0.6 : 0.3 };
  }

  // Deserts / dunes / mesas / plateaus / canyon
  if (/\bdesert|dune|dunes\b/.test(p)) spec.dunes = { intensity: /\bbig|tall\b/.test(p) ? 0.8 : 0.5, orientation: dirFrom(p) || 'E-W' };
  if (/\bmesa|mesas\b/.test(p))     spec.mesas.push({ count: 2, height: 0.6 });
  if (/\bplateau|plateaus\b/.test(p)) spec.plateaus.push({ count: 1, height: 0.5, area: 0.25 });
  if (/\bcanyon|gorge\b/.test(p))   spec.canyons.push({ count: 1, depth: 0.7 });

  // Biome hints
  if (/\bforest|pine|birch|oak|woods\b/.test(p)) {
    spec.features.push({ type: 'biome', kind: 'temperate', treeDensity: 0.6, grass: 0.8 });
  } else if (/\balpine|tundra\b/.test(p)) {
    spec.features.push({ type: 'biome', kind: 'alpine', ...BIOMES.alpine });
  } else if (/\btropical|jungle|rainforest\b/.test(p)) {
    spec.features.push({ type: 'biome', kind: 'tropical', ...BIOMES.tropical });
  } else if (/\bdesert\b/.test(p)) {
    spec.features.push({ type: 'biome', kind: 'desert', ...BIOMES.desert });
  }

  return spec;
}

export default parsePrompt;

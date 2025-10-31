// src/terrain/pipeline/steps/Materials.js
export function surfaceMaterial(info){ // slope, alt, moisture, temp, biomeId...
  // return layered materials + optional decoration hints
  return {
    top:  info.biomeId === 'desert' ? 'sand'  : info.alt > 26 ? 'snow' : 'grass',
    sub:  info.biomeId === 'desert' ? 'sand'  : 'dirt',
    rock: 'stone',
    deco: (info.biomeId === 'forest' && info.slope < 1 && info.moisture > 0.4) ? 'tree' : null
  };
}

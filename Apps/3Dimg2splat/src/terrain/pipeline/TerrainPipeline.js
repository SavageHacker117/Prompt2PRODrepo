import { createHeightField } from './steps/HeightField.js';
import { applyRivers } from './steps/Rivers.js';
import { resolveWater } from './steps/Water.js';
import { makeMaterialPicker } from './steps/Biomes.js';
import { specToParams } from '../../grammar/mappers/SpecToTerrainParams.js';

// Build a field the WorldGenerator can use:
// { height(x,z), waterLevel, pickMaterial(x,y,z,top), params }
export function buildPipelineField(seed, specOrParams = {}, lumInfo = null) {
  const params = specOrParams?.features
    ? specToParams(specOrParams, seed)
    : { ...specOrParams };

  // 1) base
  const base = createHeightField(seed, params, lumInfo); // -> { height(x,z) }

  // 2) rivers (wrap the fn, do not mutate base)
  const carved = applyRivers(base.height, seed, params); // -> { height(x,z) }

  // 3) waterline
  const water = resolveWater(params);

  // 4) materials / biomes
  const picker = makeMaterialPicker(params, carved.height);

  return {
    height: carved.height,
    waterLevel: water.seaLevel,
    pickMaterial: (x, y, z, surfaceY) => picker.pick(x, y, z, surfaceY, water.seaLevel),
    params,
  };
}

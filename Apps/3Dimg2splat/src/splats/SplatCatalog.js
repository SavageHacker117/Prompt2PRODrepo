import { generateSplatVariant } from './SplatGen.js'

const cache = new Map()

export function getMaterialSplats (materialName, baseColorHex) {
  const key = materialName + ':' + baseColorHex
  if (cache.has(key)) return cache.get(key)

  // deterministic seeds per material name
  let seed = 0
  for (const ch of materialName) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0

  const low = generateSplatVariant({ baseColor: baseColorHex, seed, variant: 'low' })
  const med = generateSplatVariant({ baseColor: baseColorHex, seed: seed ^ 0xabc, variant: 'medium' })
  const hi  = generateSplatVariant({ baseColor: baseColorHex, seed: seed ^ 0x123, variant: 'high' })

  const entry = { low, medium: med, high: hi }
  cache.set(key, entry)
  return entry
}

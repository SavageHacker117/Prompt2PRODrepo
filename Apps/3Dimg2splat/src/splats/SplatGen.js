import { mulberry32 } from '../utils/SeedUtils.js'

export function hexToRgb (hex) {
  const c = (typeof hex === 'number') ? hex : parseInt(String(hex).replace('#', ''), 16)
  return { r: (c >> 16) & 255, g: (c >> 8) & 255, b: c & 255 }
}
function lerp (a, b, t) { return a + (b - a) * t }

export function generateSplatVariant ({ baseColor = 0xffffff, seed = 1337, variant = 'medium' }) {
  const settings = ({
    low:    { count:  60, minR: 4, maxR: 18, size:  64 },
    medium: { count: 180, minR: 3, maxR: 14, size: 128 },
    high:   { count: 520, minR: 2, maxR: 10, size: 256 }
  })[variant] || { count: 180, minR: 3, maxR: 14, size: 128 }

  const rnd = mulberry32(seed | 0)
  const { r, g, b } = hexToRgb(baseColor)
  const splats = []
  const W = settings.size, H = settings.size
  const grid = Math.ceil(Math.sqrt(settings.count))

  for (let i = 0; i < settings.count; i++) {
    const gx = i % grid
    const gy = (i / grid) | 0
    const jx = (gx + rnd() * 0.9) / grid
    const jy = (gy + rnd() * 0.9) / grid
    const x = Math.floor(jx * W)
    const y = Math.floor(jy * H)
    const radius = lerp(settings.minR, settings.maxR, rnd())
    const alpha = 0.5 + rnd() * 0.5
    const tint = 0.85 + rnd() * 0.3
    const cr = Math.min(255, Math.max(0, Math.round(r * tint)))
    const cg = Math.min(255, Math.max(0, Math.round(g * tint)))
    const cb = Math.min(255, Math.max(0, Math.round(b * tint)))
    splats.push({ x, y, radius, color: [cr, cg, cb], alpha })
  }

  return { type: 'splat2D', size: [W, H], seed, variant, baseColor, splats }
}

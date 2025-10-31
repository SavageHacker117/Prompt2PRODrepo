// Paint a 2D splat asset into a canvas for thumbnails or canvas textures.
export function renderSplatsToCanvas (asset) {
  const [W, H] = asset.size
  const cvs = document.createElement('canvas')
  cvs.width = W
  cvs.height = H
  const ctx = cvs.getContext('2d')

  for (const s of asset.splats) {
    const rad = Math.max(0.001, s.radius || 1)
    const a = (s.alpha ?? 1) * 0.85
    const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, rad)
    const base = `rgba(${s.color[0]},${s.color[1]},${s.color[2]},`
    g.addColorStop(0, base + a.toFixed(3) + ')')
    g.addColorStop(1, base + '0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(s.x, s.y, rad, 0, Math.PI * 2)
    ctx.fill()
  }
  return cvs
}

export class PaletteUI {
  constructor (materials, worldState) {
    this.materials = materials
    this.worldState = worldState
    this.root = document.createElement('div')
    this.root.className = 'panel'
    this.root.id = 'palette'

    const names = materials.names()
    names.forEach(n => {
      const item = document.createElement('div')
      item.className = 'palette-item'
      item.style.background = '#111827'

      const sw = document.createElement('canvas')
      sw.width = 36
      sw.height = 36
      sw.style.borderRadius = '8px'
      sw.style.border = '1px solid #2a2f45'
      const ctx = sw.getContext('2d')

      const mat = materials.get(n)
      if (mat.map && mat.map.image) {
        // CanvasTexture → HTMLImageElement/Canvas available as .image
        ctx.drawImage(mat.map.image, 0, 0, 36, 36)
      } else {
        ctx.fillStyle = '#' + mat.color.getHexString()
        ctx.fillRect(0, 0, 36, 36)
      }

      const nm = document.createElement('div')
      nm.className = 'name'
      nm.textContent = n

      item.appendChild(sw)
      item.appendChild(nm)

      item.addEventListener('click', () => {
        this.worldState.currentMaterial = n
        ;[...this.root.querySelectorAll('.palette-item')]
          .forEach(el => el.classList.remove('selected'))
        item.classList.add('selected')
      })

      if (n === this.worldState.currentMaterial) item.classList.add('selected')
      this.root.appendChild(item)
    })
  }

  getElement () { return this.root }
}

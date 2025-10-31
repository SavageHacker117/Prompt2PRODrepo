import { promptToSeed, imageToSeedAndFeatures } from '../utils/ImagePromptParser.js'
export class MainMenu{
  constructor(worldGen, worldState){
    this.worldGen=worldGen; this.worldState=worldState
    this.root=document.createElement('div'); this.root.className='panel'; this.root.id='mainmenu'
    this.root.innerHTML = `
      <h3>SPLATS 2 WEB — World Gen</h3>
      <label>Prompt</label>
      <input id="prompt" class="input" type="text" placeholder="mountains with rivers, green valley"/>
      <div class="row">
        <button class="btn" id="seedPrompt">Seed again</button>
        <button class="btn" id="close">Close</button>
      </div>
      <label>Splat textures</label>
      <div class="row">
        <button class="btn" id="splatToggle">Toggle</button>
        <select class="input" id="splatQ">
          <option value="low">Low</option>
          <option value="medium" selected>Medium</option>
          <option value="high">High</option>
        </select>
        <button class="btn" id="exportSplats">Export splat JSONs</button>
      </div>
      <label>Or upload an image</label>
      <input id="img" class="input" type="file" accept="image/*"/>
      <p class="small">Tip: use <kbd>1</kbd> Orbit, <kbd>2</kbd> First-person, <kbd>3</kbd> Fly. Left-click place, Right-click remove.</p>
    `
    this.root.style.display = 'block'
    this.root.querySelector('#seedPrompt').onclick = async () => { const prompt = this.root.querySelector('#prompt').value; await this.worldGen.seedFromPrompt(String(prompt)); this.flash('Regenerated world from prompt.') }
    this.root.querySelector('#close').onclick = ()=> this.toggle(false)
    this.root.querySelector('#img').addEventListener('change', async (e)=>{ const file = e.target.files[0]; if(!file) return; const info = await imageToSeedAndFeatures(file); await this.worldGen.seedFromImage(info); this.flash('Regenerated world from image.') })
    // Splat toggles
    this.root.querySelector('#splatToggle').onclick = ()=>{ const mlib=this.worldGen.materials; mlib.opts.useSplatTextures=!mlib.opts.useSplatTextures; this.worldGen._reseed() }
    this.root.querySelector('#splatQ').onchange = (e)=>{ this.worldGen.materials.opts.splatQuality=e.target.value; this.worldGen._reseed() }
    this.root.querySelector('#exportSplats').onclick = async ()=>{
      const { getMaterialSplats } = await import('../splats/SplatCatalog.js')
      const names = this.worldGen.materials.names()
      names.forEach(n=>{
        const m = this.worldGen.materials.get(n)
        const pack = getMaterialSplats(n, m.color.getHex())
        for(const [k,asset] of Object.entries(pack)){
          const blob = new Blob([JSON.stringify(asset,null,2)],{type:'application/json'})
          const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`${n}-${k}.splat.json`; a.click()
        }
      })
    }
  }
  toggle(on){ const show = (on===undefined) ? (this.root.style.display==='none') : on; this.root.style.display = show? 'block':'none' }
  getElement(){ return this.root }
  flash(msg){ const n=document.createElement('div'); n.textContent=msg; n.className='small'; this.root.appendChild(n); setTimeout(()=>n.remove(), 2000) }
}

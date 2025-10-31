import { StructureBlueprints } from '../world/StructureBlueprints.js'
export class BlueprintUI{
  constructor(worldGen, worldState){
    this.worldGen=worldGen; this.worldState=worldState
    this.root=document.createElement('div'); this.root.className='panel'; this.root.style.bottom='12px'; this.root.style.left='calc(12px + 720px)'; this.root.style.maxHeight='36vh'; this.root.style.overflow='auto'
    const title = document.createElement('h3'); title.textContent='Blueprints'; this.root.appendChild(title)
    StructureBlueprints.list().forEach(bp=>{ const btn=document.createElement('button'); btn.className='btn'; btn.textContent=bp.name; btn.addEventListener('click',()=>StructureBlueprints.place(bp, this.worldGen, {x:0,y:20,z:0})); this.root.appendChild(btn) })
  }
  getElement(){ return this.root }
}

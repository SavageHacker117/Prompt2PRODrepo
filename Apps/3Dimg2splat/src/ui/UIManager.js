import { PaletteUI } from '../builder/PaletteUI.js'
import { BlueprintUI } from '../builder/BlueprintUI.js'
import { MiniMap } from '../builder/MiniMap.js'
import { MainMenu } from './MainMenu.js'
import { NotificationBar } from './NotificationBar.js'

export class UIManager{
  constructor({ worldGen, materials, builder, cameraController, minimap, worldState }){
    this.worldGen=worldGen; this.materials=materials; this.builder=builder; this.cameraController=cameraController; this.minimap=minimap; this.worldState=worldState
    const overlay = document.getElementById('overlay-ui')
    this.palette = new PaletteUI(materials, worldState); overlay.appendChild(this.palette.getElement())
    this.blueprints = new BlueprintUI(worldGen, worldState); overlay.appendChild(this.blueprints.getElement())
    const mini = document.createElement('div'); mini.id='minimap'; mini.className='panel'; mini.appendChild(minimap.getElement()); overlay.appendChild(mini)
    this.toolbar=document.createElement('div'); this.toolbar.id='toolbar'; this.toolbar.className='panel'
    this.toolbar.innerHTML=`
      <button class="btn" id="mode1">Orbit</button>
      <button class="btn" id="mode2">First-person</button>
      <button class="btn" id="mode3">Fly</button>
      <button class="btn" id="undoBtn">Undo (Z)</button>
      <button class="btn" id="redoBtn">Redo (Y)</button>
      <button class="btn" id="saveBtn">Save</button>
      <button class="btn" id="loadBtn">Load</button>
      <button class="btn" id="exportBtn">Export JSON</button>
      <button class="btn" id="menuBtn">Menu</button>`
    overlay.appendChild(this.toolbar)
    this.mainmenu = new MainMenu(worldGen, worldState); overlay.appendChild(this.mainmenu.getElement())
    this.notif = new NotificationBar(); overlay.appendChild(this.notif.getElement())
    this.toolbar.querySelector('#mode1').onclick = ()=> cameraController.setMode('orbit')
    this.toolbar.querySelector('#mode2').onclick = ()=> cameraController.setMode('fps')
    this.toolbar.querySelector('#mode3').onclick = ()=> cameraController.setMode('fly')
    this.toolbar.querySelector('#undoBtn').onclick = ()=> worldState.undo()
    this.toolbar.querySelector('#redoBtn').onclick = ()=> worldState.redo()
    this.toolbar.querySelector('#saveBtn').onclick = ()=> this._save()
    this.toolbar.querySelector('#loadBtn').onclick = ()=> this._load()
    this.toolbar.querySelector('#exportBtn').onclick = ()=> this._export()
    this.toolbar.querySelector('#menuBtn').onclick = ()=> this.mainmenu.toggle()
  }
  _save(){ const json=this.worldState.serialize(this.worldGen); localStorage.setItem('splats-save', json); this.notif.show('World saved') }
  _load(){ const json=localStorage.getItem('splats-save'); if(!json){ this.notif.show('No save'); return } this.worldState.load(this.worldGen, json); this.notif.show('World loaded') }
  _export(){ const json=this.worldState.serialize(this.worldGen); const blob=new Blob([json],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='splats-world.json'; a.click() }
}

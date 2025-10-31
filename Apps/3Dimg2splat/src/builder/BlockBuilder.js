import * as THREE from 'three'
export class BlockBuilder{
  constructor(scene, worldGen, materials, worldState, camera, renderer){
    this.scene=scene; this.worldGen=worldGen; this.materials=materials; this.worldState=worldState; this.camera=camera; this.renderer=renderer
    this.raycaster = new THREE.Raycaster(); this._setupEvents()
  }
  _setupEvents(){
    this.renderer.domElement.addEventListener('contextmenu', e=>e.preventDefault())
    this.renderer.domElement.addEventListener('mousedown', (e)=>{ if(e.button===0) this.tryPlace(); if(e.button===2) this.tryRemove() })
    window.addEventListener('keydown',(e)=>{ if(e.code==='KeyZ') this.worldState.undo(); if(e.code==='KeyY') this.worldState.redo() })
  }
  update(){}
  _cast(){ this.raycaster.setFromCamera({x:0,y:0}, this.camera); return this.worldGen.raycastBlock(this.raycaster) }
  tryPlace(){
    const hit = this._cast(); if(!hit) return
    const { wx, wy, wz } = hit; const placeAt = { x: wx, y: wy+1, z: wz }
    const mat = this.worldState.currentMaterial
    const doAction = ()=> this.worldGen.placeBlock(placeAt.x, placeAt.y, placeAt.z, mat)
    const undoAction = ()=> this.worldGen.removeBlock(placeAt.x, placeAt.y, placeAt.z)
    doAction(); this.worldState.pushAction({ undo:undoAction, redo:doAction })
  }
  tryRemove(){
    const hit = this._cast(); if(!hit) return
    const { wx, wy, wz, mat } = hit
    const doAction = ()=> this.worldGen.removeBlock(wx, wy, wz)
    const undoAction = ()=> this.worldGen.placeBlock(wx, wy, wz, mat)
    doAction(); this.worldState.pushAction({ undo:undoAction, redo:doAction })
  }
}

export class WorldState{
  constructor(){
    this.undoStack = []; this.redoStack = []; this.savedSlots = {}; this.currentMaterial = 'grass'
  }
  pushAction(act){ this.undoStack.push(act); this.redoStack.length = 0 }
  undo(){ const a = this.undoStack.pop(); if(!a) return; a.undo(); this.redoStack.push(a) }
  redo(){ const a = this.redoStack.pop(); if(!a) return; a.redo(); this.undoStack.push(a) }
  serialize(worldGen){ return JSON.stringify(worldGen.serialize()) }
  load(worldGen, json){ const data = JSON.parse(json); worldGen.deserialize(data) }
}

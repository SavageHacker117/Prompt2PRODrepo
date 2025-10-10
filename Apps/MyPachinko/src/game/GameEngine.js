
export class GameEngine {
  constructor({renderer, scene, camera}){
    this.renderer = renderer
    this.scene = scene
    this.camera = camera
    this.plugins = []
    this.currentScene = null
  }
  use(plugin){
    this.plugins.push(plugin)
    if (plugin.onAttach) plugin.onAttach(this)
  }
  setScene(scene){
    this.currentScene = scene
  }
  update(dt){
    for (const p of this.plugins) p.update && p.update(dt)
    if (this.currentScene) this.currentScene.update(dt)
  }
}

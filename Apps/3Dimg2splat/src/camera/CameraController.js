import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { FirstPersonControls } from 'three/examples/jsm/controls/FirstPersonControls.js'
import { FlyControls } from 'three/examples/jsm/controls/FlyControls.js'

export class CameraController{
  constructor(camera, dom){ this.camera=camera; this.dom=dom; this.controls=null; this.setMode('orbit') }
  setMode(mode){
    if(this.controls && this.controls.dispose) this.controls.dispose()
    this.mode=mode
    if(mode==='orbit'){ this.controls = new OrbitControls(this.camera, this.dom); this.controls.enableDamping = true }
    else if(mode==='fps'){ this.controls = new FirstPersonControls(this.camera, this.dom); this.controls.lookSpeed=0.1; this.controls.movementSpeed=20 }
    else if(mode==='fly'){ this.controls = new FlyControls(this.camera, this.dom); this.controls.movementSpeed=25; this.controls.rollSpeed=Math.PI/12; this.controls.dragToLook=true }
  }
  update(dt){ if(!this.controls) return; this.controls.update(dt) }
}

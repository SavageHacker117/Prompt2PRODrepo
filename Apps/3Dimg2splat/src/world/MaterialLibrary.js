import * as THREE from 'three'
import { renderSplatsToCanvas } from '../splats/SplatRender.js'
import { getMaterialSplats } from '../splats/SplatCatalog.js'

export class MaterialLibrary{
  constructor(renderer, opts={}){
    this.renderer = renderer
    this.opts = Object.assign({ useSplatTextures: false, splatQuality: 'medium' }, opts)
    this.textures = {}
    this.materials = this._build()
  }
  _mkStd({name='mat', color=0xffffff, metalness=0.1, roughness=0.8, transparent=false, opacity=1.0, emissive=0x000000, ior=1.45, transmission=0, alphaTest=0}){
    const m = new THREE.MeshPhysicalMaterial({ color, metalness, roughness, transparent, opacity, emissive, ior, transmission, alphaTest })
    m.vertexColors = false
    if(this.opts.useSplatTextures && transmission<=0){
      try{
        const pack = getMaterialSplats(name, color)
        const asset = pack[this.opts.splatQuality] || pack.medium
        const cvs = renderSplatsToCanvas(asset)
        const tex = new THREE.CanvasTexture(cvs)
        tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy?.() || 1
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping
        tex.needsUpdate = true
        m.map = tex
      }catch(e){ /* fallback keep flat */ }
    }
    return m
  }
  _build(){
    const mats = {}
    const list = [
      ['grass',      {name:'grass', color:0x3ca45c, roughness:0.95}],
      ['dirt',       {name:'dirt', color:0x7b5233, roughness:0.95}],
      ['sand',       {name:'sand', color:0xebd99d, roughness:1.0}],
      ['stone',      {name:'stone', color:0x8c8f91, roughness:0.9}],
      ['granite',    {name:'granite', color:0x8b7467, roughness:0.85}],
      ['clay',       {name:'clay', color:0xb07a6b, roughness:0.9}],
      ['snow',       {name:'snow', color:0xf2f7fb, roughness:0.7}],
      ['water',      {name:'water', color:0x4aa6e8, roughness:0.2, transmission:0.85, ior:1.33, metalness:0}],
      ['glass',      {name:'glass', color:0xaad2f5, roughness:0.05, transmission:0.95}],
      ['wood',       {name:'wood', color:0x9A6C3A, roughness:0.8}],
      ['oak',        {name:'oak', color:0x8c5a2b, roughness:0.85}],
      ['birch',      {name:'birch', color:0xc8b28a, roughness:0.85}],
      ['leaves',     {name:'leaves', color:0x2a8f4c, roughness:1.0, transmission:0.08, opacity:0.95, transparent:true}],
      ['brick',      {name:'brick', color:0xb34a3a, roughness:0.85}],
      ['cobble',     {name:'cobble', color:0x949494, roughness:0.95}],
      ['gravel',     {name:'gravel', color:0x707070, roughness:1.0}],
      ['marble',     {name:'marble', color:0xdedee5, roughness:0.4, metalness:0.0}],
      ['basalt',     {name:'basalt', color:0x303236, roughness:0.85}],
      ['slate',      {name:'slate', color:0x4e545c, roughness:0.8}],
      ['copper',     {name:'copper', color:0xb87333, metalness:1.0, roughness:0.35}],
      ['iron',       {name:'iron', color:0xaaaaaa, metalness:1.0, roughness:0.6}],
      ['gold',       {name:'gold', color:0xf0d264, metalness:1.0, roughness:0.3}],
      ['steel',      {name:'steel', color:0x8ca7b4, metalness:1.0, roughness:0.45}],
      ['concrete',   {name:'concrete', color:0xa9a9ab, roughness:1.0}],
      ['plaster',    {name:'plaster', color:0xe7e4db, roughness:0.9}],
      ['roof',       {name:'roof', color:0x6d2e2e, roughness:0.85}],
      ['tile',       {name:'tile', color:0xd7d2c8, roughness:0.6}],
      ['carpet',     {name:'carpet', color:0x804070, roughness:1.0}],
      ['light',      {name:'light', color:0xffffaa, roughness:0.2, emissive:0xffff99}],
      ['custom1',    {name:'custom1', color:0x00aaff, roughness:0.5}],
      ['custom2',    {name:'custom2', color:0xff00aa, roughness:0.5}],
      ['custom3',    {name:'custom3', color:0xaaff00, roughness:0.5}]
    ]
    for(const [k,opts] of list) mats[k] = this._mkStd(opts)
    return mats
  }
  names(){ return Object.keys(this.materials) }
  get(name){ return this.materials[name] }
}

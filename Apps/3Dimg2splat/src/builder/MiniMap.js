export class MiniMap{
  constructor(worldGen, worldState){ this.worldGen=worldGen; this.worldState=worldState; this.el=document.createElement('canvas'); this.el.width=200; this.el.height=200; this.ctx=this.el.getContext('2d') }
  getElement(){ return this.el }
  update(){
    const ctx=this.ctx, w=this.el.width, h=this.el.height
    const img = ctx.createImageData(w,h)
    for(let y=0;y<h;y++){
      for(let x=0;x<w;x++){
        const wx = (x-100)*1.2, wz = (y-100)*1.2
        const hh = Math.floor(this.worldGen.splatField.height(wx, wz))
        const idx=(y*w+x)*4; const c = hh<12?0x345a8c : hh>28?0xf2f7fb : 0x3ca45c
        img.data[idx]=(c>>16)&255; img.data[idx+1]=(c>>8)&255; img.data[idx+2]=c&255; img.data[idx+3]=255
      }
    }
    ctx.putImageData(img,0,0)
  }
}

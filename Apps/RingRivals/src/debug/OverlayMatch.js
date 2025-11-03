// src/debug/OverlayMatch.js
import * as THREE from 'three';

export class OverlayMatch {
  constructor({ camera }){
    this.camera = camera;
    this.canvas = document.createElement('canvas');
    this.canvas.width = innerWidth; this.canvas.height = innerHeight;
    Object.assign(this.canvas.style, {
      position:'absolute', left:0, top:0, width:'100vw', height:'100vh', pointerEvents:'none', zIndex:26
    });
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    addEventListener('resize', ()=>{
      this.canvas.width = innerWidth; this.canvas.height = innerHeight;
    });
    this.enabled = true; // toggle from console if you want
  }

  _toScreen(v3){
    const v = v3.clone().project(this.camera);
    return { x: (v.x * .5 + .5) * this.canvas.width, y: (-v.y * .5 + .5) * this.canvas.height };
  }

  update(debug, camera=this.camera){
    if(!this.enabled || !debug) return;
    this.camera = camera;

    const ctx = this.ctx;
    ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
    ctx.lineWidth = 2;

    const drawPoint = (p, color='#7ef')=>{
      const s=this._toScreen(p); ctx.beginPath(); ctx.strokeStyle=color; ctx.fillStyle=color;
      ctx.arc(s.x,s.y,5,0,Math.PI*2); ctx.fill();
    }
    const drawLink = (a,b,color='#6cf')=>{
      const A=this._toScreen(a), B=this._toScreen(b);
      ctx.beginPath(); ctx.strokeStyle=color; ctx.moveTo(A.x,A.y); ctx.lineTo(B.x,B.y); ctx.stroke();
    }

    // player fists vs cpu chest
    drawPoint(debug.pChest, '#66f');
    drawPoint(debug.oChest, '#f66');

    drawPoint(debug.pL, '#9cf'); drawPoint(debug.pR, '#9cf');
    drawPoint(debug.oL, '#faa'); drawPoint(debug.oR, '#faa');

    drawLink(debug.pL, debug.oChest);
    drawLink(debug.pR, debug.oChest);
    drawLink(debug.oL, debug.pChest, '#f88');
    drawLink(debug.oR, debug.pChest, '#f88');

    // show thresholds
    const center = this._toScreen(debug.mid);
    ctx.beginPath(); ctx.strokeStyle='rgba(255,255,255,.25)';
    ctx.arc(center.x, center.y, (debug.RANGE/9)*this.canvas.height*0.12, 0, Math.PI*2); ctx.stroke();

    // info
    ctx.fillStyle='#eef'; ctx.font='12px ui-monospace,monospace';
    ctx.fillText(`pL→cpu ${debug.d_pL.toFixed(2)}  pR→cpu ${debug.d_pR.toFixed(2)}  RANGE=${debug.RANGE.toFixed(2)} MAG=${debug.MAGNET.toFixed(2)}`, 16, 20);
  }
}

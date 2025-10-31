export const StructureBlueprints = {
  list(){ return [House(), Tower(), Tree()] },
  place(bp, worldGen, at){ for(const b of bp.blocks){ const wx=at.x+b[0], wy=at.y+b[1], wz=at.z+b[2]; worldGen.placeBlock(wx, wy, wz, b[3]) } }
}
function House(){ const blocks=[]; const W=7,H=5,D=7
  for(let x=0;x<W;x++)for(let z=0;z<D;z++){ blocks.push([x,0,z,'cobble']) }
  for(let y=1;y<H;y++){ for(let x=0;x<W;x++){ for(let z=0;z<D;z++){ const edge=(x===0||z===0||x===W-1||z===D-1); if(edge) blocks.push([x,y,z,'oak']) } } }
  for(let x=-1;x<=W;x++)for(let z=-1;z<=D;z++){ blocks.push([x,H,z,'roof']) }
  blocks.push([Math.floor(W/2),1,0,'glass']); blocks.push([Math.floor(W/2),2,0,'glass']); blocks.push([Math.floor(W/2)-1,2,0,'glass']); blocks.push([Math.floor(W/2)+1,2,0,'glass'])
  return { name:'Small House', blocks }
}
function Tower(){ const blocks=[]; const R=3,H=12
  for(let y=0;y<=H;y++){ for(let x=-R;x<=R;x++){ for(let z=-R;z<=R;z++){ if(x*x+z*z<=R*R){ blocks.push([x,y,z, y===H?'roof':'stone']) } } } }
  return { name:'Round Tower', blocks }
}
function Tree(){ const blocks=[]; const H=6; for(let y=0;y<H;y++) blocks.push([0,y,0,'wood'])
  for(let x=-2;x<=2;x++)for(let y=H-1;y<=H+2;y++)for(let z=-2;z<=2;z++){ if(Math.abs(x)+Math.abs(y-(H+1))+Math.abs(z)<=4) blocks.push([x,y,z,'leaves']) }
  return { name:'Tree', blocks }
}

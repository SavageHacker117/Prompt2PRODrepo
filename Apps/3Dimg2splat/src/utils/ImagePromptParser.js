export async function promptToSeed(prompt){
  if(!prompt) return 1337
  let h = 2166136261 >>> 0
  for (let i=0;i<prompt.length;i++){ h ^= prompt.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}
export async function imageToSeedAndFeatures(file){
  const img = await fileToImage(file)
  const {avg, lumMap} = imageStats(img)
  const seed = ((avg.r*73856093) ^ (avg.g*19349663) ^ (avg.b*83492791) ^ (img.width<<12) ^ img.height) >>> 0
  return { seed, avgColor: avg, lumMap, width: img.width, height: img.height }
}
function fileToImage(file){
  return new Promise((resolve,reject)=>{
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = ()=> resolve(img)
    img.onerror = reject
    img.src = url
  })
}
function imageStats(img){
  const cvs = document.createElement('canvas')
  cvs.width = img.width; cvs.height = img.height
  const ctx = cvs.getContext('2d')
  ctx.drawImage(img,0,0)
  const {data} = ctx.getImageData(0,0,img.width,img.height)
  let r=0,g=0,b=0
  const lumMap = new Float32Array(img.width*img.height)
  for(let i=0;i<data.length;i+=4){
    r += data[i]; g += data[i+1]; b += data[i+2]
    const rr=data[i]/255, gg=data[i+1]/255, bb=data[i+2]/255
    lumMap[i>>2] = 0.299*rr + 0.587*gg + 0.114*bb
  }
  const n = data.length/4
  return { avg:{r:Math.round(r/n), g:Math.round(g/n), b:Math.round(b/n)}, lumMap }
}

import { lerp, clamp } from '../utils/SeedUtils.js'
export function makeNoise2D(rand){
  const perm = new Uint8Array(512)
  for(let i=0;i<256;i++) perm[i] = i
  for(let i=255;i>0;i--){ const j=(rand()*i)|0; const t=perm[i]; perm[i]=perm[j]; perm[j]=t }
  for(let i=0;i<256;i++) perm[256+i]=perm[i]
  function grad(hash, x, y){ switch(hash & 3){ case 0: return x+y; case 1: return -x+y; case 2: return x-y; default: return -x-y } }
  function fade(t){ return t*t*t*(t*(t*6-15)+10) }
  return function(x, y){
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255
    x -= Math.floor(x); y -= Math.floor(y)
    const u=fade(x), v=fade(y)
    const A = perm[X] + Y, B = perm[X+1] + Y
    const res = lerp(lerp(grad(perm[A], x, y), grad(perm[B], x-1, y), u),
                     lerp(grad(perm[A+1], x, y-1), grad(perm[B+1], x-1, y-1), u), v)
    return (res+1)/2
  }
}
export function fbm(noise, x, y, oct=4, lac=2, gain=0.5){
  let amp=1, freq=1, sum=0, norm=0
  for(let i=0;i<oct;i++){ sum += amp * noise(x*freq, y*freq); norm += amp; amp*=gain; freq*=lac }
  return sum / norm
}
export function slope(heightAt, x, y){
  const h = heightAt(x,y)
  const dx = Math.abs(heightAt(x+1,y) - h)
  const dy = Math.abs(heightAt(x,y+1) - h)
  return Math.max(dx,dy)
}

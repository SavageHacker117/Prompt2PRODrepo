export function mulberry32(seed){
  return function(){
    let t = seed += 0x6D2B79F5
    t = Math.imul(t ^ t >>> 15, t | 1)
    t ^= t + Math.imul(t ^ t >>> 7, t | 61)
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}
export function hashString(str){
  let h = 2166136261 >>> 0
  for (let i=0;i<str.length;i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}
export function lerp(a,b,t){ return a + (b-a)*t }
export function clamp(v, a, b){ return Math.max(a, Math.min(b, v)) }

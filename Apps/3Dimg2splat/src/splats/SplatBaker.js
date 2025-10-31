// Dev-only GLB→splat JSON baker.
// Produces { points:[{p:[x,y,z], c:[r,g,b], r:radius}], meta:{source, samples, radius} }
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

function sampleTriangle(a,b,c){
  // barycentric random, concentrated toward interior
  const r1 = Math.random(); const r2 = Math.random();
  const sqrt = Math.sqrt(r1);
  const u = 1 - sqrt;
  const v = r2 * sqrt;
  const w = 1 - u - v;
  return new THREE.Vector3().addScaledVector(a,u).addScaledVector(b,v).addScaledVector(c,w);
}

function colorFromMaterial(mat){
  if (mat && mat.color) return [mat.color.r, mat.color.g, mat.color.b];
  return [0.8,0.8,0.8];
}

export async function bakeGLBToSplatsJSON(url, { samplesPerTri=4, radius=0.01 } = {}){
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(url);
  const meshes = [];
  gltf.scene.traverse(o=>{ if(o.isMesh) meshes.push(o); });

  const points = [];
  const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3();

  for (const m of meshes){
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    g.applyMatrix4(m.matrixWorld);
    const pos = g.attributes.position;
    const triCount = pos.count/3|0;
    const col = colorFromMaterial(m.material);
    for (let i=0;i<triCount;i++){
      vA.fromBufferAttribute(pos, i*3+0);
      vB.fromBufferAttribute(pos, i*3+1);
      vC.fromBufferAttribute(pos, i*3+2);
      for (let s=0;s<samplesPerTri;s++){
        const p = sampleTriangle(vA,vB,vC);
        points.push({ p:[p.x,p.y,p.z], c:col, r:radius });
      }
    }
  }

  // Build three LOD tiers by random down-sampling; keep deterministic using seed from length
  const rng = (seed=>()=> (seed = (seed*1664525+1013904223)>>>0) / 4294967296)(points.length);
  const lodHigh = points;
  const lodMed  = points.filter(()=> rng() < 0.45);
  const lodLow  = points.filter(()=> rng() < 0.18);

  return {
    meta: { source:url, samplesPerTri, radius, generated: Date.now() },
    points: lodHigh,
    lod: { med: lodMed, low: lodLow }
  };
}

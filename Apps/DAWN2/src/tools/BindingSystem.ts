// Simple in-scene relationship registry with (de)serialization
import * as THREE from 'three'

export type BindTarget = { nodeId: string, bone?: string }; // bone optional
export type Binding = {
  id: string;               // unique binding id
  parent: BindTarget;       // parent node (+ optional bone)
  child: BindTarget;        // child node
  keepWorld?: boolean;      // keep world-space transform when binding
  offset?: { position: [number,number,number], rotationEuler: [number,number,number], scale?: [number,number,number] };
};

const registry = new Map<string, Binding>();

export function addBinding(b: Binding){ registry.set(b.id, b); applyBinding(b); }
export function removeBinding(id: string){ const b = registry.get(id); if(!b) return; unapplyBinding(b); registry.delete(id); }
export function listBindings(){ return Array.from(registry.values()); }

export function serialize(){ return JSON.stringify(listBindings()); }
export function hydrate(raw: string){ try{ (JSON.parse(raw) as Binding[]).forEach(addBinding); }catch{} }

// Fallback lookup if engine.getObject() is not provided
function findByUUID(scene: THREE.Scene, uuid: string): THREE.Object3D | null {
  let found: THREE.Object3D | null = null
  scene.traverse((o:any)=>{ if(o.uuid===uuid) found=o })
  return found
}

const getObjectByNodeId = (id:string): THREE.Object3D | null => {
  const eng = (window as any).__engine
  if (eng?.getObject) return eng.getObject(id) || null
  const scene: THREE.Scene | undefined = (window as any).__scene || eng?.scene
  if (!scene) return null
  return findByUUID(scene, id)
}

const getBone = (obj: THREE.Object3D, name?: string): THREE.Object3D | null => {
  if(!name) return null;
  let found: THREE.Object3D | null = null;
  obj.traverse((o:any)=>{ if(o.isBone && o.name===name) found=o; });
  return found;
};

export function applyBinding(b: Binding){
  const parentObj = getObjectByNodeId(b.parent.nodeId);
  const childObj  = getObjectByNodeId(b.child.nodeId);
  if(!parentObj || !childObj) return;

  const anchor = b.parent.bone ? (getBone(parentObj, b.parent.bone) || parentObj) : parentObj;

  if(b.keepWorld) anchor.attach(childObj); else anchor.add(childObj);

  if(b.offset){
    const [px,py,pz] = b.offset.position;
    const [rx,ry,rz] = b.offset.rotationEuler;
    childObj.position.set(px,py,pz);
    childObj.rotation.set(rx,ry,rz);
    if(b.offset.scale){
      const [sx,sy,sz] = b.offset.scale; childObj.scale.set(sx,sy,sz);
    }
  }
}

export function unapplyBinding(b: Binding){
  const childObj  = getObjectByNodeId(b.child.nodeId);
  const scene = (window as any).__engine?.scene as THREE.Scene | undefined;
  if(childObj && scene) scene.attach(childObj); // put back to scene, preserving world xform
}

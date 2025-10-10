// Convenience sprite factory for static images
import * as THREE from 'three';

export function makeSprite(url, {
  position = new THREE.Vector3(0,0,0),
  scale = 1.0,
  transparent = true,
  depthTest = false,
  renderOrder = 5
} = {}){
  const loader = new THREE.TextureLoader();
  const tx = loader.load(url);
  tx.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tx, transparent, depthTest });
  const spr = new THREE.Sprite(mat);
  spr.position.copy(position);
  spr.scale.setScalar(scale);
  spr.renderOrder = renderOrder;
  return spr;
}

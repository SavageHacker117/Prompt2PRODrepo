import * as THREE from 'three';

// Super simple plane for now – we’ll upgrade to proper clipmap LOD later.
export function createClipmapMesh(material: THREE.Material): THREE.Mesh {
  const size = 200;             // meters
  const segments = 128;         // tesselation
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
  const mesh = new THREE.Mesh(geometry, material);

  mesh.rotation.x = -Math.PI / 2; // lay flat on XZ
  mesh.name = 'ISS_Ocean_ClipmapMesh';

  return mesh;
}

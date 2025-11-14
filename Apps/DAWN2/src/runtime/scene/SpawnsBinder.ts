import * as THREE from 'three';
import { create, attachToObject, SpawnType } from './SpawnSystem';

function getEngine(): any {
  return (window as any).__engine || {};
}

export function initSpawnsBinder() {
  const eng = getEngine();
  if (!eng.spawns) return;

  // Click handler: decide what to do based on eng.spawns.ui.tool
  const onClick = (hit?: THREE.Object3D | null, point?: THREE.Vector3 | null) => {
    const ui = eng.spawns.ui;
    if (!ui || ui.tool === 'none') return;

    if (ui.tool === 'place') {
      const pos = (point && point.clone()) || new THREE.Vector3();
      pos.y = 0;
      const sp = create({
        type: ui.type as SpawnType,
        position: pos,
        templateUrl: ui.templateUrl,
        respawnDelay: ui.respawnDelay,
        maxAlive: ui.maxAlive,
      });
      ui.lastCreatedId = sp.id;
      ui.tool = 'none';
      return;
    }

    if (ui.tool === 'attach') {
      const lastId = ui.lastCreatedId;
      if (!lastId) {
        ui.tool = 'none';
        return;
      }
      attachToObject(lastId, hit || null);
      ui.tool = 'none';
      return;
    }
  };

  // Expose a hook the raycaster can call from your input system
  eng.spawns._handleEditorClick = onClick;
}

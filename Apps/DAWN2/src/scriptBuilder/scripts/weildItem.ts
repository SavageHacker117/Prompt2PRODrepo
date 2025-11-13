import { addBinding } from './BindingSystem';

export function bindWeaponToRightHand({
  actorNodeId, weaponNodeId,
  boneName = 'RightHand', // adapt to your rig naming
}: { actorNodeId: string; weaponNodeId: string; boneName?: string }){
  addBinding({
    id: `bind:${actorNodeId}->${weaponNodeId}`,
    parent: { nodeId: actorNodeId, bone: boneName },
    child:  { nodeId: weaponNodeId },
    keepWorld: true,
    offset: {
      position: [0.02, 0.0, 0.03],
      rotationEuler: [0, Math.PI/2, 0],
      scale: [1,1,1],
    },
  });
}

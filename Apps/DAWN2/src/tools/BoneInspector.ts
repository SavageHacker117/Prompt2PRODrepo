// BoneInspector.ts
import * as THREE from 'three';

export type ClipMap = Record<string, THREE.AnimationClip> & { idle?: THREE.AnimationClip };

/** Build a quick lookup: name -> bones[] (case-insensitive contains) */
export function analyzeSkeleton(root: THREE.Object3D) {
  const map = new Map<string, THREE.Bone[]>();
  root.traverse(o => {
    if ((o as any).isBone) {
      const key = o.name;
      const list = map.get(key) || [];
      list.push(o as THREE.Bone);
      map.set(key, list);
    }
  });
  // stash for grammars / diagnostics
  const engine = ((window as any).__engine ||= {});
  engine.boneMap = map;
  engine.skeleton = root;
  // console pretty
  if (typeof window !== 'undefined') {
    // no-op, but nice to see once:
    // eslint-disable-next-line no-console
    console.log(`[skeleton] bones=${Array.from(map.keys()).length}`);
  }
  return map;
}

export function attachSkeletonHelper(parent: THREE.Object3D, target: THREE.Object3D) {
  const helper = new (THREE as any).SkeletonHelper(target) as THREE.SkeletonHelper;
  helper.material.linewidth = 1;
  helper.frustumCulled = false;
  helper.visible = true;
  parent.add(helper);
  const engine = ((window as any).__engine ||= {});
  engine.skeletonHelper = helper; // make available to console grammar
  return helper;
}

/** Make it easy to grab clips by name and pick a reasonable idle if present */
export function mapClips(clips: THREE.AnimationClip[] = []): ClipMap {
  const out: ClipMap = {} as any;
  for (const c of clips) out[c.name] = c;
  // choose first that looks like idle
  const idle = clips.find(c => /idle|stand|default/i.test(c.name));
  if (idle) out.idle = idle;
  return out;
}

/** Small helper for “wave” intent – returns a likely hand/wrist bone name */
export function suggestBoneNameForWave(root: THREE.Object3D): string | null {
  const hits: string[] = [];
  root.traverse(o => {
    if ((o as any).isBone) {
      const n = o.name.toLowerCase();
      if (/hand|wrist/i.test(n)) hits.push(o.name);
    }
  });
  return hits.sort()[0] || null;
}

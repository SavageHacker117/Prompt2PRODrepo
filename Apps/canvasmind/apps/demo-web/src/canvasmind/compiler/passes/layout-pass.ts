import * as THREE from "three";

export type LayoutOptions = {
  radius?: number;
  jitter?: number;
};

export function layoutPass(group: THREE.Group, opts: LayoutOptions = {}) {
  const radius = opts.radius ?? 3;
  const jitter = opts.jitter ?? 1;

  group.children.forEach((child, i) => {
    const angle = (i / group.children.length) * Math.PI * 2;
    child.position.set(
      Math.cos(angle) * radius + (Math.random() - 0.5) * jitter,
      0,
      Math.sin(angle) * radius + (Math.random() - 0.5) * jitter
    );
  });
}

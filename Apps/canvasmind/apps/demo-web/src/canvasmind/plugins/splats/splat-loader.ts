import * as THREE from "three";
import { parseAsciiPLY } from "./ply-parse";
import { tryLoadGS, GSHandle } from "./webgsplat-adapter";

export type SplatAsset =
  | { kind: "gs"; lib: any; handle: GSHandle; url: string; estMB: number }
  | { kind: "points"; obj: THREE.Points; estMB: number };

export async function loadSplatAsset(url: string, renderer: THREE.WebGLRenderer): Promise<SplatAsset> {
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase() || "";

  // Prefer a GS lib for .splat (or even .ply if supported by the lib)
  const gs = await tryLoadGS();
  if (gs && (ext === "splat" || gs.canLoad?.(url))) {
    const handle = await gs.load(url);
    const estMB = Math.max(32, Math.round((gs.byteSize?.(handle) || 64_000_000) / (1024*1024)));
    return { kind: "gs", lib: gs, handle, url, estMB };
  }

  // Fallback: ASCII .ply → THREE.Points (fast path to make UI usable)
  if (ext === "ply") {
    const text = await (await fetch(url)).text();
    const { positions, colors } = parseAsciiPLY(text);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({ size: 0.02, sizeAttenuation: true, vertexColors: !!colors });
    if (colors) geo.setAttribute("color", new THREE.Uint8BufferAttribute(colors, 4, true));
    const points = new THREE.Points(geo, mat);
    points.name = "CM_SplatsFallback";
    points.frustumCulled = true;

    const estMB = Math.ceil((positions.byteLength + (colors?.byteLength || 0)) / (1024*1024));
    return { kind: "points", obj: points, estMB: Math.max(estMB, 8) };
  }

  throw new Error(`Unsupported splat format: ${ext}`);
}

export function disposeSplatAsset(asset: SplatAsset, scene?: THREE.Scene) {
  if (asset.kind === "gs") {
    try { asset.lib.dispose(asset.handle); } catch {}
  } else {
    scene?.remove(asset.obj);
    (asset.obj.geometry as any)?.dispose?.();
    (asset.obj.material as any)?.dispose?.();
  }
}

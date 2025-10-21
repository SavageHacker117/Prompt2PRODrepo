import * as THREE from "three";
import { SplatCloud } from "./splat-cloud";

export type ImageSplatOpts = {
  /** point size in world units */
  size?: number;
  /** final width (world units) of the reconstructed “billboard” */
  scale?: number;
  /** center position in world space */
  center?: [number, number, number];
  /** sample every N pixels for density control */
  sampleStep?: number;
  /** ignore pixels with alpha <= this */
  alphaThreshold?: number;
};

/** Turn an image/canvas into a colored point cloud on a flat plane. */
export function imageToSplatCloud(
  img: ImageBitmap | HTMLImageElement | HTMLCanvasElement,
  opts: ImageSplatOpts = {}
): SplatCloud {
  const {
    size = 0.02,
    scale = 2.0,
    center = [0, 1, 0],
    sampleStep = 2,
    alphaThreshold = 8
  } = opts;

  const w = (img as any).width;
  const h = (img as any).height;

  const cnv = document.createElement("canvas");
  cnv.width = w;
  cnv.height = h;
  const ctx = cnv.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img as any, 0, 0);
  const data = ctx.getImageData(0, 0, w, h).data;

  const pts: number[] = [];
  const colsRGBA: number[] = [];

  const aspect = w / h;
  const worldW = scale;
  const worldH = worldW / aspect;

  for (let py = 0; py < h; py += sampleStep) {
    for (let px = 0; px < w; px += sampleStep) {
      const idx = (py * w + px) * 4;
      const a = data[idx + 3];
      if (a <= alphaThreshold) continue;

      const r = data[idx],
        g = data[idx + 1],
        b = data[idx + 2];

      // map pixels to [-1,1] then into world width/height
      const nx = (px / (w - 1)) * 2 - 1;
      const ny = (py / (h - 1)) * 2 - 1;

      const X = center[0] + nx * (worldW / 2);
      const Y = center[1] - ny * (worldH / 2);
      const Z = center[2];

      pts.push(X, Y, Z);
      // SplatCloud supports Uint8 RGBA (normalized) when passing Uint8Array
      colsRGBA.push(r, g, b, a);
    }
  }

  const pos = new Float32Array(pts);
  const col = new Uint8Array(colsRGBA);

  const cloud = new SplatCloud(pos, { size, colors: col });
  cloud.name = "CM_ImageSplat";
  return cloud;
}

/** Grab the first video frame as a canvas (for MP4/WebM uploads). */
export async function canvasFromVideoFile(
  file: File
): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file);
  const v = document.createElement("video");
  v.src = url;
  v.muted = true;
  v.playsInline = true;
  v.preload = "auto";

  await new Promise<void>((res) =>
    v.addEventListener("loadeddata", () => res(), { once: true })
  );
  v.currentTime = 0;
  await new Promise<void>((res) =>
    v.addEventListener("seeked", () => res(), { once: true })
  );

  const c = document.createElement("canvas");
  c.width = v.videoWidth;
  c.height = v.videoHeight;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(v, 0, 0);
  URL.revokeObjectURL(url);
  return c;
}

/** Load a File (image or video) and return a SplatCloud. */
export async function imageFileToSplatCloud(
  file: File,
  opts: ImageSplatOpts = {}
): Promise<SplatCloud> {
  if (file.type.startsWith("video/")) {
    const canvas = await canvasFromVideoFile(file);
    return imageToSplatCloud(canvas, opts);
  }

  // image/*
  if ("createImageBitmap" in window) {
    const bmp = await (createImageBitmap as any)(file);
    return imageToSplatCloud(bmp, opts);
  } else {
    // Safari / fallback path
    const url = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    URL.revokeObjectURL(url);
    return imageToSplatCloud(img, opts);
  }
}

/** Back-compat alias so existing imports keep working. */
export async function videoFileToSplatCloud(
  file: File,
  opts: ImageSplatOpts = {}
) {
  return imageFileToSplatCloud(file, opts);
}

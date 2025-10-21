import * as THREE from "three";
import { imageToSplatCloud, canvasFromVideoFile, type ImageSplatOpts } from "./image-to-splats";
import { SplatCloud } from "./splat-cloud";

export class ImageSplatSystem {
  public group = new THREE.Group();
  private items: SplatCloud[] = [];

  constructor(parent: THREE.Object3D) { parent.add(this.group); }

  async addFromFile(file: File, opts: ImageSplatOpts): Promise<SplatCloud | null> {
    try {
      if (file.type.startsWith("image/")) {
        const bmp = await createImageBitmap(file);
        const cloud = imageToSplatCloud(bmp, opts);
        this.group.add(cloud); this.items.push(cloud);
        return cloud;
      }
      if (file.type === "video/mp4") {
        const canvas = await canvasFromVideoFile(file);
        const cloud = imageToSplatCloud(canvas, opts);
        this.group.add(cloud); this.items.push(cloud);
        return cloud;
      }
      console.warn("Unsupported file type for splats:", file.type);
      return null;
    } catch (e) {
      console.error("ImageSplatSystem.addFromFile failed", e);
      return null;
    }
  }

  clear() {
    for (const c of this.items) { c.disposeAll(); }
    this.items.length = 0;
    this.group.clear();
  }
}

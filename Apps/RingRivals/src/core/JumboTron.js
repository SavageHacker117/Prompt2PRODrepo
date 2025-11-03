import * as THREE from 'three';

/**
 * Hanging 4-sided Jumbotron with angled screens.
 * Renders four mini-cameras to render targets each frame.
 * Usage:
 *   const j = new JumboTron({ scene, renderer });
 *   ...
 *   j.update(renderer, scene); // per-frame
 */
export class JumboTron {
  constructor({ scene, renderer, size=7, height=12.2, tiltDeg=18, radius=7.5 }){
    this.scene = scene;
    this.renderer = renderer;
    this.group = new THREE.Group();
    scene.add(this.group);

    // body
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(size*0.36, size*0.36, 1.2, 24),
      new THREE.MeshStandardMaterial({ color:0x1b1e27, metalness:.75, roughness:.35 })
    );
    body.position.y = height; body.castShadow = true; this.group.add(body);

    // top sponsor ring
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(size*0.46, 0.12, 12, 60),
      new THREE.MeshStandardMaterial({ color:0x222733, metalness:.85, roughness:.3 })
    );
    ring.position.y = height + 0.8; this.group.add(ring);

    // 4 screens
    this.targets = [];
    this.cams = [];
    const screenW = size*1.05, screenH = size*0.62;
    const tilt = THREE.MathUtils.degToRad(tiltDeg);

    for (let i=0;i<4;i++){
      const rt = new THREE.WebGLRenderTarget(768, 512, { samples: 2 });
      this.targets.push(rt);

      const scr = new THREE.Mesh(
        new THREE.PlaneGeometry(screenW, screenH),
        new THREE.MeshBasicMaterial({ map: rt.texture, toneMapped:false })
      );
      const ang = i * (Math.PI/2);
      scr.position.set(Math.cos(ang)* (size*0.01), height - 0.1, Math.sin(ang)*(size*0.01));
      scr.rotation.set(-tilt, ang, 0);
      // push outward a hair so the four sides don't z-fight the core cylinder
      scr.translateZ(size*0.52);
      this.group.add(scr);

      const cam = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
      cam.position.set(Math.cos(ang)*radius, 2.4, Math.sin(ang)*radius);
      cam.lookAt(0, 1.3, 0);
      this.cams.push(cam);
    }

    // lower the whole rig a bit (per your note)
    this.group.position.y = -0.8;
  }

  update(renderer, scene){
    // Hide the jumbo while capturing (avoid recursive screens)
    const wasVisible = this.group.visible;
    this.group.visible = false;

    const oldTarget = renderer.getRenderTarget();
    for (let i=0;i<4;i++){
      renderer.setRenderTarget(this.targets[i]);
      renderer.render(scene, this.cams[i]);
    }
    renderer.setRenderTarget(oldTarget);
    this.group.visible = wasVisible;
  }
}

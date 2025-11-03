import * as THREE from 'three';

function useIfNotTiny(tex) {
  if (!tex || !tex.image) return null;
  const w = tex.image.width || 0, h = tex.image.height || 0;
  return (w <= 1 && h <= 1) ? null : tex;
}

function octagonPoints(R){
  const a = Math.PI/4;
  const pts = [];
  for (let i=0;i<8;i++){
    const ang = i*a;
    pts.push(new THREE.Vector2(Math.cos(ang)*R, Math.sin(ang)*R));
  }
  return pts;
}

export class RingScene {
  constructor({ scene, renderer }) {
    this.scene = scene;
    this.renderer = renderer;
    this.group = new THREE.Group();
    scene.add(this.group);

    this.ropeMeshes = [];
    this.spotGroup = new THREE.Group();
    scene.add(this.spotGroup);
  }

  setArena(theme) {
    if (theme === 'stadium') {
      this.ambient.color.setHex(0x262a33);
      this.spotGroup.children.forEach(s => s.color.set(0xffffff));
      this._setMatColor(0x2b3355);
    } else if (theme === 'gym') {
      this.ambient.color.setHex(0x2a251f);
      this.spotGroup.children.forEach(s => s.color.set(0xffe4b3));
      this._setMatColor(0x3b2a22);
    } else if (theme === 'cyber') {
      this.ambient.color.setHex(0x12131a);
      this.spotGroup.children.forEach(s => s.color.set(0x62f0ff));
      this._setMatColor(0x101821);
    }
  }
  _setMatColor(hex){ const m=this.group.getObjectByName('RingMat'); if (m) m.material.color.setHex(hex); }

  build(theme='stadium') {
    // --- Lights ---
    this.ambient = new THREE.AmbientLight(0x2a2d37, 0.9); this.scene.add(this.ambient);
    this.hemi = new THREE.HemisphereLight(0x8fb6ff, 0x14161b, 0.45); this.scene.add(this.hemi);
    const key = new THREE.DirectionalLight(0xffffff, 1.15);
    key.position.set(0, 14, 6); key.castShadow = true; key.shadow.mapSize.set(1024,1024); this.scene.add(key);

    // --- Truss + spots around bowl ---
    const rigRadius = 22, ringSpots = 8;
    for (let i = 0; i < ringSpots; i++) {
      const ang = (i / ringSpots) * Math.PI * 2;
      const spot = new THREE.SpotLight(0xffffff, 1.8, 90, Math.PI/4, .35, 1.4);
      spot.position.set(Math.cos(ang) * rigRadius, 14.5, Math.sin(ang) * rigRadius);
      spot.target.position.set(0, 1.2, 0);
      spot.castShadow = true; spot.shadow.mapSize.set(1024,1024);
      this.scene.add(spot.target); this.spotGroup.add(spot);
    }
    const truss = new THREE.Mesh(
      new THREE.TorusGeometry(rigRadius, .18, 12, 72),
      new THREE.MeshStandardMaterial({ color:0x20232d, metalness:.85, roughness:.35 })
    );
    truss.position.y = 14.2; truss.castShadow = true; this.scene.add(truss);

    // --- Platform ---
    const platform = new THREE.Mesh(
      new THREE.BoxGeometry(16, 1.2, 16),
      new THREE.MeshStandardMaterial({ color: 0x171a26, metalness:.25, roughness:.85 })
    );
    platform.position.y = .6; platform.receiveShadow = platform.castShadow = true; this.group.add(platform);

    // --- Ring mat (show bullseye PNG) ---
    const loader = new THREE.TextureLoader();
    const matTexRaw = loader.load('/textures/mat_color.png');
    const normalRaw = loader.load('/textures/mat_normal.png');
    if (matTexRaw){ 
      matTexRaw.colorSpace = THREE.SRGBColorSpace; 
      matTexRaw.wrapS = matTexRaw.wrapT = THREE.RepeatWrapping; 
      matTexRaw.repeat.set(1,1); 
      matTexRaw.anisotropy = this.renderer?.capabilities?.getMaxAnisotropy?.() ?? 1; 
    }
    if (normalRaw){ normalRaw.wrapS = normalRaw.wrapT = THREE.RepeatWrapping; normalRaw.repeat.set(1,1); }

    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: useIfNotTiny(matTexRaw),
      normalMap: useIfNotTiny(normalRaw),
      roughness: 0.55, metalness: 0.15, clearcoat: 0.12, clearcoatRoughness: 0.35
    });
    const ringTop = new THREE.Mesh(new THREE.PlaneGeometry(12, 12, 1, 1), mat);
    ringTop.name = 'RingMat';
    ringTop.rotation.x = -Math.PI/2;
    ringTop.position.y = 1.21;
    ringTop.receiveShadow = true;
    this.group.add(ringTop);

    // --- Corners + pads ---
    const postGeom = new THREE.CylinderGeometry(.12, .12, 1.9, 12);
    const postMat  = new THREE.MeshStandardMaterial({ color: 0x9aa4b6, metalness:.7, roughness:.25 });
    const padGeom  = new THREE.BoxGeometry(.5,.4,.2);
    const padMat   = new THREE.MeshStandardMaterial({ color: 0x303950, roughness:.6 });
    const corners = [
      [ 5.8, 1.9/2 + 1.21,  5.8],
      [-5.8, 1.9/2 + 1.21,  5.8],
      [-5.8, 1.9/2 + 1.21, -5.8],
      [ 5.8, 1.9/2 + 1.21, -5.8],
    ];
    corners.forEach(([x,y,z]) => {
      const post = new THREE.Mesh(postGeom, postMat); post.position.set(x,y,z); post.castShadow = true; this.group.add(post);
      const pad = new THREE.Mesh(padGeom, padMat); pad.position.set(x*0.92, y+0.2, z*0.92); pad.castShadow = true; this.group.add(pad);
    });

    // --- Ropes ---
    this._buildRopes();

    // --- VIP rope barrier + standers ---
    this._buildVipBarrier();

    // --- Stadium bowl (30 octagon tiers) ---
    this._buildStadiumBowl(30);

    // --- Floor + dome ---
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(60, 72),
      new THREE.MeshStandardMaterial({ color: 0x0e1019, roughness:.95, metalness:.02 })
    );
    floor.rotation.x = -Math.PI/2; floor.receiveShadow = true; this.scene.add(floor);

    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(70, 48, 32, 0, Math.PI*2, 0, Math.PI/2),
      new THREE.MeshStandardMaterial({ color:0x0a0c12, metalness:.2, roughness:.95, side:THREE.BackSide })
    );
    dome.position.y = 24; this.scene.add(dome);

    // --- Red carpet tunnel from a "door" ---
    this._buildTunnel();

    this.setArena(theme);
  }

  _buildRopes() {
    const heights = [1.85, 1.55, 1.30];
    const texRaw = new THREE.TextureLoader().load('/textures/rope_diffuse.png');
    if (texRaw) { texRaw.colorSpace = THREE.SRGBColorSpace; texRaw.wrapS = texRaw.wrapT = THREE.RepeatWrapping; texRaw.repeat.set(8,1); }
    const tex = useIfNotTiny(texRaw);

    const ropeMat = new THREE.MeshStandardMaterial({
      map: tex, color: tex ? 0xffffff : 0xd43f3f, roughness:.5, metalness:.05
    });

    const pts = [
      new THREE.Vector3( 5.95, 0,  5.95),
      new THREE.Vector3(-5.95, 0,  5.95),
      new THREE.Vector3(-5.95, 0, -5.95),
      new THREE.Vector3( 5.95, 0, -5.95),
    ];

    const R = 0.05; const SAG = 0.02;
    this.ropeMeshes = [];
    heights.forEach(h=>{
      for (let i=0;i<4;i++) {
        const a = pts[i], b = pts[(i+1)%4];
        const midx = (a.x+b.x)/2, midz = (a.z+b.z)/2;
        const curve = new THREE.CubicBezierCurve3(
          new THREE.Vector3(a.x, h, a.z),
          new THREE.Vector3(midx, h-0.10, midz),
          new THREE.Vector3(midx, h-0.10, midz),
          new THREE.Vector3(b.x, h, b.z),
        );
        const tube = new THREE.TubeGeometry(curve, 64, R, 8, false);
        const mesh = new THREE.Mesh(tube, ropeMat);
        mesh.castShadow = true;
        this.group.add(mesh);
        this.ropeMeshes.push({ mesh, p1:a, p2:b, h, sag:SAG, R });
      }
    });
  }

  _buildVipBarrier(){
    const grp = new THREE.Group(); grp.position.y = 0.2; this.scene.add(grp);

    const Rinner = 9.7, Router = 10.7, postH = 1.0;
    const posts = 36;
    const postMat = new THREE.MeshStandardMaterial({ color:0x444a55, metalness:.7, roughness:.4 });

    for (let i=0;i<posts;i++){
      const ang = (i/posts)*Math.PI*2;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,postH,10), postMat);
      post.position.set(Math.cos(ang)*Rinner, postH/2, Math.sin(ang)*Rinner);
      grp.add(post);

      // standing-room people right behind
      const standee = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.18, 0.55, 6, 8),
        new THREE.MeshStandardMaterial({ color: (i%5===0?0x98761e:0x2f3645), metalness:.2, roughness:.6 })
      );
      standee.position.set(Math.cos(ang)*Router, 1.0, Math.sin(ang)*Router);
      grp.add(standee);
    }

    // rope between posts (simple torus ring)
    const rope = new THREE.Mesh(
      new THREE.TorusGeometry((Rinner), 0.025, 8, 200),
      new THREE.MeshStandardMaterial({ color:0xd4a24b, metalness:.8, roughness:.25 })
    );
    rope.position.y = 0.9; grp.add(rope);
  }

  _buildStadiumBowl(rows=30){
    // build stacked octagon rings
    const startR = 18, stepR = 1.25, stepY = 0.45;
    for (let i=0;i<rows;i++){
      const innerR = startR + i*stepR;
      const outerR = innerR + 1.1;
      const outer = new THREE.Shape(octagonPoints(outerR));
      const inner = new THREE.Path(octagonPoints(innerR));
      outer.holes.push(inner);

      const g = new THREE.ShapeGeometry(outer);
      const m = new THREE.MeshStandardMaterial({ color:0x222630, metalness:.05, roughness:.92, side:THREE.DoubleSide });
      const ring = new THREE.Mesh(g, m);
      ring.rotation.x = -Math.PI/2;
      ring.position.y = 0.2 + i*stepY;
      ring.receiveShadow = true;
      this.scene.add(ring);
    }
  }

  _buildTunnel(){
    // doorway arch
    const arch = new THREE.Mesh(
      new THREE.BoxGeometry(4, 4, 0.5),
      new THREE.MeshStandardMaterial({ color:0x1b1f2a, roughness:.7, metalness:.2 })
    );
    arch.position.set(0, 2, -34); this.scene.add(arch);

    // red carpet strip towards ring
    const carpet = new THREE.Mesh(
      new THREE.PlaneGeometry(3.5, 24),
      new THREE.MeshStandardMaterial({ color:0xaa1e2b, metalness:.3, roughness:.6 })
    );
    carpet.rotation.x = -Math.PI/2;
    carpet.position.set(0, 0.01, -22);
    this.scene.add(carpet);
  }

  update(dt) {
    const t = performance.now() * 0.001;
    for (const r of this.ropeMeshes) {
      const sag = Math.sin(t*1.2 + r.h*7.0) * r.sag;
      const midx = (r.p1.x + r.p2.x)/2, midz = (r.p1.z + r.p2.z)/2;
      const curve = new THREE.CubicBezierCurve3(
        new THREE.Vector3(r.p1.x, r.h, r.p1.z),
        new THREE.Vector3(midx, r.h-0.10 - sag, midz),
        new THREE.Vector3(midx, r.h-0.10 - sag, midz),
        new THREE.Vector3(r.p2.x, r.h, r.p2.z),
      );
      r.mesh.geometry.dispose();
      r.mesh.geometry = new THREE.TubeGeometry(curve, 64, r.R, 8, false);
    }
  }
}

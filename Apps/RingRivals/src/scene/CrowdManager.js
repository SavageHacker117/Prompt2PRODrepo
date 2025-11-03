import * as THREE from 'three';

const rand = (a,b)=> a + Math.random()*(b-a);
const useIfNotTiny = (t)=> (t && t.image && (t.image.width>1 || t.image.height>1)) ? t : null;

export class CrowdManager {
  constructor({ scene, camera }) {
    this.scene = scene; this.camera = camera;

    this.group = new THREE.Group();
    scene.add(this.group);

    this.seats  = new THREE.Group(); this.group.add(this.seats);
    this.risers = new THREE.Group(); this.group.add(this.risers);

    this.instances = [];     // instanced spectators (close & mid)
    this.boards = [];        // billboard spectators (far)
    this._intensity = 0;
  }

  spawnLayers() {
    const ringR = 16;

    // ---------- stepped stands (28 rows) ----------
    const ROWS = 28;
    const stepR = 0.95;       // horizontal step per row
    const stepY = 0.12;       // height step per row (very visible)
    const startR = ringR + 3;

    for (let i=0;i<ROWS;i++){
      const rIn  = startR + i*stepR;
      const rOut = rIn + 0.85;
      const y    = 0.3 + i*stepY;

      const step = new THREE.Mesh(
        new THREE.RingGeometry(rIn, rOut, Math.max(32, Math.floor(8*rOut))),
        new THREE.MeshStandardMaterial({ color:0x242a36, roughness:.94, metalness:.05, side:THREE.DoubleSide })
      );
      step.rotation.x = -Math.PI/2;
      step.position.y = y;
      step.receiveShadow = true;
      this.risers.add(step);
    }

    // ---------- a couple of “seat fabric” rings near the front ----------
    const seatTexRaw = new THREE.TextureLoader().load('/textures/seat_diffuse.png');
    if (seatTexRaw) seatTexRaw.colorSpace = THREE.SRGBColorSpace;
    const seatTex = useIfNotTiny(seatTexRaw);

    for (let j=0; j<2; j++){
      const r = startR + j*3.2;
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(r-0.6, r+0.6, Math.max(32, Math.floor(8*r))),
        new THREE.MeshStandardMaterial({ map: seatTex||null, color: seatTex?0xffffff:0x303645, metalness:.02, roughness:.92, side:THREE.DoubleSide })
      );
      ring.rotation.x = -Math.PI/2;
      ring.position.y = 0.3 + j*0.2;
      ring.receiveShadow = true;
      this.seats.add(ring);
    }

    // ---------- spectators (instanced capsules) ----------
    // One mesh, many rows: vary radius & height per instance so they sit ON the risers.
    const body = new THREE.CapsuleGeometry(0.13, 0.25, 6, 8);
    const instMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness:.7, metalness:0 });
    // budget plenty, we’ll set .count to the filled amount
    const CAP = 1400;
    const inst = new THREE.InstancedMesh(body, instMat, CAP);
    inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    inst.castShadow = true;
    this.group.add(inst);
    this.instances.push(inst);

    const colors = [0xffd166, 0x06d6a0, 0x118ab2, 0xef476f, 0xa28cff, 0xffffff];

    let idx = 0;
    const tmp = new THREE.Object3D();

    for (let row=0; row<ROWS; row++){
      const rowR = startR + row*stepR + 0.25;
      const rowY = 0.3 + row*stepY + 0.02;

      // density scales with circumference but keep perf sane
      const perRow = Math.floor( (Math.PI * 2 * rowR) / 1.6 );
      for (let i=0;i<perRow && idx<CAP;i++){
        // leave small aisles every ~18 seats
        if (i % 18 === 0) continue;

        const ang = (i/perRow) * Math.PI*2 + rand(-0.02,0.02);
        tmp.position.set(Math.cos(ang)*rowR, rowY, Math.sin(ang)*rowR);
        tmp.rotation.set(0, Math.atan2(tmp.position.x, tmp.position.z), 0);
        tmp.scale.setScalar(rand(0.9, 1.15));
        tmp.updateMatrix();
        inst.setMatrixAt(idx, tmp.matrix);
        inst.setColorAt?.(idx, new THREE.Color(colors[(Math.random()*colors.length)|0]));
        idx++;
      }
    }
    inst.count = idx;

    // ---------- far billboards in 2 rings ----------
    const boardGeom = new THREE.PlaneGeometry(0.7, 1.0);
    const boardMat  = new THREE.MeshBasicMaterial({ color:0xdddddd, side:THREE.DoubleSide, transparent:true, opacity:0.85 });
    const boardCount = 420;
    const boards = new THREE.InstancedMesh(boardGeom, boardMat, boardCount);
    boards.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(boards);
    this.boards.push(boards);

    for (let j=0; j<boardCount; j++){
      const ringIndex = (j < boardCount/2) ? 0 : 1;
      const baseR = startR + 16 + ringIndex * 2.5;
      const ang = Math.random()*Math.PI*2;
      const y = 1.8 + ringIndex*0.6 + Math.random()*1.6;
      tmp.position.set(Math.cos(ang)*baseR, y, Math.sin(ang)*baseR);
      tmp.lookAt(0, y, 0);
      tmp.updateMatrix();
      boards.setMatrixAt(j, tmp.matrix);
    }
  }

  update(dt, intensity=0) {
    this._intensity = intensity;
    const t = performance.now()*0.001;

    // gentle shimmy & little waves
    const tmp = new THREE.Object3D();
    for (const inst of this.instances) {
      for (let i=0; i<inst.count; i++) {
        inst.getMatrixAt(i, tmp.matrix);
        tmp.position.setFromMatrixPosition(tmp.matrix);
        const faceY = Math.atan2(tmp.position.x, tmp.position.z);
        tmp.rotation.set(0, faceY, 0);
        tmp.position.y += (0.02 + 0.08*this._intensity) * Math.sin(t*4 + i*0.2);
        tmp.updateMatrix();
        inst.setMatrixAt(i, tmp.matrix);
      }
      inst.instanceMatrix.needsUpdate = true;
    }

    // billboards keep looking at the camera
    for (const boards of this.boards) {
      for (let i=0; i<boards.count; i++) {
        boards.getMatrixAt(i, tmp.matrix);
        tmp.position.setFromMatrixPosition(tmp.matrix);
        tmp.lookAt(this.camera.position);
        tmp.updateMatrix();
        boards.setMatrixAt(i, tmp.matrix);
      }
      boards.instanceMatrix.needsUpdate = true;
    }
  }
}

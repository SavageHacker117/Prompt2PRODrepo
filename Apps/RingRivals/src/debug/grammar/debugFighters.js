// Utilities for fighter debugging (separate, faceOff, swapSides)
export class FDebug {
  constructor({ player, cpu }) { this.player = player; this.cpu = cpu; }

  separateOnce(min = 1.25) {
    const a = this.player.root.position, b = this.cpu.root.position;
    const dx = a.x - b.x, dz = a.z - b.z;
    const d  = Math.hypot(dx, dz) || 1e-5;
    if (d < min) {
      const nx = dx / d, nz = dz / d, push = (min - d) * 0.5;
      a.x += nx * push; a.z += nz * push;
      b.x -= nx * push; b.z -= nz * push;
    }
  }

  faceOff() {
    this.player.root.lookAt(this.cpu.root.position.x, this.player.root.position.y, this.cpu.root.position.z);
    this.cpu.root.lookAt(this.player.root.position.x, this.cpu.root.position.y, this.player.root.position.z);
  }

  swapSides() {
    const a = this.player.root.position.clone();
    this.player.root.position.copy(this.cpu.root.position);
    this.cpu.root.position.copy(a);
    this.faceOff();
  }
}

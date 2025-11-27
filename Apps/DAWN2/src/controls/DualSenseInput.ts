// Maps DualSense (PS5) to movement/look/aim/fire/reload and publishes callbacks
export type InputHandlers = {
  move?: (x: number, z: number, run: boolean) => void;
  look?: (dx: number, dy: number) => void;
  aim?:  (on: boolean) => void;
  fire?: () => void;
  reload?: () => void;
};

export class DualSenseInput {
  private idx = 0;
  handlers: InputHandlers = {};

  constructor() {
    window.addEventListener('gamepadconnected', (e: GamepadEvent) => {
      this.idx = e.gamepad.index;
    });
  }

  update() {
    const gp = navigator.getGamepads?.()[this.idx];
    if (!gp) return;

    const axLX = gp.axes[0] || 0;  // left stick X
    const axLY = gp.axes[1] || 0;  // left stick Y
    const axRX = gp.axes[2] || 0;  // right stick X
    const axRY = gp.axes[3] || 0;  // right stick Y

    const dead = (v:number)=> Math.abs(v) < 0.15 ? 0 : v;
    const moveX = dead(axLX);
    const moveZ = -dead(axLY);
    const lookX = dead(axRX);
    const lookY = dead(axRY);

    const btn = (i:number)=> !!gp.buttons[i]?.pressed;
    const run = btn(10) /*R3*/ || btn(5) /*R2*/;
    const aim = btn(6) /*L2*/;
    const firePressed = btn(7);    // R2
    const reloadPressed = btn(3);  // Triangle/Y

    this.handlers.move?.(moveX, moveZ, run);
    this.handlers.look?.(lookX, lookY);
    this.handlers.aim?.(aim);
    if (firePressed) this.handlers.fire?.();
    if (reloadPressed) this.handlers.reload?.();
  }
}

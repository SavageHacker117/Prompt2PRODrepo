// src/controls/GamepadInput.js
export class GamepadInput {
  constructor(){ this.activeIndex = 0; }
  update(){
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = pads[this.activeIndex] || null;
    return gp ? {
      axes: gp.axes.slice(0),
      buttons: gp.buttons.map(b => ({ pressed: b.pressed, value: b.value }))
    } : { axes: [], buttons: [] };
  }
  info(){
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = pads[this.activeIndex] || null;
    return { connected: !!gp, id: gp ? gp.id : 'none' };
  }
}

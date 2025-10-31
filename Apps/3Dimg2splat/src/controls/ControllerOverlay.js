// src/controls/ControllerOverlay.js
export class ControllerOverlay {
  constructor({ imageUrl = '/ui/xbox_controller.png', input } = {}) {
    this.input = input; this.visible = false;

    const root = document.createElement('div'); root.id = 'controller-overlay';
    Object.assign(root.style, {
      position: 'fixed', left: '50%', bottom: '24px', transform: 'translateX(-50%)',
      pointerEvents: 'none', zIndex: 10000, display: 'none'
    });

    const img = new Image(); img.src = imageUrl; img.style.maxWidth = '520px'; img.style.opacity = '0.9';
    const led = document.createElement('div');
    Object.assign(led.style, {
      position: 'absolute', right: '24px', top: '24px', width: '12px', height: '12px',
      borderRadius: '50%', background: '#444', boxShadow: '0 0 8px rgba(0,0,0,.6)'
    });
    const label = document.createElement('div');
    Object.assign(label.style, {
      position: 'absolute', left: '12px', bottom: '-18px',
      color: '#9ecfff', font: '11px/1.2 monospace', textShadow: '0 1px 2px #000'
    });

    root.appendChild(img); root.appendChild(led); root.appendChild(label);
    document.body.appendChild(root);
    this.root = root; this.led = led; this.label = label;
  }
  toggle(){ this.visible = !this.visible; this.root.style.display = this.visible ? 'block' : 'none'; }
  setGamepadInfo(info){
    this.led.style.background = info?.connected ? '#1eff6a' : '#444';
    this.label.textContent = info?.connected ? info.id : 'No gamepad';
  }
}

export class WorldPanel {
  constructor({ worldGen }) {
    this.worldGen = worldGen;
    const p = worldGen.params || (worldGen.params = { seaLevel: 8, heightOffset: 0 });

    const root = document.createElement('div');
    root.id = 'world-panel';
    root.className = 'panel';
    root.style.right = '12px';
    root.style.minWidth = '240px';
    root.innerHTML = `
      <h3>World Controls</h3>
      <label>Sea level <span id="seaVal"></span></label>
      <input id="sea" class="input" type="range" min="0" max="40" step="1" value="${Number(p.seaLevel) || 0}">
      <label>Height offset <span id="hoffVal"></span></label>
      <input id="hoff" class="input" type="range" min="-8" max="24" step="1" value="${Number(p.heightOffset) || 0}">
      <div class="row small" style="margin-top:8px">
        <button id="regen" class="btn">Rebuild</button>
      </div>
    `;
    // Dock under the main menu and keep it there if the menu resizes
    const place = () => {
      const mm = document.getElementById('mainmenu');
      const top = mm ? (mm.getBoundingClientRect().height + 24) : 72;
      root.style.top = `${Math.max(60, Math.round(top))}px`;
    };
    document.body.appendChild(root);
    place();
    const mm = document.getElementById('mainmenu');
    if (mm && 'ResizeObserver' in window) new ResizeObserver(place).observe(mm);

    const sea = root.querySelector('#sea');
    const hoff = root.querySelector('#hoff');
    const seaVal = root.querySelector('#seaVal');
    const hoffVal = root.querySelector('#hoffVal');

    const updateLabels = () => { seaVal.textContent = String(sea.value); hoffVal.textContent = String(hoff.value); };
    updateLabels();

    sea.addEventListener('input', () => { worldGen.setParams?.({ seaLevel: Number(sea.value) }); updateLabels(); });
    hoff.addEventListener('input', () => { worldGen.setParams?.({ heightOffset: Number(hoff.value) }); updateLabels(); });
    root.querySelector('#regen').addEventListener('click', () => { worldGen.invalidateAll?.(); });
    this.root = root;
  }
}

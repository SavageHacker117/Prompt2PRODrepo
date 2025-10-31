export class GrammarPanel {
  constructor({ onSeed, onLOD, onTime }){
    this.root = document.createElement('div');
    this.root.className = 'panel';
    this.root.style.left = 'auto';
    this.root.style.right = '16px';
    this.root.style.top = '16px';
    this.root.style.transform = 'none';
    this.root.style.display = 'block';

    this.root.innerHTML = `
      <h2>World Gen</h2>
      <label style="display:block;margin:.25rem 0">Prompt</label>
      <input id="gpPrompt" type="text" style="width:320px" placeholder="e.g. steep mountains NE-SW with 2 rivers, west coast"/>
      <div style="margin:.5rem 0">
        <button id="gpSeed">Seed again</button>
        <select id="gpLOD">
          <option value="low">Low</option>
          <option value="medium" selected>Medium</option>
          <option value="high">High</option>
        </select>
      </div>
      <label style="display:block;margin:.25rem 0">Time of day</label>
      <input id="gpTime" type="range" min="0" max="24" step="0.25" value="12"/>
    `;
    document.body.appendChild(this.root);

    this.root.querySelector('#gpSeed').addEventListener('click', ()=>{
      onSeed?.(this.root.querySelector('#gpPrompt').value || '');
    });
    this.root.querySelector('#gpLOD').addEventListener('change', (e)=> onLOD?.(e.target.value));
    this.root.querySelector('#gpTime').addEventListener('input', (e)=> onTime?.(parseFloat(e.target.value)));
  }
  setPrompt(t){ this.root.querySelector('#gpPrompt').value = t }
}

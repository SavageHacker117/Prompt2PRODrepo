export class NotificationBar{
  constructor(){ this.root=document.createElement('div'); this.root.id='notif'; this.root.className='panel'; this.root.innerHTML='<h3>Status</h3><div id="msg"></div>'; this.msg=this.root.querySelector('#msg') }
  getElement(){ return this.root }
  show(text, timeout=1600){ this.msg.textContent=text; this.root.style.display='block'; clearTimeout(this._t); this._t=setTimeout(()=>this.root.style.display='none', timeout) }
}

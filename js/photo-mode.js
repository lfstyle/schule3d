// Feste Präsentationsansichten verändern weder Spielerposition noch Raumzustände.
export const PHOTO_VIEWS = [
  ['Foyer', -4.15,1.6,-7.05,-2.05,-.03],
  ['Aufenthaltsraum',3.6,1.6,1.7,2.75,-.05],
  ['Future Lab',-4.05,1.6,-11.6,.85,-.08],
  ['Podcastraum',4.8,1.6,-8.15,-1.05,-.09],
  ['Raum 131',15.35,3.13,-2.75,Math.PI,-.05],
  ['Raum 130',15.7,3.13,-8.65,0,0],
  ['Flur 3',-2.7,5.22,-2,Math.PI,0],
  ['Innenhof',-3.4,1.6,.8,Math.PI,-.12],
];

export class PhotoMode {
  constructor({camera,player,renderer,postfx,visibility,perf,carry}) {
    Object.assign(this,{camera,player,renderer,postfx,visibility,perf,carry});
    this.active=false;
    const $=id=>document.getElementById(id);
    this.panel=$('photo-panel');this.select=$('photo-view');this.status=$('photo-status');this.fov=$('photo-fov');
    PHOTO_VIEWS.forEach((v,i)=>this.select.add(new Option(v[0],String(i))));
    $('photo-btn').addEventListener('click',()=>this.enter());
    $('photo-close').addEventListener('click',()=>this.exit());
    $('photo-save').addEventListener('click',()=>this.save());
    this.select.addEventListener('change',()=>this.choose(this.select.value));
    this.fov.addEventListener('input',()=>{this.camera.fov=Number(this.fov.value);this.camera.updateProjectionMatrix();this.render();});
  }

  enter() {
    if(this.active)return;
    this.saved={position:this.camera.position.clone(),quaternion:this.camera.quaternion.clone(),fov:this.camera.fov,perf:this.perf.visible,
      held:this.carry.holding?.object,heldVisible:this.carry.holding?.object.visible};
    this.active=true;
    if(this.saved.held)this.saved.held.visible=false;
    this.perf.toggle(false);
    this.player._setActive(false);document.exitPointerLock?.();
    this.panel.classList.remove('hidden');this.select.value='current';this.fov.value=this.camera.fov;
    this.status.textContent='Die Spielfigur wartet an deiner bisherigen Position.';
    this.render();this.select.focus();
  }

  choose(value) {
    if(!this.active)return;
    const view=PHOTO_VIEWS[Number(value)];
    if(value==='current'){
      this.camera.position.copy(this.saved.position);this.camera.quaternion.copy(this.saved.quaternion);
    } else if(view){this.camera.position.set(...view.slice(1,4));this.camera.rotation.set(view[5],view[4],0,'YXZ');}
    this.render();
  }

  render() {this.camera.updateMatrixWorld(true);this.visibility.update();this.postfx.render();}

  save() {
    if(!this.active)return;
    this.render(); // Sofort im selben Durchlauf auslesen; kein preserveDrawingBuffer nötig.
    this.renderer.domElement.toBlob(blob=>{
      if(!blob){this.status.textContent='Das Bild konnte nicht gespeichert werden.';return;}
      const url=URL.createObjectURL(blob),a=document.createElement('a');
      const name=this.select.selectedOptions[0].textContent.toLowerCase().replace(/[^a-z0-9]+/g,'-');
      a.href=url;a.download=`schule-3d-${name}-${new Date().toISOString().slice(0,10)}.png`;
      a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
      this.status.textContent='PNG gespeichert — ohne Karte, Hinweise oder Bedienelemente.';
    },'image/png');
  }

  exit() {
    if(!this.active)return;
    this.onExit?.();
    this.camera.position.copy(this.saved.position);this.camera.quaternion.copy(this.saved.quaternion);
    this.camera.fov=this.saved.fov;this.camera.updateProjectionMatrix();
    if(this.saved.held)this.saved.held.visible=this.saved.heldVisible;
    this.active=false;this.panel.classList.add('hidden');this.perf.toggle(this.saved.perf);
    this.player._setActive(false);this.render();document.getElementById('start-btn').focus();
  }
}

// Interaktionssystem: Was der Spieler mittig anschaut und mit E (bzw. R) benutzen kann.
// Jedes interaktive Objekt hat eine eindeutige ID – darüber können später
// Quests, Computer, NPCs usw. angebunden werden.
import * as THREE from 'three';

export class InteractionSystem {
  constructor(camera, { promptEl } = {}) {
    this.camera = camera;
    this.promptEl = promptEl;
    this.items = [];
    this.targets = [];
    this.current = null;
    this.enabled = false;
    this.override = null;          // z. B. "Ablegen" beim Tragen
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = 4;
    this._center = new THREE.Vector2(0, 0);
    this._lastPrompt = '';
    this.focusEl = document.createElement('div');
    this.focusEl.id = 'target-focus';
    this.focusEl.className = 'hidden';
    this.promptEl?.parentElement.appendChild(this.focusEl);
    this.focusBox = new THREE.Box3();
    this.focusMatrix = new THREE.Matrix4();
    this.focusPoint = new THREE.Vector3();
    this.blockRay = new THREE.Ray();
    this.blockBox = new THREE.Box3();
    this.blockPoint = new THREE.Vector3();
  }

  setOccluders(collision) {
    // Nur Wände, Glas und Türen, keine teuren Strahlentests gegen die ganze Szene.
    this.blockers = collision.blocks.filter(b => /wand|wall|fassade|tuer|fenster/.test(b.tag || ''));
  }

  _blocked(hit, item) {
    const ray = this.raycaster.ray;
    for (const b of this.blockers || []) {
      if (!b.enabled || b.id === item.id || b.slope) continue;
      const dx=ray.origin.x-b.x, dz=ray.origin.z-b.z, d=ray.direction;
      this.blockRay.origin.set(dx*b.cos-dz*b.sin,ray.origin.y,dx*b.sin+dz*b.cos);
      this.blockRay.direction.set(d.x*b.cos-d.z*b.sin,d.y,d.x*b.sin+d.z*b.cos);
      this.blockBox.min.set(-b.hw,b.bottom,-b.hd);this.blockBox.max.set(b.hw,b.top,b.hd);
      if (this.blockRay.intersectBox(this.blockBox,this.blockPoint) &&
          this.blockPoint.distanceTo(this.blockRay.origin) < hit.distance-.12) return true;
    }
    return false;
  }

  /**
   * Registriert ein interaktives Objekt.
   * def: { id, type, label(), onInteract(), maxDistance,
   *        secondary?: { key: 'R', label(), onInteract() }, hint?: [taste, text],
   *        forHit?(hit) -> { label, onInteract, secondary } (z. B. für einzelne Instanzen) }
   */
  register(object, def) {
    const item = { object, maxDistance: 2.6, ...def };
    object.traverse((o) => { o.userData.interactionId = def.id; });
    this.items.push(item);
    this.targets.push(object);
    return item;
  }

  unregister(id) {
    const i = this.items.findIndex((it) => it.id === id);
    if (i < 0) return;
    this.targets.splice(this.targets.indexOf(this.items[i].object), 1);
    this.items.splice(i, 1);
  }

  get(id) {
    return this.items.find((i) => i.id === id) ?? null;
  }

  update() {
    let found = null;
    let selectedHit = null, selectedItem = null;
    if (this.enabled && !this.override && this.targets.length) {
      this.camera.updateMatrixWorld();
      this.raycaster.setFromCamera(this._center, this.camera);
      const hits = this.raycaster.intersectObjects(this.targets, true);
      for (const hit of hits) {
        if (hit.object.userData.held) continue;
        const id = hit.object.userData.interactionId;
        const item = this.items.find((i) => i.id === id);
        if (item && hit.distance <= item.maxDistance && !this._blocked(hit,item)) {
          found = item.forHit ? item.forHit(hit) : item;
          selectedHit = hit; selectedItem = item;
        }
        break;
      }
    }
    this.current = found;
    this.hit = found ? selectedHit : null;   // Trefferpunkt/UV, z. B. zum Zeichnen auf Tafeln
    this._focus(found ? selectedHit : null, selectedItem);
    this._renderPrompt();
  }

  _focus(hit, item) {
    this.focusEl.classList.toggle('hidden', !hit);
    if (!hit) return;
    const b=this.focusBox, m=this.focusMatrix, p=this.focusPoint;
    if (hit.object.isInstancedMesh) {
      if (!hit.object.geometry.boundingBox) hit.object.geometry.computeBoundingBox();
      hit.object.getMatrixAt(hit.instanceId,m);m.premultiply(hit.object.matrixWorld);
      b.copy(hit.object.geometry.boundingBox).applyMatrix4(m);
    } else b.setFromObject(item.object);
    let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
    for (let i=0;i<8;i++) {
      p.set(i&1?b.max.x:b.min.x,i&2?b.max.y:b.min.y,i&4?b.max.z:b.min.z).project(this.camera);
      if(p.z>1) {this.focusEl.classList.add('hidden');return;}
      const x=(p.x+1)*innerWidth/2,y=(1-p.y)*innerHeight/2;
      x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
    }
    x0=Math.max(8,x0-5);y0=Math.max(8,y0-5);x1=Math.min(innerWidth-8,x1+5);y1=Math.min(innerHeight-8,y1+5);
    Object.assign(this.focusEl.style,{left:`${x0}px`,top:`${y0}px`,width:`${Math.max(16,x1-x0)}px`,height:`${Math.max(16,y1-y0)}px`});
  }

  _renderPrompt() {
    if (!this.promptEl) return;
    const lines = [];
    if (this.enabled && this.override) lines.push(['E', this.override]);
    else if (this.current && !this.quiet) {   // quiet: z. B. beim Zeichnen nichts über die Tafel legen
      lines.push(['E', this.current.label()]);
      if (this.current.secondary) lines.push([this.current.secondary.key ?? 'R', this.current.secondary.label()]);
      if (this.current.hint) lines.push(this.current.hint);
    }
    const key = lines.map((l) => l.join(':')).join('|');
    if (key === this._lastPrompt) return;
    this._lastPrompt = key;
    this.promptEl.replaceChildren();
    for (const [k, text] of lines) {
      const row = document.createElement('div');
      row.className = 'prompt-row';
      const kbd = document.createElement('kbd');
      kbd.textContent = k;
      const span = document.createElement('span');
      span.textContent = text;
      row.append(kbd, span);
      this.promptEl.append(row);
    }
    this.promptEl.classList.toggle('hidden', lines.length === 0);
  }

  /** E */
  trigger() {
    this.current?.onInteract();
  }

  /** R */
  triggerSecondary() {
    this.current?.secondary?.onInteract();
  }
}

// Info-Punkte: kleine (i)-Symbole an Objekten; anschauen + E öffnet eine Infokarte.
// Inhalte aus inhalte/rundgang.json (Liste "info"). Die Symbole sind HTML über dem Bild – keine neuen
// Meshes, Shader oder Zeichenbefehle. Zum Anvisieren dient je Punkt ein unsichtbarer Trefferkörper:
// Er wird nie gezeichnet, der Raycaster der Interaktion trifft ihn trotzdem (prüft `visible` nicht).
import * as THREE from 'three';

const SHOW_DISTANCE = 7;      // ab hier erscheint das Symbol
const CLOSE_DISTANCE = 5;     // so weit weg schließt sich die Karte eines Info-Punkts von selbst
const CHECK_INTERVAL = 0.1;   // Sichtprüfung gegen Wände 10× pro Sekunde, Position jedes Bild

export class InfoPoints {
  constructor({ scene, camera, interactions, player, layer, card }) {
    Object.assign(this, { scene, camera, interactions, player });
    this.layer = layer;           // Container für die Symbole (im HUD)
    this.card = card;             // { root, title, badge, text, foot }
    this.points = [];
    this.byId = new Map();
    this.seen = new Set();
    this.openId = null;           // Info-Punkt, dessen Karte offen ist
    this.cardAnchor = null;       // Ort, an dem eine Stationskarte geöffnet wurde
    this._timer = 0;
    this._v = new THREE.Vector3();
    this._ray = new THREE.Ray();
    this._box = new THREE.Box3();
    this._hit = new THREE.Vector3();
    this._geo = new THREE.SphereGeometry(0.22, 8, 6);
  }

  load(list = []) {
    for (const def of list) {
      if (!def?.id || !Array.isArray(def.pos) || this.byId.has(def.id)) {
        console.warn('Info-Punkt ungültig oder doppelt', def);
        continue;
      }
      const position = new THREE.Vector3(...def.pos);
      const hitbox = new THREE.Mesh(this._geo);
      hitbox.visible = false;
      hitbox.name = def.id;
      hitbox.position.copy(position);
      hitbox.userData.dynamic = true;
      this.scene.add(hitbox);
      hitbox.updateMatrixWorld(true);
      this.interactions.register(hitbox, {
        id: def.id, type: 'info', maxDistance: 3.5,
        label: () => (this.openId === def.id ? `${def.titel} schließen` : `Info: ${def.titel}`),
        onInteract: () => this.toggle(def.id),
      });
      const el = document.createElement('div');
      el.className = 'info-marker hidden';
      el.textContent = 'i';
      this.layer.appendChild(el);
      const point = { def, position, hitbox, el, visible: false };
      this.points.push(point);
      this.byId.set(def.id, point);
    }
  }

  /** Infokarte zu einem Info-Punkt öffnen bzw. wieder schließen. */
  toggle(id) {
    if (this.openId === id) { this.hideCard(); return; }
    const point = this.byId.get(id);
    if (!point) return;
    this.seen.add(id);
    point.el.classList.add('seen');
    this.showCard(point.def);
    this.openId = id;
  }

  /** Karte anzeigen. anchor: Spielerposition, ab der sie sich beim Weglaufen wieder schließt. */
  showCard({ titel, text, entwurf, kicker = '' }, anchor = null) {
    const c = this.card;
    c.kicker.textContent = kicker;
    c.kicker.classList.toggle('hidden', !kicker);
    c.title.textContent = titel ?? '';
    c.text.textContent = text ?? '';
    c.badge.classList.toggle('hidden', !entwurf);
    // Einblenden neu abspielen (CSS-Animation card-in), auch wenn die Karte schon offen war.
    c.root.classList.add('hidden');
    void c.root.offsetWidth;
    c.root.classList.remove('hidden');
    this.openId = null;
    this.cardAnchor = anchor ? anchor.clone() : null;
  }

  /** Karte schließen. Läuft ein Rundgang, holt onHide (tour.js) danach den Stationstext zurück. */
  hideCard() {
    this.card.root.classList.add('hidden');
    this.openId = null;
    this.cardAnchor = null;
    this.onHide?.();
  }

  /** Info-Punkte der aktuellen Station hervorheben (leere Liste = keine). */
  highlight(ids = []) {
    const set = new Set(ids);
    for (const p of this.points) p.el.classList.toggle('station', set.has(p.def.id));
  }

  update(dt) {
    const eye = this.camera.position, feet = this.player.position;
    // Karte schließt sich beim Weglaufen (Info-Punkt) bzw. nach einigen Metern (Station).
    if (this.openId) {
      const p = this.byId.get(this.openId);
      if (p && p.position.distanceTo(eye) > CLOSE_DISTANCE) this.hideCard();
    } else if (this.cardAnchor && this.cardAnchor.distanceTo(feet) > 4) this.hideCard();

    this._timer -= dt;
    if (this._timer <= 0) {
      this._timer = CHECK_INTERVAL;
      for (const p of this.points) p.visible = this._visible(p, eye, feet);
    }
    const w = innerWidth, h = innerHeight;
    for (const p of this.points) {
      let show = p.visible;
      if (show) {
        const s = this._v.copy(p.position).project(this.camera);
        show = s.z < 1 && Math.abs(s.x) < 1.05 && Math.abs(s.y) < 1.05;
        if (show) {
          const d = p.position.distanceTo(eye);
          p.el.style.transform = `translate(${(s.x + 1) * w / 2}px, ${(1 - s.y) * h / 2}px) translate(-50%, -50%) scale(${Math.max(0.7, 1.15 - d * 0.07).toFixed(2)})`;
        }
      }
      p.el.classList.toggle('hidden', !show);
    }
  }

  // Nah genug, auf der eigenen Ebene (Böden/Decken sind keine Sichtsperren der Interaktion) und keine
  // Wand, Tür oder Scheibe dazwischen – dieselben Sperren wie beim Benutzen (interaction.js).
  _visible(p, eye, feet) {
    const dist = p.position.distanceTo(eye);
    if (dist > SHOW_DISTANCE) return false;
    if (p.position.y < feet.y - 0.3 || p.position.y > feet.y + 3.2) return false;
    const ray = this._ray, box = this._box;
    const dir = this._v.subVectors(p.position, eye).normalize();
    for (const b of this.interactions.blockers || []) {
      if (!b.enabled || b.slope) continue;
      const dx = eye.x - b.x, dz = eye.z - b.z;
      ray.origin.set(dx * b.cos - dz * b.sin, eye.y, dx * b.sin + dz * b.cos);
      ray.direction.set(dir.x * b.cos - dir.z * b.sin, dir.y, dir.x * b.sin + dir.z * b.cos);
      box.min.set(-b.hw, b.bottom, -b.hd); box.max.set(b.hw, b.top, b.hd);
      if (ray.intersectBox(box, this._hit) && this._hit.distanceTo(ray.origin) < dist - 0.15) return false;
    }
    return true;
  }

  /** Für die Karte: Lage aller Info-Punkte (y knapp über dem Boden, für die Geschosszuordnung). */
  get mapMarkers() {
    return (this._mapMarkers ??= this.points.map((p) => ({ x: p.position.x, y: p.position.y - 1.0, z: p.position.z, kind: 'info', id: p.def.id })));
  }
}

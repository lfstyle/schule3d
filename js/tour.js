// Geführter Rundgang: Stationen aus inhalte/rundgang.json (Liste "stationen"). Jede Station setzt den Spieler an
// ihren Standpunkt, schaltet bei Bedarf das Raumlicht ein, öffnet die angegebenen Türen und zeigt ihren Text in der
// Leiste unten (#info-card, mit Fortschrittspunkten und Tasten). Der Text bleibt bis zur nächsten Station stehen;
// eine Info-Punkt-Karte ersetzt ihn kurz, danach kommt er zurück. N = nächste, Shift+N = vorherige Station.
// Wechsel mit N/Shift+N: Kamerafahrt vom aktuellen Standort durch Gänge, Türen und Treppen (tour-path.js); Türen
// auf dem Weg öffnen sich kurz vorher. Ohne Weg, bei sehr langen Wegen, aus dem Menü oder mit der Einstellung
// „Rundgang als Kamerafahrt“ aus: kurz abblenden und versetzen. N während der Fahrt springt ans Ziel, WASD hält an.
import { TourPath } from './tour-path.js';

const FADE_MS = 260;
const MAX_FLIGHT = 120;      // längere Wege werden überblendet (m)
const LOOK_AHEAD = 2.4;      // Blickpunkt voraus (m)
const ACCEL = 2.2;           // Anfahren/Bremsen (m/s²)
const MOVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class Tour {
  constructor({ stations = [], player, lighting, interactions, carry, infoPoints, bar, dots, fade, showHint, collision, camera, flight = () => true }) {
    Object.assign(this, { stations, player, lighting, interactions, carry, infoPoints, bar, dots, fade, showHint, collision, camera, flight });
    infoPoints.onHide = () => this._showStation();
    this.index = -1;
    this.active = false;
    this.busy = false;
    this.onChange = null;
    this.planning = null;   // { index, path: TourPath }
    this.flying = null;     // { index, route, s, v, yaw, pitch, opened }
  }

  start(index = 0) {
    this.active = true;
    this.go(index);
  }

  next() {
    if (!this.active) return false;
    if (this.flying || this.planning) { this._arrive(); return true; }
    if (this.index >= this.stations.length - 1) this.finish();
    else this.go(this.index + 1, { fly: true });
    return true;
  }

  prev() {
    if (!this.active) return false;
    const target = (this.flying ?? this.planning)?.index ?? this.index;
    if (target <= 0) return false;
    this._cancelFlight();
    this.go(target - 1, { fly: true });
    return true;
  }

  get moving() { return !!(this.flying || this.planning); }

  go(index, { fly = false } = {}) {
    const station = this.stations[index];
    if (!station || this.busy) return;
    this.active = true;
    this._cancelFlight();
    if (fly && this.flight() && this.collision) {
      const [x, y, z] = station.standpunkt, p = this.player.position;
      this.planning = { index, path: new TourPath(this.collision, this.interactions, { x: p.x, y: p.y, z: p.z }, { x, y, z }) };
      if (this.carry.holding) this.carry.drop(this.player);
      this.infoPoints.showCard({ titel: station.titel, kicker: `Unterwegs zu Station ${index + 1} von ${this.stations.length}` });
      this._renderBar(index, 'unterwegs');
      return;
    }
    this._fadeTo(index, station);
  }

  _fadeTo(index, station) {
    this.busy = true;
    this.fade.classList.add('on');
    setTimeout(() => {
      this.busy = false;
      this._apply(index, station);
      this.fade.classList.remove('on');
    }, FADE_MS);
  }

  /** Jedes Bild aus der Spielschleife (dt = 0 in der Pause). */
  update(dt) {
    if (this.planning) {
      const { index, path } = this.planning;
      if (!path.step(6)) return;
      this.planning = null;
      const route = path.result;
      if (!route || route.length > MAX_FLIGHT || route.length < 0.5) { this._fadeTo(index, this.stations[index]); return; }
      const s = this.stations[index];
      if (s.licht && !this.lighting.isOn(s.licht)) this.lighting.toggle(s.licht);
      this.interactions.enabled = false;
      this.flying = { index, route, s: 0, v: 0, i: 0, yaw: this.player.yaw, pitch: this.player.pitch, opened: new Set(),
        vmax: Math.min(4.2, Math.max(2.6, route.length / 9)) };
      return;
    }
    const f = this.flying;
    if (!f || !dt) return;
    if (MOVE_KEYS.some((k) => this.player.keys.has(k))) { this._stopHere(); return; }
    const { route } = f, L = route.length;
    f.v = Math.min(f.vmax, f.v + ACCEL * dt, Math.sqrt(2 * ACCEL * Math.max(0, L - f.s)) + 0.15);
    f.s = Math.min(L, f.s + f.v * dt);
    // Türen etwa 3,5 m vorher öffnen (über die vorhandene Interaktion: Animation, Klang, Kollider).
    for (const d of route.doors) {
      if (f.opened.has(d.id) || f.s < d.at - 3.5) continue;
      f.opened.add(d.id);
      const item = this.interactions.get(d.id);
      if (item && /öffnen/.test(item.label())) item.onInteract();
    }
    const p = this._at(f, f.s), ahead = this._at(f, Math.min(L, f.s + LOOK_AHEAD));
    // Blickrichtung: auf den Punkt voraus, gegen Ende auf die Blickrichtung der Station überblenden.
    const st = this.stations[f.index].standpunkt;
    const dx = ahead.x - p.x, dz = ahead.z - p.z, flat = Math.hypot(dx, dz);
    let yaw = flat > 0.05 ? Math.atan2(-dx, -dz) : f.yaw;
    let pitch = Math.max(-0.35, Math.min(0.3, Math.atan2(ahead.y - p.y, Math.max(0.5, flat)) * 0.7));
    const blend = Math.min(1, Math.max(0, 1 - (L - f.s) / 2.2)), b = blend * blend * (3 - 2 * blend);
    yaw = yaw + wrap((st[3] ?? yaw) - yaw) * b;
    pitch = pitch + ((st[4] ?? 0) - pitch) * b;
    const k = Math.min(1, dt * 3.2);
    f.yaw += wrap(yaw - f.yaw) * k;
    f.pitch += (pitch - f.pitch) * k;
    // Spielerposition mitführen (Karte, Bereichsname, Sichtbarkeit, Info-Punkte); die Kamera setzt die Fahrt.
    this.player.position.set(p.x, p.y, p.z);
    this.player.viewY = p.y;
    this.player.yaw = f.yaw;
    this.player.pitch = f.pitch;
    this.camera.position.set(p.x, p.y + this.player.standEye, p.z);
    this.camera.rotation.set(f.pitch, f.yaw, 0, 'YXZ');
    // Am Ziel noch kurz zu Ende drehen, höchstens 0,8 s.
    if (f.s >= L && (Math.abs(wrap((st[3] ?? f.yaw) - f.yaw)) < 0.02 || (f.hold = (f.hold ?? 0) + dt) > 0.8)) this._arrive();
  }

  // Punkt bei Bogenlänge s (lineare Interpolation zwischen den dichten Wegpunkten).
  _at(f, s) {
    const pts = f.route.points;
    let i = s >= f.s ? f.i : 0;
    while (i < pts.length - 2 && pts[i + 1].s < s) i++;
    if (s === f.s) f.i = i;
    const a = pts[i], b = pts[Math.min(pts.length - 1, i + 1)], t = b.s > a.s ? Math.min(1, Math.max(0, (s - a.s) / (b.s - a.s))) : 0;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
  }

  // Ziel erreicht oder mit N übersprungen: Station wie gewohnt anwenden.
  _arrive() {
    const index = (this.flying ?? this.planning)?.index;
    this._cancelFlight();
    if (index !== undefined) this._apply(index, this.stations[index]);
  }

  // WASD während der Fahrt: genau hier anhalten und die Steuerung zurückgeben.
  _stopHere() {
    const f = this.flying;
    this._cancelFlight();
    this.player.teleport(this.player.position.x, this.player.position.y, this.player.position.z, f.yaw, f.pitch);
    this.player.update(0);
    this.index = f.index;
    this.infoPoints.highlight(this.stations[f.index].info ?? []);
    this._showStation();
    this.onChange?.();
  }

  _cancelFlight() {
    if (this.flying && this.player.active) this.interactions.enabled = true;
    this.flying = null;
    this.planning = null;
  }

  _apply(index, s) {
    this.index = index;
    if (this.carry.holding) this.carry.drop(this.player);
    const [x, y, z, yaw = this.player.yaw, pitch = 0] = s.standpunkt;
    this.player.teleport(x, y, z, yaw, pitch);
    this.player.update(0);
    if (s.licht && !this.lighting.isOn(s.licht)) this.lighting.toggle(s.licht);
    for (const id of s.tueren ?? []) {
      // Über die vorhandene Interaktion öffnen (Animation, Klang, Kollider), nur wenn sie noch zu ist.
      const item = this.interactions.get(id);
      if (item && /öffnen/.test(item.label())) item.onInteract();
    }
    this.infoPoints.highlight(s.info ?? []);
    this._showStation();
    this.onChange?.();
  }

  finish() {
    this._cancelFlight();
    this.active = false;
    this.index = -1;
    this.infoPoints.highlight([]);
    this.infoPoints.card.root.classList.remove('collapsed');
    this.infoPoints.showCard({
      titel: 'Rundgang beendet',
      text: 'Jetzt kannst du frei durch die Schule laufen. Mit M öffnest du die Karte, über das Menü (Esc) kommst du zu jeder Station zurück.',
    }, this.player.position);
    this._renderBar();
    this.onChange?.();
  }

  stop() {
    this._cancelFlight();
    this.active = false;
    this.index = -1;
    this.infoPoints.highlight([]);
    if (!this.infoPoints.openId) this.infoPoints.hideCard();   // Stationstext weg, offene Info-Punkt-Karte bleibt
    this._renderBar();
    this.onChange?.();
  }

  // Text der aktuellen Station in der Leiste (ohne Anker: schließt sich nicht beim Weitergehen).
  _showStation() {
    const s = this.stations[this.index];
    if (!this.active || this.moving || this.busy || !s) return;
    this.infoPoints.showCard({ ...s, kicker: `Station ${this.index + 1} von ${this.stations.length}` });
    this._renderBar();
  }

  // Tasten und Fortschrittspunkte in der Leiste; nur während des Rundgangs sichtbar.
  _renderBar(index = this.index, mode = null) {
    const s = this.stations[index], on = this.active && !!s;
    this.bar.classList.toggle('hidden', !on);
    this.dots.classList.toggle('hidden', !on);
    if (!on) return;
    this.dots.replaceChildren(...this.stations.map((_, i) => {
      const dot = document.createElement('span');
      if (i < index) dot.className = 'done';
      else if (i === index) dot.className = 'now';
      return dot;
    }));
    this.bar.replaceChildren();
    const keys = mode
      ? [['N', 'überspringen'], ['W', 'anhalten']]
      : [['N', index < this.stations.length - 1 ? 'weiter zur nächsten Station' : 'Rundgang beenden'],
        ...(index > 0 ? [['⇧ N', 'zurück']] : []), ['H', 'Text ein/aus'], ['Esc', 'Menü']];
    for (const [key, text] of keys) {
      const kbd = document.createElement('kbd');
      kbd.textContent = key;
      const span = document.createElement('span');   // Taste und Beschriftung brechen gemeinsam um
      span.append(kbd, ' ' + text);
      this.bar.append(span);
    }
  }

  /** Für die Karte: Standpunkte der Stationen mit Nummer. */
  get mapMarkers() {
    this._mapMarkers ??= this.stations.map((s, i) => ({ x: s.standpunkt[0], y: s.standpunkt[1], z: s.standpunkt[2], kind: 'station', label: String(i + 1) }));
    this._mapMarkers.forEach((m, i) => { m.current = i === this.index; });
    return this._mapMarkers;
  }
}

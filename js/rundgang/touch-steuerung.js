// Rundgang (leichte Version): Bedienung mit Fingern (und zum Testen am PC mit der Maus).
// - Joystick unten links: laufen (analog, Tempo nach Auslenkung).
// - Wischen/Ziehen auf dem Bild: umsehen.
// - Kurz antippen: das angetippte Objekt benutzen (Tür, Info-Punkt …), falls es nah genug ist.
// Zeigerereignisse (Pointer Events) decken Finger, Apple Pencil und Maus gemeinsam ab.

const TAP_MS = 280;      // so kurz muss ein Antippen sein
const TAP_MOVE = 10;     // höchstens so viele Punkte Bewegung

export class TouchControls {
  constructor({ player, surface, joystick, knob, onTap }) {
    Object.assign(this, { player, surface, joystick, knob, onTap });
    this.enabled = false;
    this.look = null;     // { id, x, y, startX, startY, t, moved }
    this.stick = null;    // { id, cx, cy, r }

    surface.addEventListener('pointerdown', (e) => this._lookDown(e));
    joystick.addEventListener('pointerdown', (e) => this._stickDown(e));
    window.addEventListener('pointermove', (e) => this._move(e), { passive: false });
    window.addEventListener('pointerup', (e) => this._up(e));
    window.addEventListener('pointercancel', (e) => this._up(e, true));
    window.addEventListener('blur', () => this.reset());

    // Safari: kein Zoomen mit zwei Fingern, kein Doppeltipp-Zoom, kein Gummiband-Scrollen der Seite.
    for (const type of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(type, (e) => e.preventDefault());
    document.addEventListener('touchmove', (e) => { if (!e.target.closest?.('.scrollable')) e.preventDefault(); }, { passive: false });
    document.addEventListener('dblclick', (e) => e.preventDefault());
  }

  setEnabled(on) {
    this.enabled = on;
    if (!on) this.reset();
  }

  reset() {
    this.look = null;
    this.stick = null;
    this.player.joy.x = this.player.joy.y = 0;
    this.knob.style.transform = '';
    this.joystick.classList.remove('active');
  }

  _lookDown(e) {
    if (!this.enabled || this.look || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    this.look = { id: e.pointerId, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, t: performance.now(), moved: false };
  }

  _stickDown(e) {
    if (!this.enabled || this.stick) return;
    e.preventDefault();
    const r = this.joystick.getBoundingClientRect();
    this.stick = { id: e.pointerId, cx: r.left + r.width / 2, cy: r.top + r.height / 2, r: r.width / 2 };
    this.joystick.classList.add('active');
    this._stickMove(e);
  }

  _move(e) {
    if (this.stick?.id === e.pointerId) { e.preventDefault(); this._stickMove(e); return; }
    const l = this.look;
    if (l?.id !== e.pointerId) return;
    e.preventDefault();
    const dx = e.clientX - l.x, dy = e.clientY - l.y;
    l.x = e.clientX; l.y = e.clientY;
    if (Math.hypot(e.clientX - l.startX, e.clientY - l.startY) > TAP_MOVE) l.moved = true;
    this.player.look(dx, dy);
  }

  _stickMove(e) {
    const s = this.stick;
    let dx = (e.clientX - s.cx) / s.r, dy = (e.clientY - s.cy) / s.r;
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    this.player.joy.x = dx;
    this.player.joy.y = -dy;
    this.knob.style.transform = `translate(${dx * s.r * 0.6}px, ${dy * s.r * 0.6}px)`;
  }

  _up(e, cancel = false) {
    if (this.stick?.id === e.pointerId) {
      this.stick = null;
      this.player.joy.x = this.player.joy.y = 0;
      this.knob.style.transform = '';
      this.joystick.classList.remove('active');
      return;
    }
    const l = this.look;
    if (l?.id !== e.pointerId) return;
    this.look = null;
    if (!cancel && !l.moved && performance.now() - l.t < TAP_MS) this.onTap?.(e.clientX, e.clientY);
  }
}

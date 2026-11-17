// Leichte Version (rundgang.html): Spieler für zwei Bedienarten. Erbt die ganze Bewegung, Kollision, Treppen und
// Schritte von player.js; nur die Eingabe kommt dazu.
// - device 'touch' (iPad/Tablet): Joystick (Laufen) und Wischen (Umsehen, touch-steuerung.js). Kein Pointer Lock
//   (gibt es auf dem iPad nicht): „aktiv“ heißt hier einfach „Spiel läuft, Menü zu“.
// - device 'pc': wie die PC-Version – Maus wird gefangen (Pointer Lock), WASD, Esc gibt die Maus frei.
import { Player } from '../player.js';

const DEAD_ZONE = 0.12;

export class TouchPlayer extends Player {
  constructor(camera, domElement, collision, spawn) {
    super(camera, domElement, collision, spawn);
    // Maus-Umsehen von player.js nur im PC-Modus; im Touch-Modus übernimmt touch-steuerung.js (Finger und Maus).
    document.removeEventListener('mousemove', this._onMouseMove);
    const mouseLook = this._onMouseMove;
    this._onMouseMove = (e) => { if (this.device === 'pc') mouseLook(e); };
    document.addEventListener('mousemove', this._onMouseMove);
    this.device = 'touch';
    this.joy = { x: 0, y: 0 };        // Joystick: x rechts, y vorwärts, je −1 … 1
    this.lookSensitivity = 1;         // Faktor für das Wischen
    this._joyKey = false;
  }

  /** Startet die Steuerung: PC mit gefangener Maus (Ersatz: Ziehen), Touch ohne. */
  lock() {
    if (this.device === 'pc') super.lock();
    else this._setActive(true, 'touch');
  }

  unlock() {
    if (this.mode === 'pointer' && document.pointerLockElement) document.exitPointerLock();
    else this._setActive(false);
  }

  /** Umsehen um dx/dy Bildschirmpunkte (vom Wischen oder Ziehen mit der Maus). */
  look(dx, dy) {
    if (!this.active) return;
    const zoomScale = this.baseFov > 0 ? Math.min(1, this.camera.fov / this.baseFov) : 1;
    // Etwa eine halbe Drehung, wenn man über die ganze Bildschirmbreite wischt.
    const sens = (Math.PI / Math.max(600, innerWidth)) * this.lookSensitivity * zoomScale;
    this.yaw -= dx * sens;
    this.pitch -= dy * sens * (this.invertY ? -1 : 1);
    const lim = Math.PI / 2 - 0.05;
    this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
  }

  /** Joystick gedrückt? Dann zählt er wie W (der Rundgang hält bei Bewegung an, wie mit WASD). */
  get joystickActive() {
    return Math.hypot(this.joy.x, this.joy.y) > DEAD_ZONE;
  }

  update(dt) {
    const j = this.joy, mag = Math.min(1, Math.hypot(j.x, j.y));
    const keyboard = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']
      .some((k) => this.keys.has(k) && !(k === 'KeyW' && this._joyKey));
    if (mag <= DEAD_ZONE || keyboard || !this.active) {
      if (this._joyKey) { this.keys.delete('KeyW'); this._joyKey = false; }
      super.update(dt);
      return;
    }
    // Analoger Joystick über die vorhandene Bewegung: „vorwärts“ in Joystick-Richtung, Tempo nach Auslenkung.
    // Dafür kurz Blickrichtung und Gehtempo anpassen und danach die Kamera wieder auf den echten Blick setzen.
    if (!this.keys.has('KeyW')) { this.keys.add('KeyW'); this._joyKey = true; }
    const yaw = this.yaw, walk = this.walkSpeed;
    const t = (mag - DEAD_ZONE) / (1 - DEAD_ZONE);
    this.walkSpeed = walk * (0.25 + 0.95 * t);   // ganz ausgelenkt etwas schneller als normales Gehen
    this.yaw = yaw - Math.atan2(j.x, j.y);
    try {
      super.update(dt);
    } finally {
      this.yaw = yaw;
      this.walkSpeed = walk;
      this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    }
  }
}

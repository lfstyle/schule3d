// VR-Version: Eingabe der Quest-Controller (und Ersatz am PC für den Probemodus).
// Beide liefern jedes Bild dasselbe: read() → { move: {x, y}, turn: −1|0|1, trigger: Hand|null, a, b, x, y }
// (Knöpfe nur im Moment des Drückens). Belegung (xr-standard der Quest Touch): buttons[0] Abzug, [3] Stick drücken (rechts: Augenhöhe), [4] A/X, [5] B/Y,
// axes[2]/[3] Stick.
// Controller-Modelle sind bewusst schlicht (ein Quader) und werden nicht aus dem Internet geladen
// (XRControllerModelFactory bräuchte einen fremden Server und den GLTF-Lader).
import * as THREE from 'three';

const DEAD = 0.15;          // Stick-Totzone
const TURN_ON = 0.65, TURN_OFF = 0.3;
const RAY_LENGTH = 3;       // m, ohne Ziel
const COLOR_IDLE = 0x9aa4ae, COLOR_TARGET = 0xff5a64;

const _m = new THREE.Matrix4();

export class VrHaende {
  constructor(renderer, rig) {
    this.renderer = renderer;
    this.bodyGeo = new THREE.BoxGeometry(0.036, 0.03, 0.11);
    this.bodyMat = new THREE.MeshLambertMaterial({ color: 0x2b2f35 });
    this.rayGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
    this.hands = [0, 1].map((i) => this._hand(i, rig));
    this.active = null;            // Hand mit Zeigestrahl (zuletzt den Abzug gedrückt, sonst rechts)
    this._turnArmed = true;
  }

  _hand(index, rig) {
    const ray = this.renderer.xr.getController(index);     // Zielstrahl-Raum
    const grip = this.renderer.xr.getControllerGrip(index); // Griff-Raum (Modell)
    rig.add(ray, grip);
    const body = new THREE.Mesh(this.bodyGeo, this.bodyMat);
    body.position.z = 0.02;
    grip.add(body);
    const lineMat = new THREE.LineBasicMaterial({ color: COLOR_IDLE, transparent: true, opacity: 0.85, fog: false, toneMapped: false });
    const line = new THREE.Line(this.rayGeo, lineMat);
    line.scale.z = RAY_LENGTH;
    line.visible = false;
    ray.add(line);
    const hand = { index, ray, grip, line, lineMat, source: null, side: '', pressed: [] };
    ray.addEventListener('connected', (e) => { hand.source = e.data; hand.side = e.data.handedness; });
    ray.addEventListener('disconnected', () => { hand.source = null; hand.side = ''; hand.pressed = []; });
    return hand;
  }

  /** Hat sich mindestens ein Controller mit Knöpfen gemeldet? */
  get connected() { return this.hands.some((h) => h.source?.gamepad); }

  get right() { return this.hands.find((h) => h.side === 'right') ?? this.hands.find((h) => h.source && h.side !== 'left'); }
  get left() { return this.hands.find((h) => h.side === 'left'); }

  _edge(hand, i) {
    const pad = hand?.source?.gamepad, now = !!pad?.buttons[i]?.pressed, was = !!hand.pressed[i];
    if (hand) hand.pressed[i] = now;
    return now && !was;
  }

  read() {
    const out = { move: { x: 0, y: 0 }, turn: 0, trigger: null, a: false, b: false, x: false, y: false, height: false };
    const left = this.left, right = this.right;
    const axes = (h) => h?.source?.gamepad?.axes ?? [];
    const la = axes(left), ra = axes(right);
    const mx = la[2] ?? 0, my = la[3] ?? 0;
    if (Math.hypot(mx, my) > DEAD) out.move = { x: mx, y: -my };
    const tx = ra[2] ?? 0;
    if (this._turnArmed && Math.abs(tx) > TURN_ON) { out.turn = Math.sign(tx); this._turnArmed = false; }
    else if (Math.abs(tx) < TURN_OFF) this._turnArmed = true;
    for (const h of this.hands) if (this._edge(h, 0)) { this.active = h; out.trigger = h; }
    if (right) { out.a = this._edge(right, 4); out.b = this._edge(right, 5); out.height = this._edge(right, 3); }
    if (left) { out.x = this._edge(left, 4); out.y = this._edge(left, 5); }
    if (!this.active?.source) this.active = right ?? left ?? null;
    return out;
  }

  /** Zielstrahl der aktiven Hand für interaction.js (aim). */
  aim(raycaster) {
    const h = this.active;
    if (!h?.source) { raycaster.ray.direction.set(0, -1, 0); raycaster.ray.origin.set(0, -1000, 0); return; }
    _m.identity().extractRotation(h.ray.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(h.ray.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(_m);
  }

  /** Strahl der aktiven Hand bis zum Ziel zeichnen; andere Strahlen aus. hit: Treffer oder null. */
  showRay(hit, label) {
    for (const h of this.hands) h.line.visible = h === this.active && !!h.source;
    const h = this.active;
    if (!h?.source) return;
    h.line.scale.z = hit ? Math.max(0.05, hit.distance) : RAY_LENGTH;
    h.lineMat.color.setHex(hit ? COLOR_TARGET : COLOR_IDLE);
    if (label && label.mesh.parent !== h.ray) {
      h.ray.add(label.mesh);
      label.mesh.position.set(0, 0.05, -0.12);
      label.mesh.rotation.set(-0.5, 0, 0);
    }
  }

  /** Für die Shader-Vorbereitung Modelle und Strahlen kurz sichtbar machen. */
  set prepare(on) { for (const h of this.hands) { h.line.visible = on; h.ray.visible = on || !!h.source; h.grip.visible = on || !!h.source; } }
}

// ------------------------------------------------------------------ Probemodus am PC (vr.html?desktop)
// Maus ziehen = Kopf drehen (setzt die Kamera im Rig wie die Brille), W A S D = linker Stick, J/L = rechter Stick,
// F = Abzug (Strahl aus der Blickmitte), N = A, B = B, X = X, Y = Y, H = rechten Stick drücken (Augenhöhe).
export class DesktopEingabe {
  constructor(camera, dom) {
    this.camera = camera;
    this.keys = new Set();
    this.queue = new Set();
    this.yaw = 0;
    this.pitch = 0;
    this.enabled = false;
    camera.position.set(0, 1.62, 0);   // Augenhöhe im Rig (wie stehend mit der Brille)
    document.addEventListener('keydown', (e) => {
      if (!this.enabled || e.repeat) return;
      this.keys.add(e.code);
      if (['KeyF', 'KeyN', 'KeyB', 'KeyX', 'KeyY', 'KeyZ', 'KeyJ', 'KeyL', 'KeyH'].includes(e.code)) this.queue.add(e.code);
    });
    document.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    let drag = null;
    dom.addEventListener('pointerdown', (e) => { if (this.enabled) drag = { x: e.clientX, y: e.clientY }; });
    window.addEventListener('pointerup', () => { drag = null; });
    window.addEventListener('pointermove', (e) => {
      if (!drag || !this.enabled) return;
      this.yaw -= (e.clientX - drag.x) * 0.004;
      this.pitch = Math.max(-1.4, Math.min(1.4, this.pitch - (e.clientY - drag.y) * 0.004));
      drag = { x: e.clientX, y: e.clientY };
    });
    this.active = { ray: camera, source: {} };
  }

  get connected() { return true; }

  read() {
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    const k = this.keys, q = this.queue;
    const x = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0), y = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0);
    const out = { move: { x, y }, turn: q.has('KeyL') ? 1 : q.has('KeyJ') ? -1 : 0, trigger: q.has('KeyF') ? this.active : null,
      a: q.has('KeyN'), b: q.has('KeyB'), x: q.has('KeyX'), y: q.has('KeyY') || q.has('KeyZ'), height: q.has('KeyH') };
    q.clear();
    return out;
  }

  aim(raycaster) {
    this.camera.updateMatrixWorld();
    raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
  }

  showRay() {}
  set prepare(on) {}
}

// VR-Version: Spieler mit Kamera-Rig. Bewegung, Kollision, Treppen und Schritte kommen unverändert aus player.js
// (über den Joystick von touch-player.js); nur die Kamera wird anders geführt:
// - Das Rig (Group) steht mit dem Ursprung auf dem Boden; die Brille setzt die Kamera darin (Kopfhöhe, Blick).
// - Linker Stick: player.joy, „vorwärts“ = Blickrichtung des Kopfes. Rechter Stick: drehen() um ±30° um den Kopf.
// - Echtes Herumgehen: Der Körper (player.position) folgt dem Kopf mit Kollision. Geht man in eine Wand, bleibt
//   der Körper davor stehen und das Rig wird zurückgeschoben – der Kopf kommt nie in Wände oder Möbel.
// - Kein Kopfwippen, Springen, Sprinten, Ducken, Zoom: Tasten-Eingaben von player.js sind abgemeldet.
import * as THREE from 'three';
import { TouchPlayer } from '../rundgang/touch-player.js';

const _fwd = new THREE.Vector3(), _now = new THREE.Vector3();

export class VrPlayer extends TouchPlayer {
  /** rig: Group in der Szene, camera: Kamera im Rig (von der Brille gesetzt). */
  constructor(rig, camera, domElement, collision, spawn) {
    // player.js schreibt Position/Drehung in „seine“ Kamera: hier ein Stellvertreter, der nur rechnet.
    const proxy = { position: new THREE.Vector3(), rotation: new THREE.Euler(), fov: 72, updateProjectionMatrix() {} };
    super(proxy, domElement, collision, spawn);
    this.rig = rig;
    this.headCamera = camera;
    this.device = 'vr';
    // Gehtempo: ganz ausgelenkt ≈ 1,2 × walkSpeed (touch-player.js) ≈ 2 m/s – angenehmer in VR als 3 m/s.
    this.walkSpeed = 1.7;
    this.turnStep = Math.PI / 6;     // 30°
    this.rigYaw = 0;
    this.heightOffset = 0;           // Augenhöhe angleichen (rechter Stick drücken), z. B. im Sitzen
    this.standardEye = 1.62;         // m über dem Boden, wie stehend
    this._offset = new THREE.Vector3();   // Kopf relativ zum Rig-Ursprung, in Weltrichtung (nur x/z)
    this._ready = true;
    // Keine Tasten (Sprint, Sprung, Ducken, Zoom, WASD): Eingaben kommen nur über joy.
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup', this._onKeyUp);
    this._align(this.yaw);
  }

  lock() { this._setActive(true, 'vr'); }
  unlock() { this._setActive(false); }

  /** Blickrichtung des Kopfes in der Welt (Drehung um y). */
  get headYaw() {
    _fwd.set(0, 0, -1).applyQuaternion(this.headCamera.quaternion);
    const local = Math.hypot(_fwd.x, _fwd.z) > 1e-4 ? Math.atan2(-_fwd.x, -_fwd.z) : 0;
    return this.rigYaw + local;
  }

  _headOffset(target) {
    const p = this.headCamera.position, s = Math.sin(this.rigYaw), c = Math.cos(this.rigYaw);
    return target.set(p.x * c + p.z * s, 0, -p.x * s + p.z * c);
  }

  // Rig so drehen, dass der Kopf in Richtung yaw schaut, und so stellen, dass der Kopf über player.position steht.
  _align(yaw) {
    if (!this._ready) return;
    _fwd.set(0, 0, -1).applyQuaternion(this.headCamera.quaternion);
    const local = Math.hypot(_fwd.x, _fwd.z) > 1e-4 ? Math.atan2(-_fwd.x, -_fwd.z) : 0;
    this.rigYaw = yaw - local;
    this._placeRig();
  }

  _placeRig() {
    this._headOffset(this._offset);
    this.rig.position.set(this.position.x - this._offset.x, this.viewY + this.heightOffset, this.position.z - this._offset.z);
    this.rig.rotation.set(0, this.rigYaw, 0);
    this.rig.updateMatrixWorld(true);
  }

  respawn() {
    super.respawn();
    this._align(this.yaw);
  }

  teleport(x, y, z, yaw = this.headYaw, pitch = 0) {
    super.teleport(x, y, z, yaw, pitch);
    this._align(yaw);
  }

  /**
   * Rechten Stick drücken: Augenhöhe auf standardEye angleichen (im Sitzen sonst ≈ 1,2 m), nochmal: echte Höhe.
   * Gibt die Änderung in m zurück (0 = echte Höhe bzw. passt schon).
   */
  toggleHeight() {
    const real = this.headCamera.position.y;
    this.heightOffset = this.heightOffset || real < 0.3 ? 0 : this.standardEye - real;
    if (Math.abs(this.heightOffset) < 0.05) this.heightOffset = 0;
    this._placeRig();
    return this.heightOffset;
  }

  /** Rechter Stick: ruckartig um den Kopf drehen (dir = −1 links, +1 rechts). */
  turn(dir) {
    this.rigYaw -= dir * this.turnStep;
    this._placeRig();
  }

  update(dt) {
    if (!this._ready) { super.update(dt); return; }
    // 1. Echtes Gehen: Kopfbewegung seit dem letzten Bild auf den Körper übertragen (mit Kollision).
    const before = this._offset, now = this._headOffset(_now);
    const dx = now.x - before.x, dz = now.z - before.z, dist = Math.hypot(dx, dz);
    // Mehr als 30 cm in einem Bild ist kein Schritt, sondern ein Sprung der Ortung (erstes Bild, Neu-Zentrieren mit
    // der Meta-Taste): dann nur das Rig neu stellen, der Körper bleibt stehen.
    if (dist > 1e-4 && dist < 0.3) {
      const steps = Math.max(1, Math.ceil(dist / 0.08));
      for (let i = 0; i < steps; i++) {
        this.position.x += dx / steps;
        this.position.z += dz / steps;
        this.collision.resolve(this.position, this.radius, this.position.y, this.height, this.stepUp);
      }
    }
    // 2. Laufen mit dem Stick in Blickrichtung (player.js/touch-player.js: Kollision, Treppen, Schritte).
    this.yaw = this.headYaw;
    super.update(dt);
    // 3. Rig nachführen: Boden = geglättete Fußhöhe (Treppen), Kopf über dem Körper.
    this._placeRig();
  }
}

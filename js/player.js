// First-Person-Spieler: Pointer-Lock-Maussteuerung, WASD, Sprint, Sprung, Ducken,
// Schwerkraft und Kollision über die CollisionWorld.
import * as THREE from 'three';

export class Player {
  constructor(camera, domElement, collision, spawn) {
    this.camera = camera;
    this.dom = domElement;
    this.collision = collision;

    // Körpermaße (Meter)
    this.standRadius = 0.25;
    this.crouchRadius = 0.2;        // geduckt etwas schmaler
    this.radius = this.standRadius;
    this.standHeight = 1.8;
    this.crouchHeight = 0.66;        // tief genug, um unter Tische zu krabbeln
    this.standEye = 1.6;
    this.crouchEye = 0.52;
    this.height = this.standHeight;
    this.eyeHeight = this.standEye;
    this.crouch = 0;                 // 0 = stehen, 1 = geduckt
    this.stepUp = 0.35;

    // Bewegung
    this.walkSpeed = 2.6;
    this.runSpeed = 5.0;
    this.crouchSpeed = 1.2;
    this.jumpSpeed = 5.0;            // ca. 0,85 m Sprunghöhe – reicht auf Tische
    this.airStepUp = 0.22;           // in der Luft: Kanten bis 22 cm unter den Füßen gelten als Landefläche
    this.gravity = 14.5;
    this.baseSensitivity = 0.0022;
    this.mouseSensitivity = this.baseSensitivity;
    this.invertY = false;
    this.baseFov = camera.fov;
    this.zoomFov = 32;
    this.zoom = 0;                   // 0 = normal, 1 = herangezoomt (Taste Z)

    // Ereignisse (z. B. für Geräusche): onStep/onLand(tag, stärke, bodenmaterial)
    this.onStep = null;
    this.onLand = null;
    this.groundTag = null;
    this.groundSurface = null;
    this._stepDistance = 0;

    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.onGround = false;
    this.viewY = 0;
    this.bobPhase = 0;
    // Steuerung aktiv? mode = 'pointer' (Maus gesperrt) oder 'drag' (Ersatz: Umsehen mit gedrückter Maustaste,
    // falls der Browser Pointer Lock blockiert, z. B. in eingebetteten Fenstern)
    this.active = false;
    this.mode = null;
    this.keys = new Set();
    this.spawn = spawn;
    this.respawn();

    this._onKeyDown = (e) => {
      if (!this.active) return;
      if (e.code === 'Escape' && this.mode === 'drag') { this._setActive(false); return; }
      this.keys.add(e.code);
      if (e.key && e.key.toLowerCase() === 'z') this.keys.add('KeyZ');
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    };
    this._onKeyUp = (e) => {
      this.keys.delete(e.code);
      if ((e.key && e.key.toLowerCase() === 'z') || e.code === 'KeyY' || e.code === 'KeyZ') this.keys.delete('KeyZ');
    };
    this._onMouseMove = (e) => {
      if (!this.active) return;
      if (this.mode === 'drag' && !(e.buttons & 1)) return;
      const zoomScale = this.baseFov > 0 ? Math.min(1, this.camera.fov / this.baseFov) : 1;
      const sens = this.mouseSensitivity * zoomScale;
      this.yaw -= e.movementX * sens;
      this.pitch -= e.movementY * sens * (this.invertY ? -1 : 1);
      const lim = Math.PI / 2 - 0.05;
      this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
    };
    this._onLockChange = () => {
      if (document.pointerLockElement === this.dom) this._setActive(true, 'pointer');
      else if (this.mode === 'pointer') this._setActive(false);
    };
    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('pointerlockchange', this._onLockChange);
    document.addEventListener('pointerlockerror', () => this._setActive(true, 'drag'));
    window.addEventListener('blur', () => this.keys.clear());
  }

  _setActive(active, mode = null) {
    this.active = active;
    this.mode = active ? mode : null;
    if (!active) { this.keys.clear(); this._stepDistance = 0; }
    this.onLockChange?.(active, this.mode);
  }

  /** Startet die Steuerung (fordert Pointer Lock an, sonst Ersatzmodus). */
  lock() {
    if (!this.dom.requestPointerLock) { this._setActive(true, 'drag'); return; }
    const p = this.dom.requestPointerLock();
    if (p && p.catch) p.catch(() => {});
  }

  setSensitivity(factor) {
    this.mouseSensitivity = this.baseSensitivity * factor;
  }

  setFov(fov) {
    this.baseFov = fov;
    if (this.zoom === 0) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }

  respawn() {
    const s = this.spawn;
    this.position.set(s.x, s.y ?? 0, s.z);
    this.velocity.set(0, 0, 0);
    this.yaw = s.yaw ?? 0;
    this.pitch = s.pitch ?? 0;
    this.viewY = this.position.y;
    this.onGround = false;
    this._stepDistance = 0;
  }

  /** Setzt Position/Blickrichtung (für Debug und spätere Teleports). */
  teleport(x, y, z, yaw = this.yaw, pitch = this.pitch) {
    this.position.set(x, y, z);
    this.velocity.set(0, 0, 0);
    this.yaw = yaw;
    this.pitch = pitch;
    this.viewY = y;
    this.onGround = false;
    this._stepDistance = 0;
  }

  /** Platz zum Aufstehen? (Decke/Tischplatte über dem Kopf) */
  _headroom() {
    return this.collision.ceilingHeight(
      this.position.x, this.position.z, this.position.y + this.height - 0.02, this.radius * 0.9
    ) - this.position.y;
  }

  update(dt) {
    dt = Math.min(dt, 0.05);
    const k = this.keys;

    // --- Ducken (C gedrückt halten). Aufstehen nur, wenn über dem Kopf Platz ist.
    const wantCrouch = k.has('KeyC');
    let target = wantCrouch ? 1 : 0;
    if (!wantCrouch && this.crouch > 0) {
      const room = this._headroom();
      const needed = this.standHeight + 0.01;
      if (room < needed) {
        const t = (this.standHeight - Math.max(this.crouchHeight, room - 0.01)) / (this.standHeight - this.crouchHeight);
        target = Math.min(1, Math.max(0, t));
      }
    }
    this.crouch += (target - this.crouch) * Math.min(1, dt * 10);
    if (Math.abs(this.crouch - target) < 0.002) this.crouch = target;
    this.height = this.standHeight + (this.crouchHeight - this.standHeight) * this.crouch;
    this.eyeHeight = this.standEye + (this.crouchEye - this.standEye) * this.crouch;
    this.radius = this.standRadius + (this.crouchRadius - this.standRadius) * this.crouch;
    const crouched = this.crouch > 0.5;

    // --- Eingabe -> gewünschte Geschwindigkeit
    let fwd = 0, side = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) fwd += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) fwd -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) side += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) side -= 1;
    const len = Math.hypot(fwd, side);
    if (len > 0) { fwd /= len; side /= len; }
    const running = !crouched && (k.has('ShiftLeft') || k.has('ShiftRight'));
    const speed = crouched ? this.crouchSpeed : running ? this.runSpeed : this.walkSpeed;

    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const wishX = (-sin * fwd + cos * side) * speed;
    const wishZ = (-cos * fwd - sin * side) * speed;
    const accel = this.onGround ? 11 : 8;
    const a = Math.min(1, accel * dt);
    this.velocity.x += (wishX - this.velocity.x) * a;
    this.velocity.z += (wishZ - this.velocity.z) * a;

    if (k.has('Space') && this.onGround && !crouched) {
      this.velocity.y = this.jumpSpeed;
      this.onGround = false;
    }
    this.velocity.y -= this.gravity * dt;

    // --- Horizontale Bewegung in kleinen Schritten (kein Durchtunneln)
    // In der Luft nur beim Fallen großzügig sein, damit man auf Möbeln landet statt abzuprallen
    const stepUp = this.onGround ? this.stepUp : (this.velocity.y <= 0 ? this.airStepUp : 0.05);
    const dx = this.velocity.x * dt, dz = this.velocity.z * dt;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.08));
    const before = { x: this.position.x, z: this.position.z };
    for (let i = 0; i < steps; i++) {
      this.position.x += dx / steps;
      this.position.z += dz / steps;
      this.collision.resolve(this.position, this.radius, this.position.y, this.height, stepUp);
    }
    // Tatsächliche Geschwindigkeit übernehmen (z. B. beim Entlanggleiten an Wänden), aber nie schneller
    // als vorher – sonst wird das Herausschieben aus einem Hindernis zum "Katapult"
    let moved = 0;
    if (dt > 0) {
      const mx = this.position.x - before.x, mz = this.position.z - before.z;
      moved = Math.hypot(mx, mz);
      const vx = mx / dt, vz = mz / dt;
      const before2 = this.velocity.x ** 2 + this.velocity.z ** 2;
      const after2 = vx * vx + vz * vz;
      const s = after2 > before2 && after2 > 0 ? Math.sqrt(before2 / after2) : 1;
      this.velocity.x = vx * s;
      this.velocity.z = vz * s;
    }

    // --- Vertikale Bewegung, Boden und Decke
    const wasOnGround = this.onGround;
    const fallSpeed = -this.velocity.y;
    const prevY = this.position.y;
    this.position.y += this.velocity.y * dt;
    const ground = this.collision.groundHeight(
      this.position.x, this.position.z, Math.max(prevY, this.position.y) + stepUp, this.radius * 0.8
    );
    const groundTag = this.collision.lastGroundTag;
    if (this.position.y <= ground) {
      this.position.y = ground;
      this.velocity.y = 0;
      this.onGround = true;
    } else if (wasOnGround && this.velocity.y <= 0 && this.position.y - ground < 0.42) {
      // Treppe/Stufe hinunter: am Boden "kleben" statt zu springen
      this.position.y = ground;
      this.velocity.y = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }
    if (this.onGround) {
      this.groundTag = groundTag;
      this.groundSurface = this.collision.lastGroundBlock?.surface ?? null;
    }
    if (this.onGround && !wasOnGround && fallSpeed > 2.5) {
      if (this.active) this.onLand?.(this.groundTag, Math.min(1.5, fallSpeed / 6), this.groundSurface);
      this._stepDistance = 0;
    }

    const ceiling = this.collision.ceilingHeight(
      this.position.x, this.position.z, prevY + this.height - 0.02, this.radius * 0.9
    );
    if (this.position.y + this.height > ceiling) {
      this.position.y = Math.max(prevY, ceiling - this.height);
      if (this.velocity.y > 0) this.velocity.y = 0;
    }

    if (this.position.y < -10) this.respawn();

    // --- Schritte zählen (für Geräusche)
    if (this.active && this.onGround && moved > 0.001 && len > 0) {
      this._stepDistance += moved;
      // Ein hörbarer Kontakt pro Schritt, kein zusätzliches Fersen-/Zehen-Doppeln.
      // Bei 2,6 m/s ca. 2,5 Schritte/s; Sprint ca. 3,3 statt bisher knapp 6/s.
      const stride = crouched ? 0.72 : running ? 1.5 : 1.04;
      if (this._stepDistance >= stride) {
        this._stepDistance -= stride;
        this.onStep?.(this.groundTag, crouched ? 0.38 : running ? 1.12 : 0.8, this.groundSurface);
      }
    } else {
      this._stepDistance = 0;
    }

    // --- Kamera & Lupen-Zoom (Z gedrückt halten)
    const wantZoom = k.has('KeyZ');
    const zoomTarget = wantZoom ? 1 : 0;
    this.zoom += (zoomTarget - this.zoom) * Math.min(1, dt * 12);
    if (Math.abs(this.zoom - zoomTarget) < 0.002) this.zoom = zoomTarget;

    if (this.onGround) {
      this.viewY += (this.position.y - this.viewY) * Math.min(1, dt * 14);
    } else {
      this.viewY = this.position.y;
    }
    const hSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    let bob = 0;
    if (this.onGround && hSpeed > 0.4) {
      this.bobPhase += dt * hSpeed * 2.3;
      bob = Math.sin(this.bobPhase * 2) * 0.018 * Math.min(1, hSpeed / this.walkSpeed) * (1 - 0.7 * this.zoom);
    }
    this.camera.position.set(this.position.x, this.viewY + this.eyeHeight + bob, this.position.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');

    const baseTargetFov = this.baseFov + (running && hSpeed > 3 ? 5 : 0);
    const targetFov = baseTargetFov + (this.zoomFov - baseTargetFov) * this.zoom;
    if (Math.abs(this.camera.fov - targetFov) > 0.01) {
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * (wantZoom || this.zoom > 0.005 ? 12 : 6));
      this.camera.updateProjectionMatrix();
    }
  }
}

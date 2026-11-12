// Gegenstände aufheben, tragen und wieder abstellen (E).
// Getragene Objekte schweben vor der Kamera; beim Ablegen landen sie auf der
// höchsten Fläche unter dem Zielpunkt (Boden, Tisch, Arbeitsplatte …).
import * as THREE from 'three';
import { surfaceFor } from './audio.js';

const _fwd = new THREE.Vector3();

export class CarrySystem {
  constructor({ camera, collision, interactions, audio }) {
    this.camera = camera;
    this.collision = collision;
    this.interactions = interactions;
    this.audio = audio;
    this.items = [];
    this.holding = null;
  }

  /**
   * object: bereits in der Welt platziertes Objekt (Ursprung = Unterseite Mitte)
   * size: { w, h, d } für die Kollision (w entlang lokal x, d entlang lokal z)
   * solid: ob man das Objekt als Hindernis/Fläche behandeln soll (z. B. Kiste)
   */
  register(object, { id, name, size, solid = false, holdDistance = 0.75 }) {
    const item = { object, id, name, size, solid, holdDistance, block: null };
    if (solid) {
      item.block = this.collision.add({
        x: object.position.x, z: object.position.z, w: size.w, d: size.d, rot: object.rotation.y,
        bottom: object.position.y, top: object.position.y + size.h, tag: 'kiste', id,
      });
    }
    this.items.push(item);
    this.interactions.register(object, {
      id, type: 'carry',
      label: () => `${name} aufheben`,
      onInteract: () => this.pickUp(item),
    });
    return item;
  }

  pickUp(item) {
    if (this.holding) return;
    this.holding = item;
    if (item.block) item.block.enabled = false;
    item.object.traverse((o) => { o.userData.held = true; });
    this.audio?.pickup();
  }

  /** Ablegen vor dem Spieler. playerYaw dreht das Objekt passend mit. */
  drop(player) {
    const item = this.holding;
    if (!item) return;
    this.camera.getWorldDirection(_fwd);
    _fwd.y = 0;
    if (_fwd.lengthSq() < 1e-6) _fwd.set(0, 0, -1);
    _fwd.normalize();
    const eye = this.camera.position;
    let dist = item.holdDistance + 0.15;
    let x = eye.x + _fwd.x * dist, z = eye.z + _fwd.z * dist;
    // Nicht in Wände stellen: Zielpunkt zurückziehen, bis er frei ist
    for (let i = 0; i < 6; i++) {
      const probe = { x, z };
      const r = Math.max(item.size.w, item.size.d) * 0.45;
      if (!this.collision.resolve(probe, r, eye.y - 0.3, 0.2, 0)) break;
      dist -= 0.1;
      x = eye.x + _fwd.x * dist;
      z = eye.z + _fwd.z * dist;
    }
    let ground = this.collision.groundHeight(x, z, eye.y - 0.2, 0.05);
    if (!Number.isFinite(ground)) ground = player.position.y;
    const o = item.object;
    o.position.set(x, ground, z);
    o.rotation.set(0, player.yaw, 0);
    o.traverse((c) => { c.userData.held = false; });
    if (item.block) {
      this.collision.update(item.block, { x, z, rot: player.yaw, bottom: ground, top: ground + item.size.h });
      item.block.enabled = true;
    }
    this.holding = null;
    this.audio?.drop(surfaceFor(this.collision.lastGroundTag));
  }

  update() {
    const item = this.holding;
    if (!item) return;
    this.camera.getWorldDirection(_fwd);
    const o = item.object;
    const eye = this.camera.position;
    o.position.set(
      eye.x + _fwd.x * item.holdDistance,
      eye.y + _fwd.y * item.holdDistance - 0.28 - item.size.h * 0.4,
      eye.z + _fwd.z * item.holdDistance
    );
    o.rotation.set(0, Math.atan2(-_fwd.x, -_fwd.z), 0);
  }
}

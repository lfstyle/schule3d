// Einfaches, eigenes Kollisionssystem.
//
// Die Welt besteht aus "Blöcken": gedrehte Rechtecke im Grundriss (x/z) mit einer
// Unter- und Oberkante (y). Ein Block kann auch eine Rampe sein (Oberkante steigt
// linear entlang seiner lokalen z-Achse) – so werden Treppen begehbar.
//
// Für den Spieler (Zylinder) gilt:
//   * Oberkante <= Füße + Stufenhöhe  -> begehbar (Boden, Stufe)
//   * Unterkante >= Kopf             -> darüber (z. B. Empore), keine Kollision
//   * sonst                          -> Hindernis, der Spieler wird herausgeschoben
//
// Räumliche Vorauswahl: Jeder Block steht in allen Zellen eines 2-m-Rasters (x/z), die sein
// achsparalleler Hüllquader berührt; sehr große Blöcke (Böden, Decken) in einer eigenen Liste.
// Abfragen prüfen nur diese Kandidaten – in der ursprünglichen Reihenfolge (Einfügeindex), mit
// denselben genauen Berechnungen wie vorher. Ändern sich Lage oder Größe eines Blocks, muss das
// über update() geschehen (enabled darf direkt umgeschaltet werden, es wird bei der Abfrage geprüft).
import * as THREE from 'three';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const CELL = 2;           // Rastergröße in Metern
const LARGE = 48;         // ab so vielen Zellen gilt ein Block als groß (immer Kandidat)
const key = (ix, iz) => (ix + 32768) * 65536 + (iz + 32768);

export class CollisionWorld {
  static CELL = CELL;

  constructor() {
    this.blocks = [];
    this._cells = new Map();
    this._large = [];
    this._stamp = 0;
    this._order = 0;
    this._list = [];
  }

  /**
   * Block hinzufügen.
   * @param {object} o  x, z = Mittelpunkt; w, d = Breite/Tiefe (lokal); rot = Drehung um Y
   *                    bottom, top = Höhe; slope = { h0, h1 } für Rampen (lokal -d/2 -> +d/2)
   */
  add({ x, z, w, d, rot = 0, bottom = 0, top = 1, slope = null, id = null, enabled = true, tag = null, surface = null }) {
    const b = {
      x, z, hw: w / 2, hd: d / 2, rot,
      cos: Math.cos(rot), sin: Math.sin(rot),
      bottom, top, slope, id, enabled, tag, surface,
    };
    b.radius = Math.hypot(b.hw, b.hd);
    b.maxTop = slope ? Math.max(slope.h0, slope.h1) : top;
    b.order = this._order++;
    b.stamp = 0;
    this.blocks.push(b);
    this._insert(b);
    return b;
  }

  /** Achsparalleler Block über Minimum/Maximum. */
  addBox(minX, minZ, maxX, maxZ, bottom, top, extra = {}) {
    return this.add({
      x: (minX + maxX) / 2, z: (minZ + maxZ) / 2,
      w: maxX - minX, d: maxZ - minZ, bottom, top, ...extra,
    });
  }

  /** Block aus der Bounding Box eines Objekts (für Möbel). */
  addObject(object, { pad = 0, bottom, top, ...extra } = {}) {
    object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(object);
    return this.addBox(
      box.min.x - pad, box.min.z - pad, box.max.x + pad, box.max.z + pad,
      bottom ?? box.min.y, top ?? box.max.y, extra
    );
  }

  remove(block) {
    const i = this.blocks.indexOf(block);
    if (i < 0) return;
    this.blocks.splice(i, 1);
    this._erase(block);
  }

  // ---- Raster
  // Zellbereich des Hüllquaders (gedrehtes Rechteck), minimal vergrößert gegen Rundung an Zellgrenzen.
  _range(b) {
    const ex = Math.abs(b.cos) * b.hw + Math.abs(b.sin) * b.hd + 1e-6;
    const ez = Math.abs(b.sin) * b.hw + Math.abs(b.cos) * b.hd + 1e-6;
    return [Math.floor((b.x - ex) / CELL), Math.floor((b.z - ez) / CELL), Math.floor((b.x + ex) / CELL), Math.floor((b.z + ez) / CELL)];
  }

  _insert(b) {
    const r = this._range(b);
    b.cells = r;
    if ((r[2] - r[0] + 1) * (r[3] - r[1] + 1) > LARGE) { b.large = true; this._large.push(b); this._large.sort((p, q) => p.order - q.order); return; }
    b.large = false;
    for (let ix = r[0]; ix <= r[2]; ix++) for (let iz = r[1]; iz <= r[3]; iz++) {
      const k = key(ix, iz);
      let list = this._cells.get(k);
      if (!list) this._cells.set(k, list = []);
      list.push(b);
    }
  }

  _erase(b) {
    if (b.large) { this._large.splice(this._large.indexOf(b), 1); return; }
    const r = b.cells;
    for (let ix = r[0]; ix <= r[2]; ix++) for (let iz = r[1]; iz <= r[3]; iz++) {
      const list = this._cells.get(key(ix, iz));
      list.splice(list.indexOf(b), 1);
    }
  }

  /** Für Prüfungen: stimmt das Raster mit Lage/Größe aller Blöcke überein? (deckt Änderungen an x/z/rot ohne update() auf) */
  checkGrid() {
    const wrong = [];
    for (const b of this.blocks) {
      const r = this._range(b), c = b.cells, large = (r[2] - r[0] + 1) * (r[3] - r[1] + 1) > LARGE;
      let ok = r.every((v, i) => v === c[i]) && large === b.large;
      if (ok && large) ok = this._large.includes(b);
      if (ok && !large) for (let ix = r[0]; ix <= r[2] && ok; ix++) for (let iz = r[1]; iz <= r[3] && ok; iz++) ok = !!this._cells.get(key(ix, iz))?.includes(b);
      if (!ok) wrong.push(b.tag ?? b.id ?? b.order);
    }
    let entries = this._large.length; for (const list of this._cells.values()) entries += list.length;
    return { ok: wrong.length === 0, wrong, cells: this._cells.size, large: this._large.length, entries };
  }

  /** Kandidaten, deren Hüllquader das Rechteck [x0,x1]×[z0,z1] berühren könnten – sortiert wie this.blocks. */
  _query(x0, z0, x1, z1) {
    const out = this._list;
    out.length = 0;
    const stamp = ++this._stamp;
    const ax = Math.floor(x0 / CELL), az = Math.floor(z0 / CELL), bx = Math.floor(x1 / CELL), bz = Math.floor(z1 / CELL);
    for (let ix = ax; ix <= bx; ix++) for (let iz = az; iz <= bz; iz++) {
      const list = this._cells.get(key(ix, iz));
      if (!list) continue;
      for (const b of list) if (b.stamp !== stamp) { b.stamp = stamp; out.push(b); }
    }
    for (const b of this._large) out.push(b);
    if (out.length > 1) out.sort((p, q) => p.order - q.order);
    return out;
  }

  // Welt -> lokal (Umkehrung von THREE.rotateY)
  _local(b, x, z) {
    const dx = x - b.x, dz = z - b.z;
    return [dx * b.cos - dz * b.sin, dx * b.sin + dz * b.cos];
  }

  _toWorldDir(b, lx, lz) {
    return [lx * b.cos + lz * b.sin, -lx * b.sin + lz * b.cos];
  }

  _topAt(b, lz) {
    if (!b.slope) return b.top;
    const t = clamp((lz + b.hd) / (2 * b.hd), 0, 1);
    return b.slope.h0 + (b.slope.h1 - b.slope.h0) * t;
  }

  /**
   * Höchste begehbare Fläche unter (x, z), deren Oberkante <= maxTop ist.
   * radius > 0: zählt auch Flächen, die nur von der "Fußfläche" (Kreis) berührt werden –
   * so landet man auf Tischkanten, statt abzurutschen.
   */
  groundHeight(x, z, maxTop, radius = 0) {
    let best = -Infinity;
    let bestBlock = null;
    const r2 = radius * radius;
    for (const b of this._query(x - radius, z - radius, x + radius, z + radius)) {
      if (!b.enabled) continue;
      const [lx, lz] = this._local(b, x, z);
      const cx = clamp(lx, -b.hw, b.hw), cz = clamp(lz, -b.hd, b.hd);
      const ox = lx - cx, oz = lz - cz;
      if (ox * ox + oz * oz > r2) continue;
      const top = this._topAt(b, cz);
      if (top <= maxTop && top > best) { best = top; bestBlock = b; }
    }
    // Merkt sich, worauf man steht (für Schrittgeräusche)
    this.lastGroundBlock = bestBlock;
    this.lastGroundTag = bestBlock?.tag ?? null;
    return best;
  }

  /** Niedrigste Unterkante über (x, z), die >= minBottom liegt (Decke für Sprung/Aufstehen). */
  ceilingHeight(x, z, minBottom, radius = 0) {
    let best = Infinity;
    const r2 = radius * radius;
    for (const b of this._query(x - radius, z - radius, x + radius, z + radius)) {
      if (!b.enabled || b.bottom < minBottom) continue;
      const [lx, lz] = this._local(b, x, z);
      const ox = lx - clamp(lx, -b.hw, b.hw), oz = lz - clamp(lz, -b.hd, b.hd);
      if (ox * ox + oz * oz > r2) continue;
      if (b.bottom < best) best = b.bottom;
    }
    return best;
  }

  /** Block verschieben/ändern (z. B. abgestellte Kiste, verschobener Stuhl). */
  update(b, { x = b.x, z = b.z, rot = b.rot, bottom = b.bottom, top = b.top } = {}) {
    Object.assign(b, { x, z, rot, bottom, top, cos: Math.cos(rot), sin: Math.sin(rot) });
    if (!b.slope) b.maxTop = top;
    const r = this._range(b), c = b.cells;
    if (r[0] !== c[0] || r[1] !== c[1] || r[2] !== c[2] || r[3] !== c[3]) { this._erase(b); this._insert(b); }
  }

  /**
   * Schiebt einen Kreis (Spieler) aus allen Hindernissen heraus.
   * pos: { x, z } wird direkt verändert.
   */
  resolve(pos, radius, feetY, height, stepUp) {
    let hit = false;
    const head = feetY + height;
    stepUp += 1e-4; // Rundungsfehler an Stufenkanten vermeiden
    // Kandidaten für ein Rechteck um den Startpunkt mit Rand; verlässt der Kreis es durch Herausschieben,
    // gilt für den Rest der Runde wieder die vollständige Liste (Ergebnis bleibt exakt gleich).
    const MARGIN = 0.5;
    for (let iter = 0; iter < 4; iter++) {
      let moved = false;
      const x0 = pos.x - radius - MARGIN, x1 = pos.x + radius + MARGIN, z0 = pos.z - radius - MARGIN, z1 = pos.z + radius + MARGIN;
      let list = this._query(x0, z0, x1, z1), from = 0;
      for (let i = 0; i < list.length; i++) {
        const b = list[i];
        if (!b.enabled) continue;
        if (b.bottom >= head - 0.01) continue;          // liegt über dem Kopf
        if (b.maxTop <= feetY + stepUp) continue;       // komplett begehbar
        const ddx = pos.x - b.x, ddz = pos.z - b.z;
        const reach = b.radius + radius;
        if (ddx * ddx + ddz * ddz > reach * reach) continue;

        const [lx, lz] = this._local(b, pos.x, pos.z);
        const cx = clamp(lx, -b.hw, b.hw);
        const cz = clamp(lz, -b.hd, b.hd);
        if (this._topAt(b, cz) <= feetY + stepUp) continue;

        const ox = lx - cx, oz = lz - cz;
        const dist2 = ox * ox + oz * oz;
        if (dist2 >= radius * radius) continue;

        let px, pz;
        if (dist2 > 1e-10) {
          const dist = Math.sqrt(dist2);
          const push = radius - dist + 1e-4;
          px = (ox / dist) * push;
          pz = (oz / dist) * push;
        } else {
          // Mittelpunkt steckt im Block: entlang der kürzesten Achse heraus
          const ex = b.hw - Math.abs(lx), ez = b.hd - Math.abs(lz);
          if (ex < ez) { px = (Math.sign(lx) || 1) * (ex + radius); pz = 0; }
          else { px = 0; pz = (Math.sign(lz) || 1) * (ez + radius); }
        }
        const [wx, wz] = this._toWorldDir(b, px, pz);
        pos.x += wx;
        pos.z += wz;
        moved = hit = true;
        if (list !== this.blocks && (pos.x - radius < x0 || pos.x + radius > x1 || pos.z - radius < z0 || pos.z + radius > z1)) {
          // Restliche Blöcke dieser Runde in Originalreihenfolge aus der vollständigen Liste
          const order = b.order;
          list = this.blocks; i = this.blocks.indexOf(b);
          if (this.blocks[i]?.order !== order) throw new Error('Kollision: Reihenfolge');
        }
      }
      if (!moved) break;
    }
    return hit;
  }
}

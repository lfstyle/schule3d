// Wegsuche für die Kamerafahrt des Rundgangs: A* auf einem 25-cm-Raster über die vorhandene CollisionWorld.
// Begehbar ist, was auch der Spieler begehen kann (Stufen bis 35 cm, abwärts bis 45 cm, Kopffreiheit 1,7 m).
// Bedienbare Türen (Kollider mit Tag „tuer“ und einer Tür-Interaktion) gelten als offen; die Fahrt öffnet sie
// unterwegs. Geschlossene, nicht bedienbare Türen bleiben Hindernisse. Die Suche läuft in Zeitscheiben (step).
const STEP = 0.25;
const CLEAR = 0.3;          // Mindestabstand der Kamera zu Wänden/Möbeln
const ROOMY = 0.55;         // darunter wird der Weg teurer (Mitte von Gängen bevorzugen)
const STEP_UP = 0.36, STEP_DOWN = 0.45, HEIGHT = 1.7;
const MAX_NODES = 160000;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

class Heap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(n) {
    const a = this.a; a.push(n);
    for (let i = a.length - 1; i > 0;) { const p = (i - 1) >> 1; if (a[p].f <= a[i].f) break; [a[p], a[i]] = [a[i], a[p]]; i = p; }
  }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      for (let i = 0; ;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]]; i = m;
      }
    }
    return top;
  }
}

export class TourPath {
  /** from/to: Fußpunkte { x, y, z }. */
  constructor(collision, interactions, from, to) {
    Object.assign(this, { collision, interactions, from, to });
    this.doors = collision.blocks.filter((b) => b.tag === 'tuer' && b.id && interactions.get(b.id)?.type === 'door');
    this.pos = { x: 0, z: 0 };
    this.done = false;
    this.result = null;
    this.nodes = 0;
    const y0 = this._ground(from.x, from.z, from.y);
    const start = { ix: Math.round(from.x / STEP), iz: Math.round(from.z / STEP), y: Number.isFinite(y0) ? y0 : from.y, g: 0, parent: null };
    start.f = this._h(start);
    this.open = new Heap();
    this.open.push(start);
    this.best = new Map([[this._key(start), start]]);
    this.closed = new Set();
    this.clearCache = new Map();
  }

  _key(n) { return `${n.ix},${n.iz},${Math.round(n.y * 10)}`; }
  _h(n) { return Math.hypot(n.ix * STEP - this.to.x, n.iz * STEP - this.to.z) + Math.abs(n.y - this.to.y) * 1.5; }

  // Türen nur während der Abfragen durchlässig machen; danach wieder wie vorher.
  _withDoors(fn) {
    const saved = this.doors.map((b) => b.enabled);
    for (const b of this.doors) b.enabled = false;
    try { return fn(); } finally { this.doors.forEach((b, i) => { b.enabled = saved[i]; }); }
  }

  _ground(x, z, y) {
    const h = this.collision.groundHeight(x, z, y + STEP_UP, 0.1);
    return h >= y - STEP_DOWN ? h : -Infinity;
  }

  _clear(x, z, y, r) {
    const p = this.pos; p.x = x; p.z = z;
    return !this.collision.resolve(p, r, y, HEIGHT, STEP_UP);
  }

  /** Sucht höchstens budgetMs weiter. Ergebnis in this.result (Punktliste) oder null, wenn kein Weg. */
  step(budgetMs = 6) {
    if (this.done) return true;
    const t0 = performance.now();
    this._withDoors(() => {
      while (this.open.size && performance.now() - t0 < budgetMs) {
        for (let k = 0; k < 64 && this.open.size; k++) {
          const n = this.open.pop(), key = this._key(n);
          if (this.closed.has(key)) continue;
          this.closed.add(key);
          if (Math.hypot(n.ix * STEP - this.to.x, n.iz * STEP - this.to.z) < 0.45 && Math.abs(n.y - this.to.y) < 0.5) { this._finish(n); return; }
          if (++this.nodes > MAX_NODES) { this.done = true; return; }
          for (const [dx, dz] of DIRS) {
            const ix = n.ix + dx, iz = n.iz + dz, x = ix * STEP, z = iz * STEP;
            const y = this._ground(x, z, n.y);
            if (!Number.isFinite(y)) continue;
            const m = { ix, iz, y };
            const mk = this._key(m);
            if (this.closed.has(mk)) continue;
            let c = this.clearCache.get(mk);
            if (c === undefined) {
              c = !this._clear(x, z, y, CLEAR) ? 0 : this._clear(x, z, y, ROOMY) ? 1 : 2;
              this.clearCache.set(mk, c);
            }
            if (!c) continue;
            // Diagonal nur, wenn beide Nachbarn frei sind (keine Ecken schneiden).
            if (dx && dz && (!this._clear(n.ix * STEP + dx * STEP, n.iz * STEP, n.y, CLEAR) || !this._clear(n.ix * STEP, n.iz * STEP + dz * STEP, n.y, CLEAR))) continue;
            const g = n.g + Math.hypot(dx * STEP, dz * STEP, y - n.y) * (c === 2 ? 1.6 : 1);
            const old = this.best.get(mk);
            if (old && old.g <= g) continue;
            m.g = g; m.parent = n; m.f = g + this._h(m);
            this.best.set(mk, m);
            this.open.push(m);
          }
        }
      }
      if (!this.open.size) this.done = true;
    });
    return this.done;
  }

  _finish(end) {
    const raw = [];
    for (let n = end; n; n = n.parent) raw.push({ x: n.ix * STEP, y: n.y, z: n.iz * STEP });
    raw.reverse();
    raw[0] = { ...this.from, y: raw[0].y };
    raw.push({ ...this.to });
    this.result = this._smooth(raw);
    this.done = true;
  }

  // Strecke a→b ohne Hindernis und mit durchgehendem Boden?
  _line(a, b) {
    const len = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(len / 0.15));
    let y = a.y;
    for (let i = 1; i <= n; i++) {
      const t = i / n, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
      y = this._ground(x, z, y);
      if (!Number.isFinite(y) || !this._clear(x, z, y, CLEAR + 0.05)) return false;
    }
    return Math.abs(y - b.y) < 0.3;
  }

  // Ecken abkürzen (String Pulling), dann gleichmäßig dicht abtasten und Höhen glätten.
  _smooth(raw) {
    const keys = [raw[0]];
    for (let i = 0; i < raw.length - 1;) {
      let j = i + 1;
      while (j + 1 < raw.length && Math.hypot(raw[j + 1].x - raw[i].x, raw[j + 1].z - raw[i].z) < 14 && this._line(raw[i], raw[j + 1])) j++;
      keys.push(raw[j]);
      i = j;
    }
    // Catmull-Rom durch die Eckpunkte (läuft durch die geprüften Punkte), alle 10 cm ein Punkt. Wölbt sich ein
    // Abschnitt in ein Hindernis (z. B. Türzarge), wird er gerade gefahren.
    const dense = [];
    for (let i = 0; i < keys.length - 1; i++) {
      const p0 = keys[Math.max(0, i - 1)], p1 = keys[i], p2 = keys[i + 1], p3 = keys[Math.min(keys.length - 1, i + 2)];
      const n = Math.max(2, Math.ceil(Math.hypot(p2.x - p1.x, p2.z - p1.z) / 0.1));
      const curve = [];
      let gy = p1.y, ok = true;
      for (let k = 0; k < n; k++) {
        const t = k / n, t2 = t * t, t3 = t2 * t;
        const cr = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        const q = { x: cr(p0.x, p1.x, p2.x, p3.x), z: cr(p0.z, p1.z, p2.z, p3.z), y: p1.y + (p2.y - p1.y) * t };
        const g = this._ground(q.x, q.z, gy);
        if (Number.isFinite(g)) gy = g;
        if (ok && k && !this._clear(q.x, q.z, gy, CLEAR - 0.04)) ok = false;
        curve.push(q);
      }
      if (ok) dense.push(...curve);
      else for (let k = 0; k < n; k++) { const t = k / n; dense.push({ x: p1.x + (p2.x - p1.x) * t, z: p1.z + (p2.z - p1.z) * t, y: p1.y + (p2.y - p1.y) * t }); }
    }
    dense.push({ ...keys[keys.length - 1] });
    // Höhe aus dem Boden (Treppen), dann gleitend mitteln, damit Stufenkanten nicht ruckeln.
    let y = dense[0].y;
    for (const p of dense) { const g = this._ground(p.x, p.z, y); if (Number.isFinite(g)) y = g; p.y = y; }
    const ys = dense.map((p) => p.y);
    dense.forEach((p, i) => { let s = 0, c = 0; for (let k = Math.max(0, i - 5); k <= Math.min(ys.length - 1, i + 5); k++) { s += ys[k]; c++; } p.y = s / c; });
    // Bogenlänge und durchquerte Türen (Position entlang des Wegs)
    let s = 0;
    dense.forEach((p, i) => { if (i) s += Math.hypot(p.x - dense[i - 1].x, p.z - dense[i - 1].z, p.y - dense[i - 1].y); p.s = s; });
    const doors = new Map();
    for (const p of dense) for (const b of this.doors) {
      if (doors.has(b.id) || p.y + 1 < b.bottom || p.y > b.top) continue;
      const dx = p.x - b.x, dz = p.z - b.z, lx = dx * b.cos - dz * b.sin, lz = dx * b.sin + dz * b.cos;
      if (Math.abs(lx) < b.hw + 0.3 && Math.abs(lz) < b.hd + 0.3) doors.set(b.id, p.s);
    }
    return { points: dense, length: s, doors: [...doors].map(([id, at]) => ({ id, at })), corners: keys.length };
  }
}

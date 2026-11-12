// Übersichtskarte (Taste M): Grundriss aller Räume + eigene Position.
// Räume liefern ihre Kartendaten selbst – neue Räume erscheinen automatisch.

const FLOORS = [
  { tab: 'EG', name: 'Schule / Hof' },
  { tab: 'OG', name: 'Flur 3 · Flur 4 · Sekretariat' },
  { tab: '3. OG', name: 'Flur 5 · 312 – 319' },
];
const FONT = 'system-ui, sans-serif';
const HALO = 'rgba(16,18,22,0.9)';
const STATION = '#e6c46a', INFO = '#8cc8ff', PLAYER = '#e8565f';

export class Minimap {
  constructor(canvas, world) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.world = world;
    this.mode = 1; // 0 = aus, 1 = klein, 2 = groß
    this.floor = null; // null = automatisch; Geschosswahl nur in der Übersicht
    this.localSpan = 24; // Meter, unabhängig von der wachsenden Gesamtkarte
    this._apply();
  }

  cycle() {
    this.mode = (this.mode + 1) % 3;
    this._apply();
  }

  cycleFloor() {
    if (this.mode !== 2) return;
    const levels = this.world.levels ?? [0, 1];
    const i = this.floor === null ? -1 : levels.indexOf(this.floor);
    this.floor = i + 1 < levels.length ? levels[i + 1] : null;
  }

  _apply() {
    this.canvas.classList.toggle('hidden', this.mode === 0);
    this.canvas.classList.toggle('large', this.mode === 2);
    // Übersicht: fast bildschirmfüllend und so breit wie möglich (das EG ist doppelt so breit wie tief).
    const w = this.mode === 2 ? Math.min(window.innerWidth * 0.92, 1200) : 200;
    const h = this.mode === 2 ? Math.min(window.innerHeight * 0.86, 800) : 200;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.style.width = `${Math.round(w)}px`;
    this.canvas.style.height = `${Math.round(h)}px`;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
  }

  resize() {
    this._apply();
  }

  // EG-Übersicht: nur der bebaute Bereich mit Wegen (Flächen), nicht die weit entfernten Nachbarhäuser.
  _overviewBounds(level) {
    if (level > 0) return this.world.levelBounds[level];
    if (!this._eg) {
      const b = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity }, all = this.world.bounds;
      for (const a of this.world.mapByFloor[0].areas) for (const [x, z] of a.poly) {
        b.minX = Math.min(b.minX, x); b.maxX = Math.max(b.maxX, x); b.minZ = Math.min(b.minZ, z); b.maxZ = Math.max(b.maxZ, z);
      }
      this._eg = isFinite(b.minX) ? {
        minX: Math.max(all.minX, b.minX - 1.5), maxX: Math.min(all.maxX, b.maxX + 1.5),
        minZ: Math.max(all.minZ, b.minZ - 1.5), maxZ: Math.min(all.maxZ, b.maxZ + 1.5),
      } : all;
    }
    return this._eg;
  }

  draw(player) {
    if (this.mode === 0) return;
    const g = this.ctx, k = this.dpr, large = this.mode === 2;
    const W = this.canvas.width, H = this.canvas.height;
    const playerLevel = this.world.mapLevel(player.position);
    const level = large && this.floor !== null ? this.floor : playerLevel;
    const half = this.localSpan / 2;
    const b = large ? this._overviewBounds(level) : {
      minX: player.position.x-half, maxX: player.position.x+half,
      minZ: player.position.z-half, maxZ: player.position.z+half,
    };
    // Kartenfläche zwischen Kopf- und Fußzeile.
    const top = (large ? 40 : 26) * k, bottom = (large ? 34 : 22) * k;
    const pad = (large ? 18 : 0) * k;
    const mapW = W - pad * 2, mapH = H - top - bottom - pad * 2;
    const scale = Math.min(mapW / (b.maxX - b.minX), mapH / (b.maxZ - b.minZ));
    const ox = pad + (mapW - (b.maxX - b.minX) * scale) / 2 - b.minX * scale;
    const oz = top + pad + (mapH - (b.maxZ - b.minZ) * scale) / 2 - b.minZ * scale;
    const X = (x) => ox + x * scale, Z = (z) => oz + z * scale;

    g.clearRect(0, 0, W, H);
    g.fillStyle = large ? '#121418' : 'rgba(18,20,24,0.8)';
    g.fillRect(0, 0, W, H);
    g.save();
    g.beginPath();
    g.rect(0, top, W, H - top - bottom);
    g.clip();

    const map = this.world.mapByFloor[level];
    const upstairs = player.position.y > 1.8;
    for (const a of map.areas) {
      g.beginPath();
      a.poly.forEach(([x, z], i) => (i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z))));
      g.closePath();
      const highlight = a.level === 'oben' ? upstairs : !upstairs;
      g.fillStyle = a.fill ?? 'rgba(255,255,255,0.08)';
      if (a.level === 'oben') g.fillStyle = upstairs ? 'rgba(181,72,79,0.35)' : 'rgba(181,72,79,0.12)';
      g.fill();
      if (a.dashed) {
        g.setLineDash([4 * k, 3 * k]);
        g.strokeStyle = highlight ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.35)';
        g.lineWidth = k;
        g.stroke();
        g.setLineDash([]);
      }
    }
    g.fillStyle = 'rgba(255,255,255,0.16)';
    for (const r of map.furniture) g.fillRect(X(r[0]), Z(r[1]), (r[2] - r[0]) * scale, (r[3] - r[1]) * scale);

    g.strokeStyle = 'rgba(255,255,255,0.9)';
    g.lineWidth = (large ? 1.6 : 1.8) * k;
    g.lineCap = 'round';
    g.beginPath();
    for (const [x0, z0, x1, z1] of map.walls) {
      g.moveTo(X(x0), Z(z0));
      g.lineTo(X(x1), Z(z1));
    }
    g.stroke();

    // Rundgang-Stationen (Nummern) und Info-Punkte (nur in der Übersicht) der gezeigten Ebene.
    const markers = (this.markers?.() ?? []).filter((m) =>
      (m.kind !== 'info' || large) && (m.level ??= this.world.mapLevel(m)) === level);
    const stationR = (large ? 8 : 6.5) * k, infoR = 4 * k;
    // Belegte Flächen: Beschriftungen weichen Markierungen und dem eigenen Pfeil aus.
    const taken = markers.map((m) => {
      const r = m.kind === 'station' ? stationR : infoR;
      return { x0: X(m.x) - r, x1: X(m.x) + r, y0: Z(m.z) - r, y1: Z(m.z) + r };
    });
    if (level === playerLevel) {
      const px = X(player.position.x), pz = Z(player.position.z), r = 10 * k;
      taken.push({ x0: px - r, x1: px + r, y0: pz - r, y1: pz + r });
    }
    this._labels(g, map.labels, X, Z, taken, { size: (large ? 12.5 : 10.5) * k, W, top, bottom: H - bottom });

    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `700 ${Math.round((large ? 10.5 : 9) * k)}px ${FONT}`;
    for (const m of markers.sort((a, b) => (a.kind === 'station') - (b.kind === 'station'))) {
      const station = m.kind === 'station', x = X(m.x), z = Z(m.z);
      g.beginPath();
      g.arc(x, z, station ? stationR : infoR, 0, Math.PI * 2);
      g.fillStyle = station ? (m.current ? STATION : 'rgba(230,196,106,0.85)') : INFO;
      g.fill();
      g.lineWidth = 1.5 * k;
      g.strokeStyle = m.current ? '#fff' : HALO;
      g.stroke();
      if (m.label) { g.fillStyle = '#1b1c1f'; g.fillText(m.label, x, z + 0.5 * k); }
    }
    g.textBaseline = 'alphabetic';

    // Spieler nur im tatsächlichen Geschoss anzeigen: kleiner Pfeil mit Blickfeld.
    if (level === playerLevel) {
      const s = (large ? 8 : 7) * k, view = (large ? 34 : 26) * k;
      g.save();
      g.translate(X(player.position.x), Z(player.position.z));
      g.rotate(-player.yaw);
      const cone = g.createRadialGradient(0, 0, 0, 0, 0, view);
      cone.addColorStop(0, 'rgba(255,255,255,0.32)');
      cone.addColorStop(1, 'rgba(255,255,255,0)');
      g.beginPath();
      g.moveTo(0, 0);
      g.arc(0, 0, view, -Math.PI / 2 - 0.6, -Math.PI / 2 + 0.6);
      g.closePath();
      g.fillStyle = cone;
      g.fill();
      g.beginPath();
      g.moveTo(0, -s);
      g.lineTo(s * 0.68, s * 0.72);
      g.lineTo(0, s * 0.36);
      g.lineTo(-s * 0.68, s * 0.72);
      g.closePath();
      g.lineJoin = 'round';
      g.fillStyle = PLAYER;
      g.fill();
      g.strokeStyle = '#fff';
      g.lineWidth = 1.5 * k;
      g.stroke();
      g.restore();
    }

    if (large) this._scaleBar(g, scale, pad, H - bottom - pad * 0.4);
    g.restore();

    this._header(g, { large, level, playerLevel, player, W, top });
    this._footer(g, { large, level, playerLevel, W, H, bottom });
    this.lastView = { level, playerLevel, bounds: b, scale, playerVisible: level === playerLevel };
  }

  // Raumnamen mit dunklem Rand, ohne Überlappung: erst an der eigentlichen Stelle, sonst leicht versetzt.
  // Findet sich kein freier Platz (sehr enge Karte), entfällt die Beschriftung; Treppenhinweise (↑/↓) zuletzt.
  _labels(g, labels, X, Z, taken, { size, W, top, bottom }) {
    const k = this.dpr;
    g.font = `600 ${Math.round(size)}px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    const placed = [...taken];
    const overlap = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
    const minor = (l) => /^[↑↓]/.test(l.text);
    for (const l of [...labels].sort((a, b) => minor(a) - minor(b))) {
      const w = g.measureText(l.text).width + 6 * k, h = size * 1.25;
      let x = X(l.x), y = Z(l.z);
      if (x < 0 || x > W || y < top || y > bottom) continue;
      // Am Kartenrand nach innen schieben statt abschneiden.
      x = Math.min(Math.max(x, w / 2), W - w / 2);
      y = Math.min(Math.max(y, top + h / 2), bottom - h / 2);
      let best = null;
      for (const [dx, dy] of [[0, 0], [0, -h], [0, h], [w * 0.55, 0], [-w * 0.55, 0]]) {
        const box = { x0: x + dx - w / 2, x1: x + dx + w / 2, y0: y + dy - h / 2, y1: y + dy + h / 2 };
        const cost = placed.reduce((s, p) => s + overlap(box, p), 0) + Math.hypot(dx, dy) * 0.01;
        if (!best || cost < best.cost) best = { box, cost, x: x + dx, y: y + dy };
        if (cost < 1) break;
      }
      if (best.cost >= 1) continue;
      placed.push(best.box);
      g.lineWidth = 3.5 * k;
      g.strokeStyle = HALO;
      g.strokeText(l.text, best.x, best.y);
      g.fillStyle = minor(l) ? 'rgba(255,255,255,0.75)' : '#fff';
      g.fillText(l.text, best.x, best.y);
    }
    g.textBaseline = 'alphabetic';
  }

  _scaleBar(g, scale, x, y) {
    const k = this.dpr, metres = [2, 5, 10, 20].find((m) => m * scale >= 60 * k) ?? 20, len = metres * scale;
    g.strokeStyle = 'rgba(255,255,255,0.75)';
    g.lineWidth = 1.5 * k;
    g.beginPath();
    g.moveTo(x, y - 4 * k); g.lineTo(x, y); g.lineTo(x + len, y); g.lineTo(x + len, y - 4 * k);
    g.stroke();
    g.font = `${Math.round(11 * k)}px ${FONT}`;
    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.textAlign = 'left';
    g.fillText(`${metres} m`, x + len + 6 * k, y);
  }

  _header(g, { large, level, playerLevel, player, W, top }) {
    const k = this.dpr;
    g.fillStyle = 'rgba(16,18,22,0.96)';
    g.fillRect(0, 0, W, top);
    g.textBaseline = 'middle';
    g.textAlign = 'left';
    const y = top / 2;
    if (!large) {
      // Klein: Geschoss und aktueller Bereich, gekürzt auf die Kartenbreite.
      const area = this.world.areaName?.(player.position);
      g.font = `700 ${Math.round(12 * k)}px ${FONT}`;
      g.fillStyle = '#fff';
      const tab = FLOORS[level]?.tab ?? 'OG';
      g.fillText(tab, 9 * k, y);
      if (area) {
        const x = 9 * k + g.measureText(tab).width + 7 * k;
        g.font = `${Math.round(11.5 * k)}px ${FONT}`;
        g.fillStyle = 'rgba(255,255,255,0.75)';
        g.fillText(this._fit(g, area, W - x - 8 * k), x, y);
      }
    } else {
      // Groß: Reiter für alle Geschosse; ausgewählt = hell, eigenes Geschoss mit rotem Punkt.
      let x = 12 * k;
      g.font = `700 ${Math.round(12.5 * k)}px ${FONT}`;
      for (const [i, f] of FLOORS.entries()) {
        const w = g.measureText(f.tab).width + (i === playerLevel ? 30 : 20) * k, h = 24 * k;
        g.beginPath();
        g.roundRect(x, y - h / 2, w, h, 6 * k);
        g.fillStyle = i === level ? '#f2f2f2' : 'rgba(255,255,255,0.1)';
        g.fill();
        g.fillStyle = i === level ? '#16181c' : 'rgba(255,255,255,0.8)';
        g.fillText(f.tab, x + 10 * k, y + 0.5 * k);
        if (i === playerLevel) {
          g.beginPath();
          g.arc(x + w - 11 * k, y, 3.5 * k, 0, Math.PI * 2);
          g.fillStyle = PLAYER;
          g.fill();
        }
        x += w + 6 * k;
      }
      g.font = `600 ${Math.round(13 * k)}px ${FONT}`;
      g.fillStyle = '#fff';
      const name = this._fit(g, FLOORS[level]?.name ?? '', W - x - 20 * k);
      g.fillText(name, x + 8 * k, y);
      x += g.measureText(name).width + 16 * k;
      if (this.floor === null) {
        g.font = `${Math.round(12 * k)}px ${FONT}`;
        g.fillStyle = 'rgba(255,255,255,0.55)';
        g.fillText(this._fit(g, '· folgt dir automatisch', W - x - 12 * k), x, y);
      }
    }
    g.textBaseline = 'alphabetic';
  }

  _footer(g, { large, level, playerLevel, W, H, bottom }) {
    const k = this.dpr, y = H - bottom / 2;
    g.fillStyle = 'rgba(16,18,22,0.96)';
    g.fillRect(0, H - bottom, W, bottom);
    g.textBaseline = 'middle';
    g.textAlign = 'left';
    if (!large) {
      g.font = `${Math.round(10.5 * k)}px ${FONT}`;
      g.fillStyle = 'rgba(255,255,255,0.75)';
      g.fillText('N ↑ · 24 m · M: Übersicht', 9 * k, y);
      g.textBaseline = 'alphabetic';
      return;
    }
    // Legende links, Tasten rechts.
    let x = 14 * k;
    g.font = `${Math.round(12 * k)}px ${FONT}`;
    const item = (draw, text) => {
      draw(x + 6 * k);
      g.fillStyle = 'rgba(255,255,255,0.8)';
      g.fillText(text, x + 16 * k, y);
      x += 16 * k + g.measureText(text).width + 18 * k;
    };
    item((cx) => {
      g.beginPath(); g.moveTo(cx, y - 6 * k); g.lineTo(cx + 4.5 * k, y + 5 * k); g.lineTo(cx, y + 2.5 * k); g.lineTo(cx - 4.5 * k, y + 5 * k); g.closePath();
      g.fillStyle = PLAYER; g.fill();
    }, level === playerLevel ? 'Du' : `Du bist im ${FLOORS[playerLevel]?.tab ?? 'OG'}`);
    item((cx) => { g.beginPath(); g.arc(cx, y, 5.5 * k, 0, Math.PI * 2); g.fillStyle = STATION; g.fill(); }, 'Station');
    item((cx) => { g.beginPath(); g.arc(cx, y, 4 * k, 0, Math.PI * 2); g.fillStyle = INFO; g.fill(); }, 'Info-Punkt');
    g.textAlign = 'right';
    g.fillStyle = 'rgba(255,255,255,0.6)';
    const keys = 'B: Geschoss wechseln · M: schließen';
    if (x + g.measureText(keys).width < W - 14 * k) g.fillText(keys, W - 14 * k, y);
    g.textBaseline = 'alphabetic';
  }

  _fit(g, text, width) {
    if (g.measureText(text).width <= width) return text;
    while (text.length > 1 && g.measureText(text + '…').width > width) text = text.slice(0, -1);
    return text.trimEnd() + '…';
  }
}

// Wiederverwendbare Schulobjekte.
//
// Zwei Varianten:
//   add*(builder, M, …)    -> fügt Teile in einen PartBuilder ein (statische, zusammengeführte Geometrie)
//   create*(M, …)          -> liefert ein eigenes Objekt (z. B. Prototyp für InstancedMesh oder Tür)
//
// Lokale Konventionen: Ursprung am Boden, Vorderseite zeigt nach +z, Breite entlang x.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { PartBuilder, matrixFrom, metricBoxUV, mergeMaterialGroups } from './geometry.js';
import { Toggle } from './animated.js';

// ======================================================================= Wände

/**
 * Wand mit Öffnungen (Fenster, Türen). Der Raum liegt LINKS der Laufrichtung start -> end.
 * openings: [{ u, w, y, h }] – u = Abstand vom Startpunkt, y = Unterkante.
 * Liefert die Wandteile in den Builder und gibt Kollisionsblöcke + Transformation zurück.
 */
export function addWall(b, M, { start, end, height, thickness, openings = [], material = M.wall, baseboard = true, y0 = 0 }) {
  const dx = end[0] - start[0], dz = end[1] - start[1];
  const L = Math.hypot(dx, dz);
  const rot = -Math.atan2(dz, dx);
  const ux = dx / L, uz = dz / L;

  b.push(start[0], y0, start[1], rot);

  // Senkrechte Streifen an allen Öffnungskanten bilden, pro Streifen massive Höhenbereiche bestimmen
  const cuts = new Set([0, L]);
  for (const o of openings) { cuts.add(Math.max(0, o.u)); cuts.add(Math.min(L, o.u + o.w)); }
  const xs = [...cuts].sort((a, c) => a - c);
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i], c = xs[i + 1];
    if (c - a < 1e-4) continue;
    const covering = openings
      .filter((o) => o.u <= a + 1e-4 && o.u + o.w >= c - 1e-4)
      .map((o) => [o.y, o.y + o.h])
      .sort((p, q) => p[0] - q[0]);
    let cursor = 0;
    for (const [oy0, oy1] of covering) {
      if (oy0 > cursor + 1e-4) b.boxMinMax(material, a, cursor, -thickness, c, oy0, 0);
      cursor = Math.max(cursor, oy1);
    }
    if (height > cursor + 1e-4) b.boxMinMax(material, a, cursor, -thickness, c, height, 0);
  }

  // Sockelleiste (nicht in Türöffnungen)
  if (baseboard) {
    const doors = openings.filter((o) => o.y < 0.05).sort((p, q) => p.u - q.u);
    let cursor = 0;
    for (const d of [...doors, { u: L, w: 0 }]) {
      if (d.u - cursor > 0.02) b.boxMinMax(M.baseboard, cursor, 0, 0, d.u, 0.07, 0.012);
      cursor = d.u + d.w;
    }
  }
  b.pop();

  // Kollision: komplette Wandlänge, unterbrochen an Türöffnungen
  const colliders = [];
  const doorOpenings = openings.filter((o) => o.y < 0.05).sort((p, q) => p.u - q.u);
  let cursor = -thickness * 0.5;
  const segs = [];
  for (const d of doorOpenings) { segs.push([cursor, d.u]); cursor = d.u + d.w; }
  segs.push([cursor, L + thickness * 0.5]);
  const nx = -uz, nz = ux; // Innen-Normale
  const segments = [];   // Wandlinien für die Karte (ohne Türöffnungen)
  for (const [s0, s1] of segs) {
    if (s1 - s0 < 0.01) continue;
    const mid = (s0 + s1) / 2;
    colliders.push({
      x: start[0] + ux * mid - nx * thickness / 2,
      z: start[1] + uz * mid - nz * thickness / 2,
      w: s1 - s0, d: thickness, rot, bottom: y0, top: y0 + height,
    });
    const a = Math.max(0, s0), c = Math.min(L, s1);
    segments.push([start[0] + ux * a, start[1] + uz * a, start[0] + ux * c, start[1] + uz * c]);
  }
  return { colliders, segments, rot, length: L, dir: [ux, uz], normal: [nx, nz] };
}

/** Punkt entlang einer Wand: u entlang, n nach innen. */
export function wallPoint(start, end, u, n = 0) {
  const dx = end[0] - start[0], dz = end[1] - start[1];
  const L = Math.hypot(dx, dz);
  const ux = dx / L, uz = dz / L;
  return [start[0] + ux * u - uz * n, start[1] + uz * u + ux * n];
}

// ======================================================================= Fenster

/**
 * Fenster in einer Wandöffnung. Lokaler Ursprung = Mitte der Öffnung auf der
 * Innenseite der Wand, +z zeigt in den Raum.
 * rows: von unten nach oben [{ f: Höhenanteil, cols, blinds }]
 */
export function addWindow(b, M, {
  w, h, inset = 0.24, rows = [{ f: 1, cols: 1 }], frame = M.windowFrame, frameT = 0.06,
  sill = true, sillDepth = null, glass = M.glass, blindsDrop = 1, lining = null, liningDepth = 0.25,
}) {
  const z = -inset;
  const fd = 0.07; // Rahmentiefe
  if (lining) {
    // Verkleidete Laibung (graue Innenfenster zum Flur)
    const t = 0.03;
    b.box(lining, w, t, liningDepth, 0, h / 2 - t / 2, -liningDepth / 2 + 0.01);
    b.box(lining, w, t, liningDepth, 0, -h / 2 + t / 2, -liningDepth / 2 + 0.01);
    b.box(lining, t, h, liningDepth, -w / 2 + t / 2, 0, -liningDepth / 2 + 0.01);
    b.box(lining, t, h, liningDepth, w / 2 - t / 2, 0, -liningDepth / 2 + 0.01);
    b.box(lining, w + 0.1, 0.05, 0.015, 0, h / 2 + 0.025, 0.008);
    b.box(lining, w + 0.1, 0.05, 0.015, 0, -h / 2 - 0.025, 0.008);
    b.box(lining, 0.05, h, 0.015, -w / 2 - 0.025, 0, 0.008);
    b.box(lining, 0.05, h, 0.015, w / 2 + 0.025, 0, 0.008);
  }
  // Blendrahmen
  b.box(frame, w, frameT, fd, 0, -h / 2 + frameT / 2, z);
  b.box(frame, w, frameT, fd, 0, h / 2 - frameT / 2, z);
  b.box(frame, frameT, h, fd, -w / 2 + frameT / 2, 0, z);
  b.box(frame, frameT, h, fd, w / 2 - frameT / 2, 0, z);
  // Reihen und Pfosten
  let y = -h / 2;
  rows.forEach((row, i) => {
    const rh = row.f * h;
    if (i > 0) b.box(frame, w, frameT * 0.9, fd, 0, y, z);
    // cols: Anzahl gleich breiter Felder oder Liste von Breitenanteilen, z. B. [0.25, 0.5, 0.25]
    const fr = Array.isArray(row.cols) ? row.cols : Array(row.cols).fill(1 / row.cols);
    const edges = [0];
    for (const f of fr) edges.push(edges[edges.length - 1] + f);
    for (let c = 1; c < fr.length; c++) {
      const x = -w / 2 + w * edges[c];
      b.box(frame, frameT * 0.9, rh, fd, x, y + rh / 2, z);
    }
    // Flügelrahmen innen (wirkt plastischer)
    for (let c = 0; c < fr.length; c++) {
      const cw = w * fr[c];
      const cx = -w / 2 + w * (edges[c] + edges[c + 1]) / 2;
      const inner = 0.035;
      b.box(frame, cw - frameT, inner, fd * 0.6, cx, y + frameT / 2 + inner / 2, z + 0.01);
      b.box(frame, cw - frameT, inner, fd * 0.6, cx, y + rh - frameT / 2 - inner / 2, z + 0.01);
    }
    if (row.blinds) {
      const bh = rh * blindsDrop - frameT;
      b.box(M.blinds, w - frameT * 2, bh, 0.004, 0, y + rh - frameT / 2 - bh / 2, z + 0.05);
      b.box(M.windowFrame, w - frameT * 2, 0.025, 0.035, 0, y + rh - frameT / 2 - 0.0125, z + 0.05);
    }
    y += rh;
  });
  // Glas
  b.box(glass, w - frameT, h - frameT, 0.006, 0, 0, z - 0.005);
  // Fensterbank innen
  if (sill) {
    const sd = sillDepth ?? inset + 0.03;
    // 2 mm über der Laibung: sonst liegen Fensterbank und Öffnungsunterkante in einer Ebene (Flackern)
    b.box(M.sill, w + 0.04, 0.025, sd, 0, -h / 2 - 0.0105, z + sd / 2 - 0.02);
  }
}

/** Kleines schwarzes Herz (Fensterdeko). */
export function addHeart(b, M, x, y, z, size = 0.09) {
  const s = new THREE.Shape();
  s.moveTo(0, -0.5);
  s.bezierCurveTo(-0.15, -0.3, -0.55, -0.05, -0.5, 0.25);
  s.bezierCurveTo(-0.45, 0.55, -0.1, 0.55, 0, 0.3);
  s.bezierCurveTo(0.1, 0.55, 0.45, 0.55, 0.5, 0.25);
  s.bezierCurveTo(0.55, -0.05, 0.15, -0.3, 0, -0.5);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: false, curveSegments: 6 });
  b.add(M.black, g, matrixFrom(x, y, z, 0, 0, 0, size, size, size));
  b.rod(M.black, [x, y + size * 0.3, z + 0.005], [x, y + size * 2.2, z + 0.005], 0.0015, 4);
}

/** Milchglas-Oberlicht ohne Durchbruch (hohe Fenster in der Flurwand). */
export function addFrostedWindow(b, M, x, y, z, w, h, ry = 0) {
  b.push(x, y, z, ry);
  b.box(M.windowFrameGrey, w + 0.08, h + 0.08, 0.03, 0, 0, 0.015);
  b.box(M.frosted, w, h, 0.01, 0, 0, 0.035);
  b.box(M.windowFrameGrey, w + 0.08, 0.03, 0.06, 0, -h / 2 - 0.04, 0.03);
  b.pop();
}

// ======================================================================= Tür

/**
 * Holztür mit Zarge und Glas-Oberlicht. Ursprung = Mitte der Wandöffnung am Boden,
 * Wand liegt bei z = -wallThickness .. 0, Raum bei +z.
 */
export class Door {
  constructor(M, {
    id, name = 'Tür', width = 1.2, leafHeight = 2.13, openingWidth = 1.42, openingHeight = 3.15,
    wallThickness = 0.25, hinge = 'right', openAngle = -1.62, transom = true, frontMaterial = M.doorLeaf,
    backMaterial = M.beech, leafMaterial = M.beech, frameMaterial = M.beech, casingBack = false, knob = false, knobBack = knob,
  }) {
    this.id = id;
    this.name = name;
    this.group = new THREE.Group();
    this.group.name = id;
    this.openAngle = openAngle;
    this.angle = 0;
    this.target = 0;
    this.isOpen = false;
    this.closedBlocks = [];
    this.openBlocks = [];

    const fb = new PartBuilder();
    const fw = (openingWidth - width) / 2;          // Zargenbreite
    const t = wallThickness;
    const F = frameMaterial;
    // Zarge (Seiten + Kopf), steht innen etwas vor
    fb.box(F, fw, openingHeight, t + 0.04, -openingWidth / 2 + fw / 2, openingHeight / 2, -t / 2 + 0.01);
    fb.box(F, fw, openingHeight, t + 0.04, openingWidth / 2 - fw / 2, openingHeight / 2, -t / 2 + 0.01);
    fb.box(F, openingWidth, fw, t + 0.04, 0, openingHeight - fw / 2, -t / 2 + 0.01);
    // Bekleidung (Rahmen auf der Raumseite, optional auch auf der Rückseite)
    for (const zc of casingBack ? [0.03, -t - 0.03] : [0.03]) {
      fb.box(F, 0.06, openingHeight, 0.02, -openingWidth / 2 - 0.02, openingHeight / 2, zc);
      fb.box(F, 0.06, openingHeight, 0.02, openingWidth / 2 + 0.02, openingHeight / 2, zc);
      fb.box(F, openingWidth + 0.1, 0.06, 0.02, 0, openingHeight + 0.01, zc);
    }
    // Anschlagleisten in den Fugen ums Türblatt (seitlich 5 mm, oben bis zum Kopfstück): sonst sah man
    // bei geschlossener Tür durch die Spalten in den Nachbarraum. 1 mm Luft zum Blatt.
    for (const sx of [-1, 1]) fb.box(F, 0.004, leafHeight, 0.03, sx * (width / 2 - 0.002), leafHeight / 2, -0.03);
    const topGap = openingHeight - fw - leafHeight - 0.001;
    if (!transom && topGap > 0.002) fb.box(F, width, topGap, 0.03, 0, leafHeight + 0.001 + topGap / 2, -0.03);
    // Flache Schwelle über die ganze Wandstärke: sonst fehlt in der Öffnung jede Bodenfläche
    // (man sah unter dem Türblatt bis auf den Außenboden). 2 mm hoch, matt grau.
    fb.box(M.panelGrey, openingWidth - 2 * fw, 0.002, t + 0.03, 0, 0.001, -t / 2 + 0.005);
    if (transom) {
      fb.box(F, width, 0.08, t, 0, leafHeight + 0.04, -t / 2);
      fb.box(M.glass, width, openingHeight - leafHeight - 0.08 - fw, 0.008, 0, (leafHeight + 0.08 + openingHeight - fw) / 2, -t / 2);
    }
    // Die Zarge bewegt sich nie: static-batching.js darf sie mit dem Raum zusammenfassen. Ausgenommen die
    // 2 mm flache Schwelle: zusammengefasst ändert sich die Tiefenrundung, ihre Kante am Boden sähe anders aus.
    const frame = fb.build({ name: `${id}_zarge` });
    for (const m of frame.children) m.userData.fixed = m.material !== M.panelGrey;
    this.group.add(frame);

    // Türblatt an einem Drehpunkt (Scharnierseite)
    const side = hinge === 'right' ? 1 : -1;
    this.pivot = new THREE.Group();
    this.pivot.position.set(side * width / 2, 0, -0.03);
    this.group.add(this.pivot);

    const leafGeo = new THREE.BoxGeometry(width - 0.01, leafHeight - 0.005, 0.045);
    // Gleiche Seitenmaterialien in einer Gruppe: 1–3 statt 6 Zeichenbefehle, dieselben Dreiecke.
    this.leaf = new THREE.Mesh(leafGeo, mergeMaterialGroups(leafGeo, [leafMaterial, leafMaterial, leafMaterial, leafMaterial, frontMaterial, backMaterial]));
    this.leaf.position.set(-side * (width / 2), leafHeight / 2, 0);
    this.leaf.castShadow = true;
    this.leaf.receiveShadow = true;
    this.leaf.name = `${id}_blatt`;
    this.pivot.add(this.leaf);

    // Drücker auf beiden Seiten
    const hb = new PartBuilder();
    for (const s of [1, -1]) {
      const hz = s * 0.06;
      hb.cylinder(M.chrome, 0.025, 0.025, 0.03, 0, 0, s * 0.03, 16, Math.PI / 2);
      if (s===1?knob:knobBack) hb.cylinder(M.chrome,0.034,0.034,0.035,0,0,hz,16,Math.PI/2);
      else hb.rod(M.chrome, [0, 0, hz], [side * 0.13, 0, hz], 0.011, 10);
      hb.box(M.chrome, 0.035, 0.16, 0.008, 0, -0.03, s * 0.026);
    }
    const handle = hb.build();
    handle.position.set(-side * (width - 0.1) + side * 0.0, 1.05 - leafHeight / 2, 0);
    handle.position.x = -side * (width / 2 - 0.09);
    this.leaf.add(handle);
  }

  label() {
    return this.isOpen ? 'Tür schließen' : 'Tür öffnen';
  }

  toggle() {
    this.isOpen = !this.isOpen;
    this.target = this.isOpen ? this.openAngle : 0;
  }

  update(dt) {
    const diff = this.target - this.angle;
    if (Math.abs(diff) > 1e-4) {
      this.angle += diff * Math.min(1, dt * 4.5);
      if (Math.abs(this.target - this.angle) < 0.002) this.angle = this.target;
      this.pivot.rotation.y = this.angle;
    }
    const openish = Math.abs(this.angle) > 0.35;
    for (const b of this.closedBlocks) b.enabled = !openish;
    for (const b of this.openBlocks) b.enabled = openish;
  }
}

// ======================================================================= Tische & Sitzmöbel

/** Massivholztisch (Eiche) mit schwarzen Kufen-Gestellen, Länge entlang x. */
export function addDiningTable(b, M, { length = 2.1, width = 0.95, height = 0.76, top = M.oak } = {}) {
  const t = 0.05;
  b.box(top, length, t, width, 0, height - t / 2, 0);
  const fx = length / 2 - 0.22;
  const zw = width / 2 - 0.1;
  const postH = height - t;
  for (const sx of [-1, 1]) {
    const x = sx * fx;
    b.box(M.steelBlack, 0.06, postH, 0.06, x, postH / 2, -zw);
    b.box(M.steelBlack, 0.06, postH, 0.06, x, postH / 2, zw);
    b.box(M.steelBlack, 0.06, 0.05, 2 * zw + 0.06, x, 0.025, 0);
    b.box(M.steelBlack, 0.06, 0.05, 2 * zw + 0.06, x, postH - 0.025, 0);
  }
}

/** Sitzbank passend zum Tisch. */
export function addBench(b, M, { length = 1.9, depth = 0.36, height = 0.45 } = {}) {
  const t = 0.05;
  b.box(M.benchOak, length, t, depth, 0, height - t / 2, 0);
  const fx = length / 2 - 0.2;
  const zw = depth / 2 - 0.05;
  const postH = height - t;
  for (const sx of [-1, 1]) {
    b.box(M.steelBlack, 0.05, postH, 0.05, sx * fx, postH / 2, -zw);
    b.box(M.steelBlack, 0.05, postH, 0.05, sx * fx, postH / 2, zw);
    b.box(M.steelBlack, 0.05, 0.04, 2 * zw + 0.05, sx * fx, 0.02, 0);
  }
}

function chairShellGeometry(seatH) {
  const y = seatH - 0.45;
  const s = new THREE.Shape();
  s.moveTo(0.22, 0.425 + y);
  s.quadraticCurveTo(0.24, 0.455 + y, 0.2, 0.472 + y);
  s.quadraticCurveTo(0.0, 0.49 + y, -0.13, 0.472 + y);
  s.quadraticCurveTo(-0.2, 0.47 + y, -0.215, 0.58 + y);
  s.lineTo(-0.262, 0.86 + y);
  s.quadraticCurveTo(-0.283, 0.89 + y, -0.305, 0.862 + y);
  s.lineTo(-0.262, 0.56 + y);
  s.quadraticCurveTo(-0.24, 0.43 + y, -0.12, 0.425 + y);
  s.lineTo(0.22, 0.425 + y);
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 0.4, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.018, bevelSegments: 2, curveSegments: 6,
  });
  geo.rotateY(-Math.PI / 2);
  geo.translate(0.2, 0, 0);
  return geo;
}

/** Stuhl mit grauer Stoff-Sitzschale und Holzbeinen (wie auf den Fotos). Prototyp für Instancing. */
export function createChair(M, { seatHeight = 0.45, legMaterial = M.legWood, footrest = false } = {}) {
  const b = new PartBuilder();
  b.add(M.fabric, chairShellGeometry(seatHeight));
  const top = seatHeight - 0.03;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      b.rod(legMaterial, [sx * 0.15, top, sz * 0.13], [sx * 0.21, 0, sz * 0.19], 0.014, 8);
    }
  }
  b.box(M.steelBlack, 0.3, 0.018, 0.27, 0, top - 0.005, 0);
  if (footrest) {
    const fy = 0.3;
    b.rod(legMaterial, [-0.18, fy, 0.17], [0.18, fy, 0.17], 0.01, 6);
    b.rod(legMaterial, [-0.18, fy, -0.16], [0.18, fy, -0.16], 0.01, 6);
  }
  return b.build({ name: 'stuhl' });
}

/** Stehtisch: weiße runde Platte, Chromfuß (Sternfuß oder Tellerfuß). */
export function createBistroTable(M, { radius = 0.35, height = 1.1, base = 'star' } = {}) {
  const b = new PartBuilder();
  b.cylinder(M.tableWhite, radius, radius, 0.03, 0, height - 0.015, 0, 36);
  b.cylinder(M.steel, radius * 0.98, radius * 0.98, 0.01, 0, height - 0.035, 0, 36);
  if (base === 'star') {
    b.cylinder(M.chrome, 0.1, 0.1, 0.02, 0, height - 0.05, 0, 16);
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      b.rod(M.chrome, [sx * 0.03, 0.13, sz * 0.03], [sx * 0.03, height - 0.05, sz * 0.03], 0.011, 8);
    }
    b.cylinder(M.chrome, 0.055, 0.055, 0.06, 0, 0.12, 0, 16);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const cx = Math.cos(a), cz = Math.sin(a);
      b.rod(M.chrome, [0, 0.12, 0], [cx * 0.28, 0.035, cz * 0.28], 0.013, 8);
      b.rod(M.chrome, [cx * 0.28, 0.035, cz * 0.28], [cx * 0.34, 0.012, cz * 0.34], 0.013, 8);
    }
  } else {
    b.cylinder(M.steel, 0.035, 0.035, height - 0.04, 0, (height - 0.04) / 2, 0, 16);
    b.cylinder(M.steel, 0.27, 0.27, 0.015, 0, 0.0075, 0, 36);
  }
  return b.build({ name: 'stehtisch' });
}

/** Rote Polsterbank (unter der Empore). */
export function addUpholsteredBench(b, M, { length = 1.8, depth = 0.5 } = {}) {
  b.add(M.leatherRed, new RoundedBoxGeometry(length, 0.12, depth, 2, 0.04), matrixFrom(0, 0.42, 0));
  b.add(M.leatherRed, new RoundedBoxGeometry(length, 0.42, 0.12, 2, 0.04), matrixFrom(0, 0.68, -depth / 2 + 0.06, -0.12));
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      b.rod(M.steelBlack, [sx * (length / 2 - 0.08), 0, sz * (depth / 2 - 0.08)], [sx * (length / 2 - 0.08), 0.37, sz * (depth / 2 - 0.08)], 0.015, 6);
    }
  }
}

// ======================================================================= Heizkörper

/** Gusseiserner Gliederheizkörper. Ursprung unten mittig an der Wand, ragt nach +z. */
export function addRadiator(b, M, { width = 0.8, height = 0.66, depth = 0.15, y0 = 0.18, wallGap = 0.04 } = {}) {
  const n = Math.max(4, Math.round(width / 0.062));
  const pitch = width / n;
  const zc = wallGap + depth / 2;
  for (let i = 0; i < n; i++) {
    const x = -width / 2 + pitch * (i + 0.5);
    b.box(M.radiator, pitch * 0.72, height - 0.06, depth, x, y0 + height / 2, zc);
  }
  b.box(M.radiator, width, 0.045, depth * 0.55, 0, y0 + 0.03, zc);
  b.box(M.radiator, width, 0.045, depth * 0.55, 0, y0 + height - 0.03, zc);
  b.rod(M.radiator, [width / 2, y0 + height - 0.03, zc], [width / 2 + 0.07, y0 + height - 0.03, zc], 0.012, 6);
  b.cylinder(M.radiator, 0.022, 0.022, 0.05, width / 2 + 0.08, y0 + height - 0.03, zc, 8);
}

/** Moderner senkrechter Röhrenheizkörper (Empore). */
export function addVerticalRadiator(b, M, { width = 0.5, height = 1.6, y0 = 0 } = {}) {
  const n = Math.round(width / 0.07);
  for (let i = 0; i < n; i++) {
    const x = -width / 2 + (width / n) * (i + 0.5);
    b.box(M.radiator, 0.055, height, 0.05, x, y0 + height / 2, 0.06);
  }
}

// ======================================================================= Empore / Stahlbau

/** Rote Stahlstütze. */
export function addColumn(b, M, x, z, height, size = 0.1) {
  b.box(M.redSteel, size, height, size, x, height / 2, z);
  b.box(M.steel, size + 0.08, 0.012, size + 0.08, x, 0.006, z);
  b.box(M.redSteel, size + 0.06, 0.015, size + 0.06, x, height - 0.0075, z);
}

/**
 * Geländer entlang eines Polygonzugs (x/z) auf Höhe baseY:
 * Edelstahlpfosten, 5 Querstäbe, Holzhandlauf, Lochblech-Fußleiste.
 */
export function addRailing(b, M, points, { baseY, height = 1.0, rods = 5, spacing = 1.25, kick = true } = {}) {
  for (let s = 0; s < points.length - 1; s++) {
    const [x0, z0] = points[s], [x1, z1] = points[s + 1];
    const dx = x1 - x0, dz = z1 - z0;
    const L = Math.hypot(dx, dz);
    const rot = -Math.atan2(dz, dx);
    b.push(x0, baseY, z0, rot);
    const n = Math.max(1, Math.ceil(L / spacing));
    for (let i = s === 0 ? 0 : 1; i <= n; i++) {
      b.box(M.steel, 0.04, height, 0.04, (L * i) / n, height / 2, 0);
    }
    for (let k = 0; k < rods; k++) {
      const y = 0.2 + (k * (height - 0.32)) / (rods - 1);
      b.cylinder(M.steel, 0.006, 0.006, L, L / 2, y, 0, 6, 0, 0, Math.PI / 2);
    }
    b.cylinder(M.handrailWood, 0.027, 0.027, L + 0.04, L / 2, height + 0.02, 0, 10, 0, 0, Math.PI / 2);
    if (kick) b.box(M.perforated, L, 0.14, 0.012, L / 2, 0.07, 0);
    b.pop();
  }
}

/**
 * Stahltreppe mit Holz-Antrittsstufe, Blechstufen, blauen Wangen,
 * Geländer auf der linken Seite (-x) und Wandhandlauf rechts (+x).
 * Lokal: läuft entlang +z, Breite entlang x (zentriert), beginnt bei z = 0.
 */
export function addSteelStairs(b, M, { width = 1.25, rise = 0.204, going = 0.27, treads = 11, blockDepth = 0.6 } = {}) {
  // Antrittsstufe (Holzblock)
  b.box(M.beech, width + 0.12, rise, blockDepth, -0.06, rise / 2, blockDepth / 2);

  const slope = rise / going;
  const nose = (z) => rise * 2 + (z - blockDepth) * slope; // Höhe der Stufenvorderkanten
  const head = blockDepth + treads * going;

  for (let i = 1; i <= treads; i++) {
    const top = rise * (i + 1);
    const z0 = blockDepth + (i - 1) * going;
    b.box(M.treadTop, width - 0.06, 0.025, going - 0.02, 0, top - 0.0125, z0 + going / 2);
    b.box(M.treadSteel, width - 0.06, 0.035, 0.035, 0, top - 0.04, z0 + 0.03);
    b.box(M.treadSteel, width - 0.06, 0.03, 0.03, 0, top - 0.045, z0 + going - 0.03);
  }

  // Wangen
  const off = 0.17;
  const zStart = blockDepth + (0.11 + off - rise * 2) / slope;
  for (const sx of [-1, 1]) {
    const x = sx * (width / 2 - 0.01);
    b.bar(M.blueSteel, [x, 0.11, zStart], [x, nose(head) - off, head], 0.03, 0.26);
  }

  // Geländer links
  const posts = [blockDepth * 0.5];
  for (let i = 3; i <= treads; i += 3) posts.push(blockDepth + (i - 1) * going + going / 2);
  posts.push(head - 0.05);
  const px = -width / 2 - 0.03;
  const postTop = 1.0;
  const footY = (z) => (z < blockDepth ? rise : nose(z) - 0.02);
  for (const z of posts) b.box(M.steel, 0.04, postTop, 0.04, px, footY(z) + postTop / 2, z);
  const za = posts[0], zb = posts[posts.length - 1];
  const ya = footY(za), yb = footY(zb);
  b.rod(M.handrailWood, [px, ya + postTop + 0.02, za - 0.05], [px, yb + postTop + 0.02, zb + 0.05], 0.027, 10);
  b.rod(M.handrailWood, [px + 0.06, ya + postTop - 0.1, za], [px + 0.06, yb + postTop - 0.1, zb], 0.022, 10);
  for (let k = 0; k < 5; k++) {
    const dy = 0.15 + k * 0.15;
    b.rod(M.steel, [px, ya + dy, za], [px, yb + dy, zb], 0.006, 6);
  }
  // Wandhandlauf rechts
  const wx = width / 2 + 0.05;
  b.rod(M.handrailWood, [wx, nose(blockDepth) + 0.9, blockDepth], [wx, nose(head) + 0.9, head], 0.025, 10);
  for (const z of [blockDepth + 0.3, (blockDepth + head) / 2, head - 0.3]) {
    b.rod(M.steel, [wx, nose(z) + 0.88, z], [wx + 0.07, nose(z) + 0.88, z], 0.008, 6);
  }

  return { head, nose, slope };
}

// ======================================================================= Küche

/**
 * Unterschrank-Fronten entlang lokal x (0 … Summe der Breiten), Front auf z = 0 Richtung +z.
 * fronts: [{ w, type: 'door' | 'drawers' }]
 */
export function addBaseFronts(b, M, fronts, { y0 = 0.11, height = 0.76 } = {}) {
  let x = 0;
  const gap = 0.006;
  for (const f of fronts) {
    const cx = x + f.w / 2;
    if (f.type === 'drawers') {
      const hs = [0.2, 0.26, 0.3];
      let y = y0 + height;
      for (const h of hs) {
        b.box(M.kitchenCream, f.w - gap, h - gap, 0.018, cx, y - h / 2, 0.009);
        b.box(M.handle, 0.12, 0.012, 0.018, cx, y - 0.05, 0.026);
        y -= h;
      }
    } else {
      b.box(M.kitchenCream, f.w - gap, height - gap, 0.018, cx, y0 + height / 2, 0.009);
      if (f.type !== 'panel') b.box(M.handle, 0.12, 0.012, 0.018, cx, y0 + height - 0.05, 0.026);
    }
    x += f.w;
  }
}

/** Oberschränke (blau), Länge entlang x, Rückwand bei z = 0. */
export function addWallCabinets(b, M, { length, doors, y0 = 1.48, height = 0.64, depth = 0.34 }) {
  b.box(M.kitchenCarcass, length, height, depth - 0.02, length / 2, y0 + height / 2, (depth - 0.02) / 2);
  const dw = length / doors;
  for (let i = 0; i < doors; i++) {
    const cx = dw * (i + 0.5);
    b.box(M.kitchenBlue, dw - 0.006, height - 0.006, 0.02, cx, y0 + height / 2, depth - 0.01);
    b.box(M.handle, 0.11, 0.012, 0.016, cx, y0 + 0.05, depth + 0.008);
  }
}

export function addCoffeeMachine(b, M, x, y, z, ry = 0) {
  b.push(x, y, z, ry);
  b.add(M.black, new RoundedBoxGeometry(0.12, 0.24, 0.3, 2, 0.015), matrixFrom(0, 0.12, 0));
  b.add(M.chrome, new THREE.SphereGeometry(0.045, 14, 10), matrixFrom(0, 0.27, 0.02));
  b.box(M.steel, 0.1, 0.01, 0.1, 0, 0.005, 0.1);
  b.pop();
}

export function addWateringCan(b, M, x, y, z, ry = 0) {
  b.push(x, y, z, ry);
  b.cylinder(M.black, 0.075, 0.09, 0.2, 0, 0.1, 0, 16);
  b.rod(M.black, [0.06, 0.06, 0], [0.26, 0.26, 0], 0.012, 6);
  b.cylinder(M.black, 0.025, 0.012, 0.05, 0.27, 0.28, 0, 8, 0, 0, -0.8);
  b.rod(M.black, [-0.07, 0.2, 0], [-0.04, 0.3, 0], 0.01, 6);
  b.rod(M.black, [-0.04, 0.3, 0], [0.05, 0.22, 0], 0.01, 6);
  b.pop();
}

export function addPaperStack(b, M, x, y, z, ry = 0, n = 3) {
  b.push(x, y, z, ry);
  for (let i = 0; i < n; i++) {
    b.box(i === n - 1 ? M.book : M.paper, 0.32 - i * 0.02, 0.012, 0.23, (i % 2) * 0.015, 0.006 + i * 0.012, (i % 2) * -0.01, 0, i * 0.08, 0);
  }
  b.pop();
}

// ======================================================================= Kleinteile & Deko

export function addTrashBin(b, M, x, z) {
  b.cylinder(M.binBlack, 0.165, 0.145, 0.4, x, 0.2, z, 18);
  b.cylinder(M.binBag, 0.185, 0.17, 0.12, x, 0.42, z, 18);
}

export function addFireExtinguisher(b, M, x, z, ry = 0) {
  b.push(x, 0, z, ry);
  b.cylinder(M.red, 0.075, 0.075, 0.46, 0, 0.27, 0, 16);
  b.add(M.red, new THREE.SphereGeometry(0.075, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), matrixFrom(0, 0.5, 0));
  b.cylinder(M.black, 0.02, 0.02, 0.07, 0, 0.6, 0, 8);
  b.rod(M.black, [0, 0.62, 0], [0.12, 0.66, 0], 0.012, 6);
  b.rod(M.black, [0.02, 0.58, 0.04], [0.07, 0.2, 0.08], 0.012, 6);
  b.box(M.black, 0.16, 0.05, 0.16, 0, 0.025, 0);
  b.pop();
}

/** Lichtband/Rasterleuchte, hängt nach unten (y = 0 ist die Deckenfläche). */
export function addCeilingLight(b, M, x, y, z, { length = 1.25, width = 0.15, ry = 0, panelInset = 0, louverDrop = 0 } = {}) {
  b.push(x, y, z, ry);
  b.box(M.lightHousing, width, 0.03, length, 0, -0.015, 0);
  b.box(M.lightPanel, width - 0.03 - panelInset, 0.004, length - 0.03, 0, -0.032, 0);
  const n = Math.floor(length / 0.07);
  for (let i = 1; i < n; i++) {
    b.box(M.lightHousing, width - 0.02, 0.025, 0.006, 0, -0.045 - louverDrop, -length / 2 + (length * i) / n);
  }
  b.box(M.lightHousing, 0.01, 0.03, length, -width / 2 + 0.01, -0.045, 0);
  b.box(M.lightHousing, 0.01, 0.03, length, width / 2 - 0.01, -0.045, 0);
  b.pop();
}

/** Lichtschalter/Steckdose als kleine Platte auf einer Wand (Normale +z). */
export function addSwitchPlate(b, M, x, y, z, ry = 0, socket = false) {
  b.push(x, y, z, ry);
  b.box(M.switchWhite, 0.08, 0.08, 0.012, 0, 0, 0.006);
  if (socket) b.cylinder(M.panelGrey, 0.022, 0.022, 0.004, 0, 0, 0.013, 12, Math.PI / 2);
  else b.box(M.panelGrey, 0.05, 0.05, 0.004, 0, 0, 0.013);
  b.pop();
}

export function createWallClock(M) {
  const g = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.04, 32), M.black);
  rim.rotation.x = Math.PI / 2;
  rim.position.z = 0.02;
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.165, 32), M.clockFace);
  face.position.z = 0.041;
  g.add(rim, face);
  return g;
}

/** Leicht gewölbte Fläche mit Textur (Motorhaube, Schilder). */
export function createCurvedDecal(material, w, h, bulge = 0.06) {
  const geo = new THREE.PlaneGeometry(w, h, 12, 6);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) / (w / 2), y = pos.getY(i) / (h / 2);
    pos.setZ(i, bulge * (1 - x * x) * (1 - 0.4 * y * y));
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Weinkiste (Holzlatten). Ursprung unten mittig. */
export function createCrate(M, { w = 0.5, h = 0.32, d = 0.35 } = {}) {
  const b = new PartBuilder();
  const t = 0.014;
  for (const y of [0.05, 0.16, 0.27]) {
    b.box(M.crate, w, 0.075, t, 0, y, d / 2 - t / 2);
    b.box(M.crate, w, 0.075, t, 0, y, -d / 2 + t / 2);
  }
  b.box(M.crate, 0.018, h, d, -w / 2 + 0.009, h / 2, 0);
  b.box(M.crate, 0.018, h, d, w / 2 - 0.009, h / 2, 0);
  for (const z of [-0.11, 0, 0.11]) b.box(M.crate, w - 0.04, 0.012, 0.08, 0, 0.006, z);
  return b.build({ name: 'kiste' });
}

/** Europalette 1,2 × 0,8 m. Ursprung unten mittig, lange Seite entlang x. */
export function createPallet(M) {
  const b = new PartBuilder();
  const L = 1.2, D = 0.8;
  for (const z of [-0.3275, 0, 0.3275]) b.box(M.pine, L, 0.022, 0.145, 0, 0.011, z);
  for (const x of [-0.5275, 0, 0.5275]) {
    for (const z of [-0.3275, 0, 0.3275]) b.box(M.pine, 0.145, 0.078, 0.1, x, 0.061, z);
    b.box(M.pine, 0.145, 0.022, D, x, 0.111, 0);
  }
  const tops = [[-0.3275, 0.145], [-0.165, 0.1], [0, 0.145], [0.165, 0.1], [0.3275, 0.145]];
  for (const [z, w] of tops) b.box(M.pine, L, 0.022, w, 0, 0.133, z);
  return b.build({ name: 'palette' });
}

/** Weiches Kissen (abgerundeter Quader). */
export function addCushion(b, material, w, h, d, x, y, z, rx = 0, ry = 0) {
  b.add(material, new RoundedBoxGeometry(w, h, d, 3, Math.min(0.045, h * 0.45)), matrixFrom(x, y, z, rx, ry, 0));
}

/** Ziergras im Topf: pot = 'trunk' (Baumstamm), 'basket' (Korb), 'small' (kleiner Topf). */
export function addGrassPlant(b, M, x, z, { y = 0, height = 0.9, pot = 'trunk', spread = 0.7 } = {}) {
  b.push(x, y, z);
  let potTop;
  if (pot === 'trunk') {
    b.cylinder(M.bark, 0.15, 0.17, 0.5, 0, 0.25, 0, 14);
    potTop = 0.5;
  } else if (pot === 'basket') {
    b.cylinder(M.wicker, 0.15, 0.12, 0.25, 0, 0.125, 0, 14);
    potTop = 0.25;
  } else {
    b.cylinder(M.potWhite, 0.055, 0.045, 0.1, 0, 0.05, 0, 12);
    potTop = 0.1;
  }
  for (let i = 0; i < 3; i++) {
    const g = new THREE.PlaneGeometry(spread * height, height);
    b.add(M.grass, g, matrixFrom(0, potTop + height / 2 - 0.02, 0, 0, (i * Math.PI) / 3, 0));
  }
  b.pop();
}

/** Kleiner Karton. */
export function addCardboardBox(b, M, x, y, z, w = 0.4, h = 0.3, d = 0.3, ry = 0) {
  b.box(M.cardboard, w, h, d, x, y + h / 2, z, 0, ry, 0);
}

// ======================================================================= Bewegliche Teile

/**
 * Fenster mit kippbarem Flügel und optionaler Jalousie.
 * Ursprung wie bei addWindow (Mitte der Öffnung auf der Wandinnenseite, +z in den Raum).
 * blindsDrop: wie weit die Jalousie anfangs heruntergelassen ist (0..1), null = keine Jalousie.
 */
export function createInteractiveWindow(M, { w, h, inset = 0.3, blindsDrop = null, frameT = 0.06, sill = true, name = 'fenster' }) {
  const group = new THREE.Group();
  group.name = name;
  const fb = new PartBuilder();
  const z = -inset, fd = 0.07;
  fb.box(M.windowFrame, w, frameT, fd, 0, -h / 2 + frameT / 2, z);
  fb.box(M.windowFrame, w, frameT, fd, 0, h / 2 - frameT / 2, z);
  fb.box(M.windowFrame, frameT, h, fd, -w / 2 + frameT / 2, 0, z);
  fb.box(M.windowFrame, frameT, h, fd, w / 2 - frameT / 2, 0, z);
  if (sill) {
    const sd = inset + 0.03;
    fb.box(M.sill, w + 0.04, 0.025, sd, 0, -h / 2 - 0.0105, z + sd / 2 - 0.02);   // 2 mm über der Laibung
  }
  const frame = fb.build({ name: `${name}_rahmen` });
  frame.userData.fixed = true;   // Rahmen und Fensterbank bewegen sich nicht (static-batching.js)
  group.add(frame);

  // Flügel: kippt um die Unterkante nach innen
  const sash = new THREE.Group();
  sash.position.set(0, -h / 2 + frameT, z + 0.02);
  group.add(sash);
  const sb = new PartBuilder();
  const sw = w - frameT * 2, sh = h - frameT * 2, t = 0.045;
  sb.box(M.windowFrame, sw, t, 0.05, 0, t / 2, 0);
  sb.box(M.windowFrame, sw, t, 0.05, 0, sh - t / 2, 0);
  sb.box(M.windowFrame, t, sh, 0.05, -sw / 2 + t / 2, sh / 2, 0);
  sb.box(M.windowFrame, t, sh, 0.05, sw / 2 - t / 2, sh / 2, 0);
  sb.box(M.glass, sw - t * 2, sh - t * 2, 0.006, 0, sh / 2, 0);
  sb.box(M.steel, 0.022, 0.11, 0.02, sw / 2 - t / 2, sh * 0.55, 0.037);
  sash.add(sb.build({ name: `${name}_fluegel` }));
  const tilt = new Toggle({ apply: (k) => { sash.rotation.x = 0.16 * k; }, duration: 0.5 });
  group.userData.acousticOpening = () => sash.rotation.x / .16;

  let blindsToggle = null;
  if (blindsDrop !== null) {
    const bh = h - frameT * 2;
    const geo = new THREE.BoxGeometry(w - frameT * 2, bh, 0.004);
    geo.translate(0, -bh / 2, 0);
    const blinds = new THREE.Mesh(geo, M.blinds);
    blinds.position.set(0, h / 2 - frameT, -0.07);
    group.add(blinds);
    const box = new THREE.Mesh(new THREE.BoxGeometry(w - frameT * 2 + 0.02, 0.035, 0.05), M.windowFrame);
    box.position.set(0, h / 2 - frameT - 0.0175, -0.07);
    box.userData.fixed = true;   // Jalousiekasten bleibt stehen, nur der Behang fährt
    group.add(box);
    const minDrop = 0.07;
    const full = Math.max(minDrop, blindsDrop);
    blindsToggle = new Toggle({
      open: blindsDrop > minDrop,
      apply: (k) => { blinds.scale.y = minDrop + (full - minDrop) * k; },
      duration: 0.7,
    });
  }
  return { group, tilt, blindsToggle };
}

/**
 * Schranktür mit Scharnier. Ursprung = Mitte der Front (Rückseite der Front liegt auf z = 0).
 * hinge 'left' | 'right', handle 'top' | 'bottom'.
 */
export function createHingedFront(M, { w, h, material = M.kitchenCream, hinge = 'left', handle = 'top', maxAngle = 1.7, bar = null }) {
  const outer = new THREE.Group();
  const s = hinge === 'left' ? 1 : -1;
  const pivot = new THREE.Group();
  pivot.position.x = -s * w / 2;
  outer.add(pivot);
  const b = new PartBuilder();
  const t = 0.018;
  b.box(material, w - 0.006, h - 0.006, t, s * w / 2, 0, t / 2);
  const hy = handle === 'top' ? h / 2 - 0.05 : -h / 2 + 0.05;
  // bar = { length, offset }: Bügelgriff, offset = Anteil der halben Breite Richtung Öffnungskante
  if (bar) addBarHandle(b, M, s * w / 2 + s * (bar.offset ?? 0) * w / 2, hy, t, bar.length);
  else b.box(M.handle, 0.11, 0.012, 0.016, s * w / 2, hy, t + 0.008);
  pivot.add(b.build({ name: 'schranktuer' }));
  const toggle = new Toggle({ apply: (k) => { pivot.rotation.y = -s * maxAngle * k; }, duration: 0.45 });
  return { object: outer, toggle };
}

/** Schwarzer Bügelgriff (Stange mit zwei Füßen) auf einer Front, deren Vorderseite bei z = t liegt. */
export function addBarHandle(b, M, x, y, t, length = 0.18) {
  b.box(M.handle, length, 0.009, 0.009, x, y, t + 0.022);
  for (const e of [-1, 1]) b.box(M.handle, 0.009, 0.009, 0.02, x + e * (length / 2 - 0.006), y, t + 0.01);
}

/** Schublade mit Korpus. Ursprung = Mitte der Front, zieht nach +z heraus. */
export function createDrawer(M, { w, h, depth = 0.45, travel = 0.36, bar = null }) {
  const outer = new THREE.Group();
  const inner = new THREE.Group();
  outer.add(inner);
  const b = new PartBuilder();
  const t = 0.018;
  b.box(M.kitchenCream, w - 0.006, h - 0.006, t, 0, 0, t / 2);
  if (bar) addBarHandle(b, M, 0, h / 2 - 0.05, t, bar.length);
  else b.box(M.handle, 0.12, 0.012, 0.018, 0, h / 2 - 0.05, t + 0.009);
  b.box(M.kitchenCarcass, 0.012, h - 0.07, depth, -w / 2 + 0.035, -0.02, -depth / 2);
  b.box(M.kitchenCarcass, 0.012, h - 0.07, depth, w / 2 - 0.035, -0.02, -depth / 2);
  b.box(M.kitchenCarcass, w - 0.07, 0.012, depth, 0, -h / 2 + 0.04, -depth / 2);
  b.box(M.kitchenCarcass, w - 0.07, h - 0.09, 0.012, 0, -0.025, -depth + 0.006);
  inner.add(b.build({ name: 'schublade' }));
  const toggle = new Toggle({ apply: (k) => { inner.position.z = travel * k; }, duration: 0.4 });
  return { object: outer, toggle };
}

// ======================================================================= Textilien

/** Schwarze Jacke, über Sitz und Lehne gelegt. Ursprung = Sitzfläche Mitte, Lehne bei -z. */
export function addJacket(b, M, x, y, z, ry = 0) {
  // Weicher Stoff: eine Fläche folgt dem Profil Lehne -> Sitz -> Vorderkante und hängt vorne herunter,
  // mit leichten Falten. Dazu zwei Ärmel und ein Kragen als Schläuche.
  if (!M.jacketCloth) {
    M.jacketCloth = M.jacket.clone();
    M.jacketCloth.side = THREE.DoubleSide;
  }
  const profile = [
    [-0.36, 0.4], [-0.31, 0.33], [-0.27, 0.18], [-0.23, 0.05], [-0.15, 0.012], [0.05, 0.0],
    [0.2, 0.006], [0.29, -0.012], [0.32, -0.08], [0.33, -0.21],
  ];
  const seg = [0];
  for (let i = 1; i < profile.length; i++) {
    seg.push(seg[i - 1] + Math.hypot(profile[i][0] - profile[i - 1][0], profile[i][1] - profile[i - 1][1]));
  }
  const total = seg[seg.length - 1];
  const at = (s) => {
    let i = 1;
    while (i < seg.length - 1 && seg[i] < s) i++;
    const t = (s - seg[i - 1]) / (seg[i] - seg[i - 1]);
    const [z0, y0] = profile[i - 1], [z1, y1] = profile[i];
    const len = Math.hypot(z1 - z0, y1 - y0);
    return { z: z0 + (z1 - z0) * t, y: y0 + (y1 - y0) * t, nz: -(y1 - y0) / len, ny: (z1 - z0) / len };
  };
  const nu = 14, nv = 32;
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= nv; j++) {
    const v = j / nv;
    const p = at(v * total);
    const width = 0.5 - 0.08 * v;
    for (let i = 0; i <= nu; i++) {
      const u = i / nu;
      const fold = 0.012 * Math.sin(u * 9 + v * 7) + 0.008 * Math.sin(u * 23 - v * 11);
      const bulge = 0.018 * (1 - (2 * u - 1) ** 2);
      const off = 0.008 + fold + bulge;
      pos.push((u - 0.5) * width + 0.02 * Math.sin(v * 5), p.y + p.ny * off, p.z + p.nz * off);
      uv.push(u, v);
    }
  }
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i, c = a + nu + 1;
      idx.push(a, c, a + 1, a + 1, c, c + 1);
    }
  }
  const cloth = new THREE.BufferGeometry();
  cloth.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  cloth.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  cloth.setIndex(idx);
  cloth.computeVertexNormals();

  b.push(x, y, z, ry);
  b.add(M.jacketCloth, cloth);
  const tube = (pts, r) => new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(pts.map(([px, py, pz]) => new THREE.Vector3(px, py, pz))), 16, r, 8, false
  );
  b.add(M.jacket, tube([[0.25, 0.3, -0.3], [0.27, 0.08, -0.2], [0.24, 0.035, 0.0], [0.27, 0.035, 0.2], [0.29, -0.06, 0.31]], 0.042));
  b.add(M.jacket, tube([[-0.25, 0.3, -0.3], [-0.24, 0.07, -0.18], [-0.12, 0.035, 0.0], [0.05, 0.035, 0.14], [0.12, 0.03, 0.22]], 0.042));
  b.add(M.jacket, tube([[-0.24, 0.405, -0.355], [0, 0.425, -0.37], [0.24, 0.405, -0.355]], 0.028));
  b.pop();
}

/** Schwarze Tasche. */
export function addBag(b, M, x, y, z, ry = 0) {
  b.push(x, y, z, ry);
  b.add(M.jacket, new RoundedBoxGeometry(0.36, 0.3, 0.16, 2, 0.05), matrixFrom(0, 0.15, 0));
  b.rod(M.jacket, [-0.12, 0.29, 0], [-0.06, 0.42, 0], 0.012, 6);
  b.rod(M.jacket, [-0.06, 0.42, 0], [0.06, 0.42, 0], 0.012, 6);
  b.rod(M.jacket, [0.06, 0.42, 0], [0.12, 0.29, 0], 0.012, 6);
  b.pop();
}

// ======================================================================= Getränke

/** Getränk als eigene Gruppe (zum Tragen): 'dose' (Cola), 'flasche' (Wasser) oder 'tasse'. Ursprung = Unterseite. */
export function createDrink(M, type = 'dose') {
  const g = new THREE.Group();
  g.name = type;
  const add = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    return m;
  };
  if (type === 'dose') {
    // Mantel mit Aufdruck, oben/unten Aluminium (Material-Gruppen des Zylinders: Mantel, Deckel, Boden)
    add(new THREE.CylinderGeometry(0.033, 0.033, 0.105, 24), [M.canLabel, M.aluminium, M.aluminium], 0, 0.0575, 0);
    add(new THREE.CylinderGeometry(0.028, 0.033, 0.01, 24), M.aluminium, 0, 0.115, 0);
    add(new THREE.CylinderGeometry(0.031, 0.026, 0.005, 24), M.aluminium, 0, 0.0025, 0);
    add(new THREE.BoxGeometry(0.018, 0.002, 0.01), M.aluminium, 0.006, 0.121, 0);
  } else if (type === 'flasche') {
    add(new THREE.CylinderGeometry(0.034, 0.034, 0.17, 20), M.bottle, 0, 0.085, 0);
    add(new THREE.CylinderGeometry(0.032, 0.032, 0.12, 20), M.water, 0, 0.062, 0);
    add(new THREE.CylinderGeometry(0.015, 0.034, 0.06, 20), M.bottle, 0, 0.2, 0);
    add(new THREE.CylinderGeometry(0.016, 0.016, 0.02, 16), M.bottleCap, 0, 0.24, 0);
  } else {
    add(new THREE.CylinderGeometry(0.042, 0.038, 0.095, 24, 1, true), M.mug, 0, 0.0475, 0).material.side = THREE.DoubleSide;
    add(new THREE.CylinderGeometry(0.038, 0.038, 0.008, 24), M.mug, 0, 0.004, 0);
    add(new THREE.CylinderGeometry(0.039, 0.039, 0.004, 24), M.coffee, 0, 0.075, 0);
    const handle = add(new THREE.TorusGeometry(0.026, 0.007, 8, 16, Math.PI), M.mug, 0.042, 0.05, 0);
    handle.rotation.z = -Math.PI / 2;
  }
  return g;
}

// ======================================================================= Foyer-Möbel

/** Schultisch mit rotem C-Gestell; Ursprung am Boden, lange Seite entlang x. */
export function addSchoolTable(b, M, { width = 1.2, depth = 0.6 } = {}) {
  b.box(M.schoolTop, width, 0.028, depth, 0, 0.746, 0);
  b.box(M.foyerFrame, width + 0.005, 0.014, depth + 0.005, 0, 0.727, 0);
  for (const s of [-1, 1]) {
    const x = s * (width / 2 - 0.09);
    b.rod(M.schoolRed, [x, 0.69, -0.19], [x, 0.09, 0.13], 0.022, 10);
    b.rod(M.schoolRed, [x, 0.09, 0.13], [x, 0.035, 0.23], 0.022, 10);
    b.rod(M.schoolRed, [x, 0.035, -0.26], [x, 0.035, 0.25], 0.025, 10);
    b.box(M.black, 0.058, 0.028, 0.08, x, 0.022, -0.23);
    b.box(M.black, 0.058, 0.028, 0.08, x, 0.022, 0.23);
    b.rod(M.schoolRed, [x, 0.71, -0.24], [x, 0.71, 0.23], 0.018, 8);
  }
  b.rod(M.schoolRed, [-width / 2 + 0.08, 0.67, -0.18], [width / 2 - 0.08, 0.67, -0.18], 0.018, 8);
}

/** Schmale Holzlattenbank an der Wand. */
export function addSlatBench(b, M, { length = 1.8 } = {}) {
  // Maserung in Metern: längs der Latten/Zarge, senkrecht an den Beinen (u und v getauscht).
  const wood = (w, h, d, x, y, z, upright = false) => {
    const g = metricBoxUV(new THREE.BoxGeometry(w, h, d), 0.7);
    if (upright) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getY(i), uv.getX(i)); }
    b.add(M.slatBenchWood, g, matrixFrom(x, y, z));
  };
  for (let i = 0; i < 5; i++) wood(length, 0.025, 0.048, 0, 0.435, -0.12 + i * 0.06);
  for (const s of [-1, 1]) for (const z of [-0.105, 0.105]) wood(0.045, 0.42, 0.045, s * (length / 2 - 0.1), 0.21, z, true);
  wood(length - 0.15, 0.07, 0.035, 0, 0.32, 0);
}

/** Doppel-Wasserspender aus Edelstahl, Ursprung an der Rückwand, Front +z. */
export function addWaterDispenser(b, M) {
  b.box(M.steel,0.75,0.82,0.34,0,0.43,0.2);
  b.box(M.steelBlack,0.69,0.045,0.31,0,0.035,0.2);
  b.box(M.steel,0.75,0.65,0.035,0,1.15,0.045);
  b.box(M.steel,0.085,0.67,0.36,0,1.15,0.2);
  b.box(M.steel,0.79,0.34,0.36,0,1.64,0.2);
  b.box(M.aluminium,0.80,0.018,0.37,0,1.82,0.2);
  for(const s of [-1,1]){
    b.box(M.steel,0.027,0.68,0.33,s*0.36,1.16,0.19);
    b.box(M.perforated,0.32,0.018,0.31,s*0.2,0.85,0.21);
    b.cylinder(M.chrome,0.016,0.016,0.045,s*0.2,1.45,0.25,10);
    for(const y of [1.59,1.71])b.cylinder(M.accentBlue,0.018,0.018,0.009,s*0.34,y,0.387,12,Math.PI/2);
    for(let j=0;j<12;j++)b.box(M.handle,0.09,0.006,0.002,s*0.25,0.23+j*0.016,0.372);
  }
  b.box(M.paper,0.13,0.12,0.003,0,1.67,0.383);
}

/** Geschlossener Mehrzweckschrank, Rückwand bei z=0, Front +z. */
export function addUtilityCabinet(b,M,{width=1,height=2.4,depth=0.5,material=M.switchWhite,splitBase=false}={}){
  const w=width,h=height,d=depth;
  b.box(material,w,h-0.07,d,0,(h+0.07)/2,d/2);
  b.box(M.foyerFrame,w-0.04,0.07,d-0.04,0,0.035,d/2);
  const bottom=splitBase?0.49:0.09,top=h-0.1;
  for(const s of [-1,1]){
    b.box(material,w/2-0.009,top-bottom,0.018,s*w/4,(top+bottom)/2,d+0.01);
    if(splitBase)b.box(material,w/2-0.009,0.38,0.018,s*w/4,0.28,d+0.01);
    const hx=s*(w/2-0.075);
    b.rod(M.frameWhite,[hx,1.18,d+0.047],[hx,1.37,d+0.047],0.011,8);
    for(const y of [1.18,1.37])b.rod(M.frameWhite,[hx,y,d+0.018],[hx,y,d+0.047],0.01,8);
    b.cylinder(M.chrome,0.018,0.018,0.006,hx,1.08,d+0.023,12,Math.PI/2);
  }
  b.box(M.plinth,0.003,top-bottom,0.002,0,(top+bottom)/2,d+0.02);
  for(const y of [top,...(splitBase?[0.48]:[])])b.box(M.foyerFrame,w,0.018,0.015,0,y,d+0.023);
}

/** Zusammengeklappte Alu-Stehleiter mit Sprossen und hinterem Stützbügel. */
export function addFoldingLadder(b,M){
  for(const s of [-1,1]){
    b.bar(M.aluminium,[s*0.22,0.05,0.31],[s*0.18,2.30,0.06],0.046,0.026);
    b.bar(M.aluminium,[s*0.22,0.05,0.015],[s*0.18,2.26,0.065],0.032,0.022);
    b.box(M.black,0.065,0.05,0.06,s*0.22,0.025,0.30);
    b.cylinder(M.chrome,0.021,0.021,0.05,s*0.18,2.25,0.065,10,0,0,Math.PI/2);
  }
  for(let j=0;j<8;j++){
    const y=0.25+j*0.26,z=0.31-y/2.3*0.25,w=0.44-y/2.3*0.08;
    b.box(M.aluminium,w,0.035,0.08,0,y,z);
    for(let k=0;k<3;k++)b.box(M.foyerFrame,w-0.02,0.002,0.003,0,y+0.019,z-0.025+k*0.025);
  }
  b.box(M.accentBlue,0.012,0.3,0.027,-0.213,0.63,0.24);
  b.bar(M.foyerFrame,[-0.21,0.68,0.07],[0.21,1.48,0.07],0.02,0.012);
}

/** Gerahmtes Wandbild, Mitte bei 0; Front +z. */
export function addFramedPicture(b, M, material, w, h, frame=M.frameWhite) {
  b.box(frame,w+0.04,h+0.04,0.035,0,0,0.018);
  // Bemalbare Tafeln werden als eigenes Mesh nachgereicht (js/devices.js).
  if(material.userData.board)b.slot('tafel',{material,w,h},matrixFrom(0,0,0.037));
  else b.add(material,new THREE.PlaneGeometry(w,h),matrixFrom(0,0,0.037));
}

/** Geriffelter Kegelschirm mit Unterseite; y = Schirmunterkante. */
export function addPendantLight(b, M, x, y, z, ceilingY) {
  b.rod(M.steelBlack,[x,y+0.38,z],[x,ceilingY,z],0.005,6);
  b.cylinder(M.foyerFrame,0.055,0.055,0.03,x,ceilingY-0.015,z,12);
  b.cylinder(M.flur1Pendant,0.10,0.27,0.34,x,y+0.17,z,32);
  b.cylinder(M.flur1Light,0.25,0.25,0.012,x,y+0.004,z,32);   // 2 mm unter dem Schirmboden (kein Flackern)
  for(let i=0;i<24;i++){
    const a=i*Math.PI/12;
    b.rod(M.glass,[x+Math.cos(a)*0.1,y+0.34,z+Math.sin(a)*0.1],[x+Math.cos(a)*0.27,y,z+Math.sin(a)*0.27],0.006,5);
  }
}

/** Eingangstür mit quadratischer Glasscheibe, Seitenfeld, Oberlicht. Mit leafBuilder landet das Türblatt
 *  (Platte, Scheibe, Leisten, Griff) dort, Ursprung = Bandseite unten (x = hingeX); Rückgabe { hingeX, doorW, lh }. */
export function addGlazedEntrance(b, M, {w=1.75,h=3.1,leaf=M.flur1RedDoor,glass=M.foyerGlass,leafBuilder=null}={}) {
  const f=M.foyerFrame,doorW=1.13,lx=-0.23,lh=2.3,gx=lx,gy=1.62,gw=0.29,gh=0.31,hingeX=lx-doorW/2;
  for(const x of [-w/2,w/2,lx+doorW/2+0.03])b.box(f,0.055,h,0.12,x,h/2,0);
  for(const y of [0.025,lh+0.03,h-0.03])b.box(f,w,0.055,0.12,0,y,0);
  const frame=b;
  if(leafBuilder){b=leafBuilder;b.push(-hingeX,0,0);}
  b.boxMinMax(leaf,lx-doorW/2,0.04,-0.026,gx-gw/2,lh,0.026);
  b.boxMinMax(leaf,gx+gw/2,0.04,-0.026,lx+doorW/2,lh,0.026);
  b.box(leaf,gw,gy-gh/2-0.04,0.052,gx,(gy-gh/2+0.04)/2,0);
  b.box(leaf,gw,lh-gy-gh/2,0.052,gx,(lh+gy+gh/2)/2,0);
  b.box(glass,gw,gh,0.007,gx,gy,0);
  for(const s of [-1,1]){
    // Leisten 1,5 mm in die Laibung des Türfensters (bündig flackerten die Innenseiten).
    b.box(f,0.036,gh+0.06,0.065,gx+s*(gw/2+0.0165),gy,0);
    b.box(f,gw+0.06,0.036,0.065,gx,gy+s*(gh/2+0.0165),0);
  }
  for(const [y,h0] of [[0.72,1.40],[2.05,0.43]])b.box(f,0.045,h0,0.065,gx,y,0);
  b.box(M.chrome,0.035,0.25,0.01,lx+doorW/2-0.08,1.06,0.04);
  b.rod(M.chrome,[lx+doorW/2-0.08,0.93,0.09],[lx+doorW/2-0.08,1.18,0.09],0.013,10);
  if(leafBuilder){   // Griff auch außen (Tür ist bedienbar)
    b.box(M.chrome,0.035,0.25,0.01,lx+doorW/2-0.08,1.06,-0.04);
    b.rod(M.chrome,[lx+doorW/2-0.08,0.93,-0.09],[lx+doorW/2-0.08,1.18,-0.09],0.013,10);
    for(const z of [-0.07,0.07])b.box(M.chrome,0.02,0.02,0.05,lx+doorW/2-0.08,1.06,z);
  }
  b.box(M.aluminium,0.23,0.055,0.07,lx,lh-0.035,0.035);
  if(leafBuilder)b.pop();
  b=frame;
  const sx=(w/2+lx+doorW/2+0.03)/2,sw=w/2-lx-doorW/2-0.06;
  b.box(glass,sw,lh-0.09,0.008,sx,lh/2,0);
  b.box(glass,w-0.08,h-lh-0.09,0.008,0,(h+lh)/2,0);
  return {hingeX,doorW,lh};
}

/** Zweiflügelige Tür mit echten Glasausschnitten; Vorderseite +z. */
/** Wandnahe Sitzgruppe: helle Vierkantgestelle und gepolsterte Sitzflächen. */
export function addHighTable(b,M,{length=1.7,depth=0.6,height=1.06}={}){
  b.add(M.tableTopLight,metricBoxUV(new THREE.BoxGeometry(length,0.04,depth),0.7),matrixFrom(0,height-0.02,0));   // Maserung längs
  for(const x of [-length/2+0.07,length/2-0.07]){
    for(const z of [-depth/2+0.06,depth/2-0.06])b.box(M.frameWhite,0.035,height-0.04,0.035,x,(height-0.04)/2,z);
    b.box(M.frameWhite,0.035,0.035,depth-0.09,x,0.2,0);
  }
  b.box(M.frameWhite,length-0.1,0.035,0.035,0,0.23,0);
}

export function addHighSeat(b,M,{length=0.42,depth=0.4,material=M.stoolGreen}={}){
  const h=0.74;
  b.add(M.upholstery?.get(material)??material,metricBoxUV(new RoundedBoxGeometry(length,0.13,depth,2,0.012),0.25),matrixFrom(0,h-0.065,0));
  for(const x of [-length/2+0.055,length/2-0.055])for(const z of [-depth/2+0.055,depth/2-0.055])
    b.box(M.frameWhite,0.028,h-0.13,0.028,x,(h-0.13)/2,z);
  for(const z of [-depth/2+0.055,depth/2-0.055])b.box(M.frameWhite,length-0.08,0.025,0.025,0,0.24,z);
  for(const x of [-length/2+0.055,length/2-0.055])b.box(M.frameWhite,0.025,0.025,depth-0.08,x,0.24,0);
}

export function addMobileBoard(b,M,texture,{width=1.36,height=1.02}={}){
  b.box(M.panelGrey,width,height,0.035,0,1.48,0);
  b.add(texture,new THREE.PlaneGeometry(width-0.025,height-0.025),matrixFrom(0,1.48,0.021));
  for(const s of [-1,1]){
    b.box(M.aluminium,0.025,2.02,0.025,s*width/2,1.06,0);
    b.box(M.aluminium,0.035,0.035,0.56,s*width/2,0.09,0);
    for(const z of [-0.23,0.23])b.cylinder(M.steelBlack,0.035,0.035,0.022,s*width/2,0.045,z,10,0,0,Math.PI/2);
    b.box(M.aluminium,width,0.025,0.037,0,1.48+s*height/2,0);   // 1 mm tiefer als die Tafel (Vorderseiten nicht bündig)
  }
}

export function addDepositBin(b,M){
  b.add(M.depositYellow,new RoundedBoxGeometry(0.47,0.87,0.46,2,0.035),matrixFrom(0,0.5,0));
  b.box(M.depositYellow,0.53,0.06,0.51,0,0.965,0);
  b.cylinder(M.black,0.08,0.08,0.003,0,0.997,0,20);
  for(const x of [-0.24,0.24])b.cylinder(M.steelBlack,0.095,0.095,0.045,x,0.1,-0.14,16,0,0,Math.PI/2);
  b.rod(M.steelBlack,[-0.19,0.9,-0.26],[0.19,0.9,-0.26],0.018,10);
  b.add(M.depositLabel,new THREE.PlaneGeometry(0.36,0.36),matrixFrom(0,0.63,0.232));
}

export function createDoubleDoor(M, { width = 2.1, height = 3.15, leafHeight = 2.25, entrance = false } = {}) {
  const group = new THREE.Group(), b = new PartBuilder();
  const frame = entrance ? M.facadeFrame : M.foyerWood;
  const leaf = entrance ? M.entranceBlue : M.foyerWood;
  const leafW = (width - 0.14) / 2;
  b.box(frame, 0.07, height, 0.22, -width / 2 + 0.035, height / 2, 0);
  b.box(frame, 0.07, height, 0.22, width / 2 - 0.035, height / 2, 0);
  for (const y of [leafHeight + 0.045, height - 0.035]) b.box(frame, width, 0.07, 0.22, 0, y, 0);
  b.box(frame, 0.055, height - leafHeight, 0.12, 0, (height + leafHeight) / 2, 0);
  b.box(M.glass, width - 0.12, height - leafHeight - 0.14, 0.008, 0, (height + leafHeight) / 2, 0);
  const frameGroup = b.build({ name: 'doppeltuer_zarge' });
  frameGroup.userData.fixed = true;   // fest, nur die Flügel drehen (static-batching.js)
  group.add(frameGroup);
  const leaves = [];
  for (const side of [-1, 1]) {
    const dir = -side, pivot = new THREE.Group(), p = new PartBuilder();
    pivot.position.x = side * (width / 2 - 0.07);
    group.add(pivot);
    const cx = dir * leafW / 2;
    const gw = entrance ? 0.24 : 0.14, gy = entrance ? 1.62 : 1.25, gh = entrance ? 0.28 : 0.85;
    // Vier massive Teile um das Fenster, kein Glas vor einer undurchsichtigen Platte.
    const gx = entrance ? cx : cx + dir * 0.12;
    const left = Math.min(0, dir * leafW), right = Math.max(0, dir * leafW);
    p.boxMinMax(leaf, left, 0.015, -0.025, gx - gw / 2, leafHeight, 0.025);
    p.boxMinMax(leaf, gx + gw / 2, 0.015, -0.025, right, leafHeight, 0.025);
    if (entrance) {
      // Schmaler durchsichtiger Schlitz unter dem quadratischen Fenster.
      const slit=0.065,lo=0.32,hi=1.39;
      p.boxMinMax(leaf,gx-gw/2,0.015,-0.025,gx-slit/2,gy-gh/2,0.025);
      p.boxMinMax(leaf,gx+slit/2,0.015,-0.025,gx+gw/2,gy-gh/2,0.025);
      p.boxMinMax(leaf,gx-slit/2,0.015,-0.025,gx+slit/2,lo,0.025);
      p.boxMinMax(leaf,gx-slit/2,hi,-0.025,gx+slit/2,gy-gh/2,0.025);
      p.box(M.glass,slit,hi-lo,0.006,gx,(lo+hi)/2,0);
      for(const s of [-1,1])p.box(M.aluminium,0.02,hi-lo+0.04,0.056,gx+s*(slit/2+0.009),(lo+hi)/2,0);   // 1 mm über die Laibung (nicht bündig)
      for(const y of [lo,hi])p.box(M.aluminium,slit+0.04,0.018,0.056,gx,y,0);
    } else p.boxMinMax(leaf, gx - gw / 2, 0.015, -0.025, gx + gw / 2, gy - gh / 2, 0.025);
    p.boxMinMax(leaf, gx - gw / 2, gy + gh / 2, -0.025, gx + gw / 2, leafHeight, 0.025);
    p.box(M.glass, gw, gh, 0.006, gx, gy, 0);
    const trim = entrance ? M.aluminium : M.foyerWood;
    for (const s of [-1, 1]) {
      // Leisten 1,5 mm in die Fensterlaibung, damit ihre Innenseiten nicht bündig mit ihr liegen.
      p.box(trim, 0.028, gh + 0.05, 0.06, gx + s * (gw / 2 + 0.0105), gy, 0);
      p.box(trim, gw + 0.05, 0.028, 0.06, gx, gy + s * (gh / 2 + 0.0105), 0);
      const hx = dir * (leafW - 0.11), hz = s * 0.065;
      if (entrance) {
        p.rod(M.steel, [hx, 0.9, hz], [hx, 1.15, hz], 0.014, 10);
        for (const y of [0.9, 1.15]) p.rod(M.steel, [hx, y, hz], [hx, y, s * 0.025], 0.012, 8);
      } else {
        p.box(M.steel, 0.035, 0.2, 0.008, hx, 1.05, s * 0.031);
        p.rod(M.steel, [hx, 1.08, hz], [hx - dir * 0.12, 1.08, hz], 0.01, 10);
      }
    }
    if (entrance) p.box(M.aluminium,0.055,0.42,0.055,gx,2.03,0);
    p.box(M.aluminium, 0.24, 0.055, 0.08, cx, leafHeight - 0.04, 0.02);
    p.rod(M.steel,[cx,leafHeight-0.015,0.07],[cx-dir*0.21,leafHeight+0.025,0.13],0.009,8);
    pivot.add(p.build({ name: 'doppeltuer_fluegel' }));
    leaves.push({ pivot, dir, centerX: cx, width: leafW });
  }
  return { group, leaves, leafHeight };
}

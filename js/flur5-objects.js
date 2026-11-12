// Wiederverwendbare Bauteile aus Flur 5 und dem oberen Gang (Fotos: verification/FLUR5-ABGLEICH.md).
// Lokale Konvention wie objects.js: Vorderseite/Nutzerseite zeigt nach +z, Länge entlang +x.
import * as THREE from 'three';
import { matrixFrom } from './geometry.js';
import { addRadiator } from './objects.js';
import { addMonitor, addKeyboard, addComputerTower } from './podcast-objects.js';

/** Großer Zimmerbaum (Ficus) im runden Kübel; Blätter als ein InstancedMesh. Gibt das Blatt-Mesh zurück. */
export function addPottedTree(root, b, M, x, y, z, { height = 3.0, crown = 1.05, pot = 0.36, seed = 51, leaves = 1100 } = {}) {
  const ph = pot * 2.05;
  b.cylinder(M.flur5Pot, pot, pot * 0.72, ph, x, y + ph / 2, z, 28);
  b.cylinder(M.flur5Pot, pot + 0.02, pot + 0.02, 0.04, x, y + ph - 0.02, z, 28);
  b.cylinder(M.flur5Soil, pot - 0.03, pot - 0.03, 0.012, x, y + ph - 0.03, z, 24);
  let s = seed; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  // Mehrere schlanke Stämme wie beim Ficus, oben verzweigt.
  const top = y + height * 0.55;
  for (let i = 0; i < 4; i++) {
    const a = i * 1.7 + rnd(), r = 0.08 + rnd() * 0.05;
    b.rod(M.flur3Bark, [x + Math.cos(a) * 0.04, y + ph - 0.05, z + Math.sin(a) * 0.04], [x + Math.cos(a) * r, top, z + Math.sin(a) * r], 0.028, 8);
  }
  for (let j = 0; j < 14; j++) {
    const a = j * 2.39, yy = top - 0.2 + (j % 5) * 0.18;
    b.rod(M.flur3Bark, [x, yy, z], [x + Math.cos(a) * crown * 0.75, yy + 0.35 + rnd() * 0.3, z + Math.sin(a) * crown * 0.75], 0.012, 6);
  }
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.11, 0.2), M.flur3Leaf, leaves);
  const cy = y + height - crown * 0.95;
  for (let i = 0; i < leaves; i++) {
    const a = rnd() * Math.PI * 2, v = rnd() * 2 - 1, rr = Math.sqrt(1 - v * v) * Math.pow(rnd(), 0.35), sc = 0.7 + rnd() * 0.6;
    // Krone unten etwas breiter und hängend (Fotos 10, 11).
    const spread = crown * (1.05 - 0.25 * v);
    mesh.setMatrixAt(i, matrixFrom(x + Math.cos(a) * rr * spread, cy + v * crown * 0.95, z + Math.sin(a) * rr * spread, rnd() * 2 - 1 + 0.6, a, rnd() - 0.5, sc, sc, sc));
  }
  mesh.instanceMatrix.needsUpdate = true; mesh.castShadow = true; mesh.receiveShadow = true; mesh.computeBoundingSphere();
  root.add(mesh);
  return mesh;
}

// Viereck aus vier Weltpunkten (zwei Dreiecke), für doppelseitiges Glas.
function quad(a, b, c, d) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], 2));
  g.computeVertexNormals();
  return g;
}

/** Glas-Pultoberlicht über einem Rechteck: Unterkante y0 bei x0, Oberkante y1 bei x1. Weiße Sprossen, Öffnerstangen. */
export function addPentSkylight(b, M, { x0, x1, z0, z1, y0, y1, bays = 6 }) {
  b.add(M.flur5Skylight, quad([x0, y0, z0], [x0, y0, z1], [x1, y1, z1], [x1, y1, z0]));
  for (let i = 0; i <= bays; i++) { const z = z0 + (z1 - z0) * i / bays; b.rod(M.frameWhite, [x0, y0, z], [x1, y1, z], i % bays ? .028 : .04, 6); }
  for (const t of [0, .5, 1]) b.rod(M.frameWhite, [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, z0], [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, z1], t === .5 ? .025 : .04, 6);
  // Öffnerstangen hängen von der Mittelsprosse (decke über der Treppe.jpg, sicht von oben auf flur5.jpg).
  const xm = (x0 + x1) / 2, ym = (y0 + y1) / 2;
  for (const z of [z0 + (z1 - z0) * .35, z0 + (z1 - z0) * .65]) b.rod(M.aluminium, [xm, ym - .03, z], [xm, ym - 1.1, z], .012, 6);
}

/** Brüstung mit Deckplatte, Holzhandlauf auf Stahlkonsolen und Röhrenheizkörper auf der Gangseite (+z). */
export function addParapet(b, M, { length, height = 1.0, thickness = 0.25, bottom = 0, radiator = null, material = M.flur3Wall }) {
  b.boxMinMax(material, 0, bottom, -thickness, length, height - 0.03, 0);
  b.boxMinMax(M.switchWhite, -0.004, height - 0.03, -thickness - 0.02, length + 0.004, height, 0.04);
  for (let x = 0.3; x < length; x += 1.25) {
    b.bar(M.aluminium, [x, height, -thickness / 2], [x, height + 0.15, -thickness / 2 + 0.03], 0.012, 0.05);
  }
  b.rod(M.handrailWood, [0.05, height + 0.17, -thickness / 2 + 0.03], [length - 0.05, height + 0.17, -thickness / 2 + 0.03], 0.03, 12);
  if (radiator) { b.push(radiator.x ?? length / 2, 0, 0); addRadiator(b, M, { width: radiator.width, height: radiator.height ?? 0.62, depth: 0.16, y0: 0.12, wallGap: 0.03 }); b.pop(); }
}

/** Galerie-/Treppengeländer: graue Pfosten mit Pfeilspitze unter der Deckenkante, farbige Stäbe, Holzhandlauf. */
export function addGalleryRailing(b, M, { length, height = 1.05, spacing = 1.0, tip = 0.42 }) {
  const n = Math.max(1, Math.round(length / spacing));
  for (let i = 0; i <= n; i++) {
    const x = length * i / n;
    b.box(M.flur3Frame, 0.045, height + tip, 0.045, x, (height - tip) / 2, 0.06);
    // Pfeilspitze am unteren Pfostenende (sicht von flur 4 auf flur 5.jpg).
    b.add(M.flur3Frame, new THREE.ConeGeometry(0.05, 0.12, 4), matrixFrom(x, -tip - 0.05, 0.06, Math.PI, Math.PI / 4, 0));
  }
  for (let k = 1; k <= 5; k++) b.rod(k === 3 ? M.redSteel : M.blueSteel, [0, k * 0.16, 0.06], [length, k * 0.16, 0.06], 0.007, 8);
  b.rod(M.handrailWood, [-0.03, height + 0.02, 0.06], [length + 0.03, height + 0.02, 0.06], 0.028, 12);
}

/** Langer PC-Tisch mit weißer Platte, dunkelblauem Gestell, Bildschirmen und Rechnern darunter. */
export function addHallPcDesk(b, M, { length = 2.6, depth = 0.7, screens = 4 } = {}) {
  b.box(M.r131Desk, length, 0.03, depth, 0, 0.745, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(M.r131Steel, 0.045, 0.73, 0.045, sx * (length / 2 - 0.05), 0.365, sz * (depth / 2 - 0.05));
  for (const sz of [-1, 1]) b.box(M.r131Steel, length - 0.1, 0.05, 0.03, 0, 0.7, sz * (depth / 2 - 0.05));
  b.box(M.r131Steel, length - 0.1, 0.03, 0.03, 0, 0.08, -depth / 2 + 0.05);
  for (let i = 0; i < screens; i++) {
    const x = (i - (screens - 1) / 2) * length / screens;
    b.push(x, 0.76, -0.16); addMonitor(b, M, { width: 0.5, height: 0.3 }); b.pop();
    if (i % 2 === 0 || screens < 3) { b.push(x, 0.76, 0.12); addKeyboard(b, M); b.pop(); }
    b.push(x + 0.12, 0, -0.08); addComputerTower(b, M); b.pop();
  }
}

/** Schalenstuhl mit Chrom-Kufengestell (8.jpg). Sitz zeigt nach +z. */
export function addShellChair(b, M, { material = M.flur3BlueSeat } = {}) {
  b.box(material, 0.44, 0.03, 0.42, 0, 0.46, 0.02);
  b.box(material, 0.44, 0.40, 0.03, 0, 0.67, -0.2, -0.12);
  for (const sx of [-1, 1]) {
    b.rod(M.chrome, [sx * 0.2, 0.01, 0.25], [sx * 0.2, 0.01, -0.25], 0.011, 6);
    b.rod(M.chrome, [sx * 0.2, 0.01, 0.2], [sx * 0.19, 0.45, 0.18], 0.011, 6);
    b.rod(M.chrome, [sx * 0.2, 0.01, -0.2], [sx * 0.19, 0.45, -0.16], 0.011, 6);
  }
}

/** Bogenhanf im kleinen Topf (8.jpg, 11.jpg). */
export function addSnakePlant(b, M, { seed = 7 } = {}) {
  b.cylinder(M.flur5Pot, 0.17, 0.13, 0.3, 0, 0.15, 0, 16);
  let s = seed; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < 16; i++) {
    const a = rnd() * Math.PI * 2, r = 0.03 + rnd() * 0.09, h = 0.55 + rnd() * 0.5;
    b.add(M.flur3Leaf, new THREE.PlaneGeometry(0.06, h), matrixFrom(Math.cos(a) * r, 0.3 + h / 2, Math.sin(a) * r, Math.cos(a) * 0.2, a, Math.sin(a) * 0.2));
  }
}

/** Runde Wandleuchte (13.jpg, 14.jpg): flacher Ring mit leuchtender Scheibe, Vorderseite +z. */
export function addRoundWallLamp(b, M, panel, { radius = 0.15 } = {}) {
  b.cylinder(M.switchWhite, radius + 0.015, radius + 0.015, 0.03, 0, 0, 0.015, 24, Math.PI / 2);
  b.cylinder(panel, radius, radius, 0.012, 0, 0, 0.034, 24, Math.PI / 2);
}

/** Wandspender für Desinfektionsmittel mit Tropfschale (1.jpg, 3.jpg), Vorderseite +z. */
export function addSanitizer(b, M) {
  b.box(M.flur5Sanitizer, 0.17, 0.26, 0.1, 0, 0, 0.05);
  b.box(M.panelGrey, 0.07, 0.08, 0.004, 0, 0.04, 0.102);
  b.box(M.flur5Sanitizer, 0.04, 0.3, 0.03, 0, -0.3, 0.015);
  b.box(M.flur5Sanitizer, 0.16, 0.02, 0.12, 0, -0.45, 0.06);
}

/** Wandhydrantenschrank grau mit Brandschutzzeichen (oben tür 7.jpg), Vorderseite +z. */
export function addHoseCabinet(b, M, { width = 0.75, height = 1.0 } = {}) {
  b.box(M.flur5Hydrant, width, height, 0.12, 0, 0, 0.06);
  b.add(M.fireSign, new THREE.PlaneGeometry(0.12, 0.3), matrixFrom(width / 2 - 0.1, 0.15, 0.122));
  for (const x of [-0.08, 0.04]) b.cylinder(M.steelBlack, 0.03, 0.03, 0.02, x, -0.08, 0.125, 12, Math.PI / 2);
}

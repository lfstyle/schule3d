// Spüle, Geräte und Kleinteile der Küchenzeile im Aufenthaltsraum
// (Fotos fotos/aufenthaltsraum/details/IMG_4597.JPG und IMG_4668.JPG, Stand Oktober 2026).
//
// Konvention wie in objects.js: Ursprung am Boden bzw. auf der Abstellfläche, Vorderseite +z, Breite entlang x.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { matrixFrom } from './geometry.js';

/**
 * Einbauspüle: Becken links, gerippte Abtropffläche rechts, Einhebelmischer hinten zwischen beiden.
 * Ursprung = Mitte der Arbeitsplattenoberkante. Liefert das Beckenrechteck (lokal) für das Ausschneiden der Platte;
 * mit b = null nur dieses Rechteck.
 */
export function addInsetSink(b, M, { w = 0.78, d = 0.48, bowlW = 0.36, bowlD = 0.34, depth = 0.15 } = {}) {
  const rim = 0.004, wall = 0.004;
  const x0 = -w / 2 + 0.045, x1 = x0 + bowlW;
  const z0 = -bowlD / 2 + 0.01, z1 = z0 + bowlD;
  if (!b) return { x0, x1, z0, z1 };
  const S = M.sinkSteel ?? M.steel;
  // Rand mit Öffnung über dem Becken
  b.boxMinMax(S, -w / 2, 0, -d / 2, x0, rim, d / 2);
  b.boxMinMax(S, x1, 0, -d / 2, w / 2, rim, d / 2);
  b.boxMinMax(S, x0, 0, -d / 2, x1, rim, z0);
  b.boxMinMax(S, x0, 0, z1, x1, rim, d / 2);
  // Becken (Wände leicht nach innen versetzt, damit sie nicht in der Platte flackern)
  b.boxMinMax(S, x0, -depth, z0, x1, -depth + wall, z1);
  b.boxMinMax(S, x0, -depth, z0, x0 + wall, rim - 0.001, z1);
  b.boxMinMax(S, x1 - wall, -depth, z0, x1, rim - 0.001, z1);
  b.boxMinMax(S, x0, -depth, z0, x1, rim - 0.001, z0 + wall);
  b.boxMinMax(S, x0, -depth, z1 - wall, x1, rim - 0.001, z1);
  b.cylinder(M.chrome, 0.035, 0.035, 0.003, (x0 + x1) / 2 + 0.08, -depth + wall + 0.0015, z0 + 0.12, 16);
  // Rippen der Abtropffläche
  for (let i = 0; i < 6; i++) {
    b.box(S, w / 2 - x1 - 0.12, 0.004, 0.008, (x1 + w / 2) / 2 + 0.01, rim + 0.002, -0.13 + i * 0.05);
  }
  // Einhebelmischer: Sockel, Körper, Hebel, Auslauf über das Becken
  const tx = x1 + 0.025, tz = -d / 2 + 0.06;
  b.cylinder(M.chrome, 0.026, 0.028, 0.03, tx, rim + 0.015, tz, 16);
  b.cylinder(M.chrome, 0.021, 0.024, 0.09, tx, rim + 0.075, tz, 16);
  b.box(M.chrome, 0.022, 0.016, 0.07, tx, rim + 0.13, tz + 0.02, -0.25, 0, 0);
  b.rod(M.chrome, [tx, rim + 0.09, tz], [tx - 0.17, rim + 0.115, tz + 0.06], 0.009, 8);
  b.cylinder(M.chrome, 0.011, 0.011, 0.03, tx - 0.17, rim + 0.1, tz + 0.06, 10);
  return { x0, x1, z0, z1 };
}

/** Mikrowelle (silber, schwarze Glastür, Drehknöpfe rechts, Lüftungsschlitze links). */
export function addMicrowave(b, M, x, y, z, ry = 0, { w = 0.45, h = 0.26, d = 0.34 } = {}) {
  b.push(x, y, z, ry);
  for (const [fx, fz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(M.black, 0.03, 0.012, 0.03, fx * (w / 2 - 0.04), 0.006, fz * (d / 2 - 0.04));
  b.add(M.steel, new RoundedBoxGeometry(w, h, d, 2, 0.012), matrixFrom(0, 0.012 + h / 2, 0));
  const doorW = w * 0.74;
  b.box(M.screenBlack ?? M.black, doorW - 0.02, h - 0.035, 0.008, -w / 2 + doorW / 2, 0.012 + h / 2, d / 2 + 0.003);
  b.box(M.chrome, 0.012, h - 0.06, 0.016, -w / 2 + doorW - 0.02, 0.012 + h / 2, d / 2 + 0.01);
  for (const ky of [0.66, 0.38]) b.cylinder(M.chrome, 0.018, 0.02, 0.022, w / 2 - (w - doorW) / 2, 0.012 + h * ky, d / 2 + 0.01, 14, Math.PI / 2, 0, 0);
  for (let i = 0; i < 7; i++) b.box(M.black, 0.002, 0.07, 0.008, -w / 2 - 0.0005, 0.06, -d / 2 + 0.06 + i * 0.016);
  b.pop();
}

/** Wasserkocher: schwarzer Körper, Chromdeckel, Sockel. */
export function addKettle(b, M, x, y, z, ry = 0) {
  b.push(x, y, z, ry);
  b.cylinder(M.chrome, 0.085, 0.088, 0.016, 0, 0.008, 0, 18);
  b.cylinder(M.black, 0.07, 0.074, 0.19, 0, 0.11, 0, 18);
  b.cylinder(M.chrome, 0.072, 0.07, 0.045, 0, 0.225, 0, 18);
  b.box(M.black, 0.03, 0.17, 0.035, 0, 0.12, -0.085);
  b.box(M.black, 0.035, 0.03, 0.03, 0, 0.215, 0.075);
  b.pop();
}

/** Kaffeepadmaschine (anthrazit): runder Sockel vorn, hoher Wassertank hinten, Kopf mit Auslauf. */
export function addPadCoffeeMachine(b, M, x, y, z, ry = 0) {
  const G = M.padMachine ?? M.black;
  b.push(x, y, z, ry);
  b.cylinder(G, 0.1, 0.105, 0.045, 0, 0.0225, 0.05, 22);
  b.cylinder(M.black, 0.055, 0.055, 0.004, 0, 0.047, 0.07, 18);
  for (const bx of [-0.05, 0, 0.05]) b.cylinder(M.black, 0.008, 0.008, 0.004, bx, 0.046, 0.13, 8);
  b.cylinder(G, 0.07, 0.078, 0.3, 0, 0.17, -0.07, 20, -0.06, 0, 0);
  b.add(G, new RoundedBoxGeometry(0.13, 0.1, 0.19, 2, 0.04), matrixFrom(0, 0.31, -0.01, -0.12, 0, 0));
  b.box(M.black, 0.07, 0.012, 0.09, 0, 0.365, 0.015, -0.12, 0, 0);
  b.box(M.black, 0.045, 0.05, 0.03, 0, 0.245, 0.07);
  b.pop();
}

/** Zwei ineinandergestellte Pappbecher. */
export function addPaperCups(b, M, x, y, z) {
  b.cylinder(M.paperCup ?? M.paper, 0.04, 0.03, 0.09, x, y + 0.045, z, 16);
  b.cylinder(M.paperCup ?? M.paper, 0.041, 0.031, 0.09, x, y + 0.11, z, 16);
}

/** Zerknülltes Spültuch (fester Zufall, damit es bei jedem Laden gleich aussieht). */
export function addCloth(b, M, x, y, z, ry = 0) {
  const geo = new THREE.IcosahedronGeometry(0.075, 2);
  const p = geo.attributes.position;
  let s = 7;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < p.count; i++) {
    const k = 0.75 + rnd() * 0.45;
    p.setXYZ(i, p.getX(i) * k * 1.35, Math.max(p.getY(i) * k * 0.28, -0.004), p.getZ(i) * k);
  }
  geo.computeVertexNormals();
  b.add(M.clothYellow ?? M.paper, geo, matrixFrom(x, y + 0.012, z, 0, ry, 0));
}

/** CO2-Feuerlöscher mit Trichter an einer Wandhalterung (Wand bei lokal z = 0). */
export function addWallExtinguisher(b, M, x, y, z, ry = 0) {
  b.push(x, y, z, ry);
  b.box(M.black, 0.06, 0.12, 0.012, 0, 0.47, 0.006);
  b.cylinder(M.red, 0.07, 0.07, 0.46, 0, 0.25, 0.085, 18);
  b.add(M.red, new THREE.SphereGeometry(0.07, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), matrixFrom(0, 0.48, 0.085));
  b.cylinder(M.black, 0.02, 0.022, 0.06, 0, 0.57, 0.085, 10);
  b.rod(M.red, [0, 0.59, 0.085], [0.11, 0.63, 0.1], 0.009, 6);
  b.rod(M.black, [0.015, 0.56, 0.11], [0.09, 0.54, 0.16], 0.01, 6);
  b.cylinder(M.black, 0.045, 0.014, 0.12, 0.12, 0.5, 0.17, 12, 0, 0, -1.1);
  b.box(M.paper, 0.06, 0.12, 0.004, 0, 0.27, 0.156);
  b.pop();
}

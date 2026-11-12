// Wiederverwendbare Bauteile für Serverräume (Raum 132). Ursprung: Bodenmitte, Front zeigt nach +z.
import * as THREE from 'three';
import { matrixFrom } from './geometry.js';

/** 42-HE-Serverschrank mit Rahmen, Griff und leuchtender Front (Bestückung 0–2, siehe server-materials.js). */
export function addServerRack(b, M, { variant = 0, w = 0.6, h = 2.0, d = 0.9 } = {}) {
  const plinth = 0.06, f = d / 2;
  b.box(M.serverRack, w - 0.02, plinth, d - 0.04, 0, plinth / 2, 0);
  b.box(M.serverRack, w, h - plinth, d, 0, plinth + (h - plinth) / 2, 0);
  // Front 2 cm hinter dem Türrahmen
  const y0 = 0.1, y1 = h - 0.06;
  b.add(M.serverFronts[variant], new THREE.PlaneGeometry(w - 0.06, y1 - y0), matrixFrom(0, (y0 + y1) / 2, f + 0.002));
  for (const s of [-1, 1]) b.box(M.serverRackEdge, 0.03, h - plinth, 0.02, s * (w / 2 - 0.015), plinth + (h - plinth) / 2, f + 0.01);
  b.box(M.serverRackEdge, w - 0.06, h - y1, 0.02, 0, (h + y1) / 2, f + 0.01);
  b.box(M.serverRackEdge, w - 0.06, y0 - plinth, 0.02, 0, (y0 + plinth) / 2, f + 0.01);
  b.box(M.chrome, 0.014, 0.2, 0.02, w / 2 - 0.015, 1.12, f + 0.03);
  // kleines Typenschild oben
  b.box(M.serverRackEdge, 0.16, 0.025, 0.004, 0, h - 0.03, f + 0.022);
}

/** Kabelrinne (Gitter) mit Kabelbündeln, hängt an Gewindestangen von der Decke. length entlang lokal z. */
export function addCableTray(b, M, { length, width = 0.3, ceiling = 1, cables = true } = {}) {
  for (const s of [-1, 1]) b.box(M.serverTray, 0.006, 0.06, length, s * width / 2, 0.03, 0);
  for (let z = -length / 2 + 0.1; z < length / 2; z += 0.3) b.box(M.serverTray, width, 0.008, 0.02, 0, 0.004, z);
  for (let z = -length / 2 + 0.25; z < length / 2; z += 1.4) {
    for (const s of [-1, 1]) b.cylinder(M.serverTray, 0.005, 0.005, ceiling, s * (width / 2 + 0.01), ceiling / 2, z, 6);
    b.box(M.serverTray, width + 0.05, 0.02, 0.03, 0, -0.005, z);
  }
  if (!cables) return;
  b.box(M.serverCableBlue, 0.12, 0.035, length - 0.04, -0.06, 0.026, 0);
  b.box(M.serverCableYellow, 0.06, 0.03, length - 0.04, 0.05, 0.023, 0);
  b.box(M.serverCableGrey, 0.05, 0.04, length - 0.04, 0.11, 0.028, 0);
}

/** Wand-Klimagerät (Split), Rückseite an der Wand, Front nach +z. */
export function addWallAC(b, M) {
  b.box(M.serverAC, 0.9, 0.29, 0.21, 0, 0, 0.105);
  b.box(M.black, 0.8, 0.04, 0.004, 0, -0.115, 0.212);   // Luftauslass mit Lamellen
  for (const y of [-0.105, -0.125]) b.box(M.serverAC, 0.8, 0.004, 0.012, 0, y, 0.218);
  b.box(M.serverACLed, 0.012, 0.012, 0.004, 0.36, 0.06, 0.212);
}

// Raum 131 „Datenverarbeitung“ (DV-Klassenzimmer): alle 30 Referenzen in fotos/Datenverarbeitung 131.
// Lage nach Rettungsplan/Umrissskizze: südlich der Außentreppe von Flur 2, Tür 131 in der Flurwand,
// Fensterfront nach außen. Alle Maße sind Schätzungen (siehe docs/PLANUNG.md, Abschnitte 20/21).
// Tür, Flurwand (Westwand) und Treppenwand (Nordwand bis x = 17,98) gehören zu flur2.js.
import * as THREE from 'three';
import { PartBuilder, matrixFrom, metricBoxUV } from '../geometry.js';
import { addWall, addCeilingLight, addSwitchPlate, addRadiator,
  addFramedPicture, addFireExtinguisher, createWallClock } from '../objects.js';
import { addCable, addStudioTripod } from '../podcast-objects.js';
import { addDVDesk, addDVWorkstation, addDVChair, addDVWindow, addDVSink, addDVPrinter } from '../raum131-objects.js';
import { FLUR2 } from './flur2.js';

export const RAUM131 = {
  west: FLUR2.east + 0.2, east: 19.4, north: FLUR2.exit.south + 0.2, south: 5.95,
  y: FLUR2.y, roof: FLUR2.roof, ground: FLUR2.exit.y, facade: 0.45, wall: 0.2,
  door: { z: -1.8 },
  windows: [-1.96, 0.18, 2.32, 4.46], winW: 1.3, winH: 2.08, sill: 0.93,   // Fensterachsen (z), Brüstung über Boden
};

export function buildRaum131(ctx) {
  const { scene, collision: C, materials: M, registerObject, interactions, lighting, audio, map } = ctx;
  const R = RAUM131, Y = R.y, W = R.west, E = R.east, N = R.north, S = R.south;
  const root = new THREE.Group(); root.name = 'raum_131'; scene.add(root);
  const walls = new PartBuilder(), perim = new PartBuilder(), b = new PartBuilder(), fixtures = new PartBuilder(), lights = [];
  const anchor = (id, type, name, x, y, z) => {
    const o = new THREE.Object3D(); o.position.set(x, y, z); root.add(o); registerObject(id, type, name, o); return o;
  };
  const block = (id, x, z, w, d, h, tag = 'moebel', bottom = Y, rot = 0) => {
    C.add({ x, z, w, d, rot, bottom, top: bottom + h, tag, id });
    const wx = Math.abs(Math.cos(rot)) * w + Math.abs(Math.sin(rot)) * d, dz = Math.abs(Math.sin(rot)) * w + Math.abs(Math.cos(rot)) * d;
    map.furniture.push([x - wx / 2, z - dz / 2, x + wx / 2, z + dz / 2]);
  };
  // Außenwände stehen auf dem Gelände (Raum liegt im Zwischengeschoss), Sockelleisten separat.
  const wall = (a, c, openings = [], { thickness = R.wall, y0 = R.ground, height = R.roof - R.ground } = {}) => {
    const r = addWall(walls, M, { start: a, end: c, openings, height, y0, thickness, material: M.flur2Wall, baseboard: false });
    r.colliders.forEach((v) => C.add({ ...v, tag: 'wand' })); map.walls.push(...r.segments); return r;
  };
  const surface = (material, x0, z0, x1, z1, y, down = false, tile = 1) => {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0); g.rotateX(down ? Math.PI / 2 : -Math.PI / 2);
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      const x = p.getX(i) + (x0 + x1) / 2, z = p.getZ(i) + (z0 + z1) / 2;
      uv.setXY(i, tile ? x / tile : (x - x0) / (x1 - x0), tile ? z / tile : 1 - (z - z0) / (z1 - z0));
    }
    const o = new THREE.Mesh(g, material); o.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); o.receiveShadow = true; root.add(o); return o;
  };
  const plane = (mat, w, h, x, y, z, ry = 0, target = b) => target.add(mat, new THREE.PlaneGeometry(w, h), matrixFrom(x, y, z, 0, ry));

  // ------------------------------------------------------------ Boden, Decke, Außenhülle
  surface(M.r131Carpet, W, N, E, S, Y, false, 0.9);
  C.addBox(W, N, E, S, Y - 0.18, Y, { tag: 'boden', surface: 'carpet' });
  surface(M.flur2Wall, W, N, E, S, Y - 0.2, true, 2);           // Deckenuntersicht: von außen nicht durchsichtig
  surface(M.r131Ceiling, W, N, E, S, R.roof, true, null);        // einmaliger Deckenplan, ca. 58 × 59 cm
  surface(M.foyerRoof, W, N, E, S, R.roof + 0.17).castShadow = true;
  C.addBox(W, N, E, S, R.roof, R.roof + 0.18, { tag: 'decke' });
  // Nordwand ab dem Ende der Treppenwand (x = 17,98) bis zur Fassade; 3 mm Überlappung
  wall([FLUR2.exit.east - 0.003, N], [E + R.facade, N]);
  // Fensterfront (Ost): vier Fenster mit tiefer Laibung
  const winY = Y + R.sill - R.ground;
  wall([E, N], [E, S], R.windows.map((z) => ({ u: z - N - R.winW / 2, w: R.winW, y: winY, h: R.winH })), { thickness: R.facade });
  // Vorderwand (Süd) und Westwand zwischen Flur-2-Südende und Vorderwand (Richtung Serverraum 132)
  wall([E + R.facade, S], [W - 0.003, S]);
  wall([W, S + R.wall], [W, FLUR2.south - 0.003]);

  // Deckenschürze entlang der Flurwand und zwei Wandpfeiler (raum01/raum07, IMG_4804)
  perim.boxMinMax(M.flur2Wall, W, R.roof - 0.3, N, W + 0.43, R.roof, S);
  for (const [z0, z1] of [[N, N + 0.5], [S - 0.8, S]]) {
    perim.boxMinMax(M.flur2Wall, W, Y, z0, W + 0.38, R.roof - 0.3, z1);
    C.addBox(W, z0, W + 0.38, z1, Y, R.roof, { tag: 'wand' });
  }
  // Dunkler Teppichsockel wie in IMG_4804, keine grauen Fliesenleisten
  const skirt = (x0, z0, x1, z1) => perim.boxMinMax(M.r131Carpet, x0, Y, z0, x1, Y + 0.07, z1);
  skirt(W + 0.38, N, E, N + 0.012); skirt(W + 0.38, S - 0.012, E, S); skirt(E - 0.012, N, E, S);
  skirt(W, N + 0.5, W + 0.012, R.door.z - 0.56); skirt(W, R.door.z + 0.56, W + 0.012, S - 0.8);

  // ------------------------------------------------------------ Fenster, Fensterbank, Heizkörper
  for (const [i, z] of R.windows.entries()) {
    perim.push(E, Y + R.sill + R.winH / 2, z, -Math.PI / 2);
    addDVWindow(perim, M, { width: R.winW, height: R.winH, open: i === 0 });
    perim.pop();
    // Holzbank in der Laibung, 3 mm über der Öffnungsunterkante (sonst bündig = Flackern)
    perim.boxMinMax(M.foyerWood, E, Y + R.sill - 0.032, z - R.winW / 2, E + 0.19, Y + R.sill + 0.003, z + R.winW / 2);
    perim.push(E, Y, z, -Math.PI / 2); addRadiator(perim, M, { width: 1.0, height: 0.55, y0: 0.13, depth: 0.12 }); perim.pop();
    block('r131_heizung_' + z, E - 0.12, z, 0.2, 1.05, 0.7);
  }
  // Durchgehende Fensterbank, darunter weißer Brüstungskanal mit Steckdosen (IMG_4798/4808)
  perim.boxMinMax(M.foyerWood, E - 0.28, Y + R.sill - 0.032, N, E, Y + R.sill + 0.003, S);
  perim.boxMinMax(M.duct, E - 0.07, Y + 0.76, N, E, Y + 0.9, S);
  for (let z = N + 0.6; z < S - 0.3; z += 1.07) for (const dz of [0, 0.09]) addSwitchPlate(perim, M, E - 0.07, Y + 0.83, z + dz, -Math.PI / 2, true);
  // Lautsprecher oben an den Fensterpfeilern
  for (const z of [-0.89, 3.39]) perim.boxMinMax(M.switchWhite, E - 0.16, Y + 2.72, z - 0.11, E, Y + 3.0, z + 0.11);

  // ------------------------------------------------------------ Flurwand (West)
  perim.boxMinMax(M.duct, W, Y + 0.95, R.door.z + 0.62, W + 0.06, Y + 1.07, S - 0.8);
  for (let z = R.door.z + 1.1; z < S - 0.8; z += 0.82) for (const dz of [0, 0.09])
    addSwitchPlate(perim, M, W + 0.06, Y + 1.01, z + dz, Math.PI / 2, true);
  perim.push(W + 0.014, Y + 1.72, 0.95, Math.PI / 2);
  addFramedPicture(perim, M, M.r131Board, 2.4, 1.2, M.r131Rubber); perim.pop();
  perim.push(W + 0.014, Y + 1.71, 3.25, Math.PI / 2);
  addFramedPicture(perim, M, M.r131Keyboard, 1.76, 0.88, M.r131DeskEdge); perim.pop();
  perim.cylinder(M.r131PVC, 0.035, 0.035, 0.02, W + 0.015, Y + 2.32, 3.7, 12, 0, 0, Math.PI / 2);
  // Hohes Klimagerät am vorderen Ende des Unterzugs, einschließlich sichtbarer Lamellen.
  perim.boxMinMax(M.r131PVC, W + 0.08, Y + 2.62, 4.55, W + 0.70, Y + 3.13, 5.13);
  perim.boxMinMax(M.r131Rubber, W + 0.701, Y + 2.67, 4.62, W + 0.706, Y + 2.91, 5.06);
  for (let y = 2.69; y < 2.91; y += 0.034) perim.box(M.r131PVC, 0.025, 0.011, 0.44, W + 0.716, Y + y, 4.84);
  anchor('r131_klimageraet', 'equipment', 'Klimagerät', W + 0.55, Y + 2.85, 4.85);
  // Drei Wippen und eine Steckdose, Beschriftung über der türnahen Schalterreihe.
  const sw = new PartBuilder();
  for (const y of [1.25, 1.16, 1.07]) addSwitchPlate(sw, M, 0, y, 0);
  addSwitchPlate(sw, M, 0, 0.98, 0, 0, true);
  const switchMesh = sw.build({ name: 'lichtschalter_131' });
  switchMesh.position.set(W + 0.001, Y, R.door.z - 0.75); switchMesh.rotation.y = Math.PI / 2; root.add(switchMesh);
  registerObject('lichtschalter_131', 'switch', 'Licht Raum 131', switchMesh);
  interactions.register(switchMesh, { id: 'lichtschalter_131', type: 'switch',
    label: () => (lighting.isOn('licht_131') ? 'Licht Raum 131 ausschalten' : 'Licht Raum 131 einschalten'),
    onInteract: () => { lighting.toggle('licht_131'); audio.click(); } });
  plane(M.r131Number, 0.3, 0.15, W + 0.015, Y + 2.38, R.door.z - 0.75, Math.PI / 2, perim);
  perim.push(W + 0.95, Y + 1.55, N + 0.012); addFramedPicture(perim, M, M.flur2Plan, 0.62, 0.82, M.glass); perim.pop();

  // ------------------------------------------------------------ Tafelwand / Waschecke
  const fz = S - 0.012;
  perim.push(17.32, Y + 1.31, fz, Math.PI); addFramedPicture(perim, M, M.r131Whiteboard, 2.36, 1.16, M.aluminium); perim.pop();
  perim.boxMinMax(M.aluminium, 16.12, Y + 0.70, S - 0.095, 18.52, Y + 0.73, S - 0.012);
  for (const [i, mat] of [M.r131Rubber, M.red, M.blueSteel].entries())
    perim.cylinder(mat, 0.006, 0.006, 0.12, 17.9 + i * 0.14, Y + 0.738, S - 0.055, 6, 0, 0, Math.PI / 2);
  plane(M.r131Pockets, 0.62, 0.78, 15.79, Y + 1.93, S - 0.016, Math.PI, perim);
  perim.push(14.83, Y, S - 0.005, Math.PI);
  perim.box(M.r131DeskEdge, 1.1, 0.07, 0.44, 0, 0.035, 0.23);
  perim.box(M.r131PVC, 1.12, 1.98, 0.46, 0, 1.06, 0.23);
  for (const side of [-1, 1]) {
    perim.box(M.r131PVC, 0.55, 1.92, 0.018, side * 0.28, 1.065, 0.473);
    perim.box(M.r131DeskEdge, 0.045, 0.12, 0.015, side * 0.065, 1.03, 0.488);
    perim.box(M.r131Rubber, 0.021, 0.08, 0.003, side * 0.065, 1.03, 0.498);
    for (const y of [0.25, 1.0, 1.8]) perim.box(M.chrome, 0.017, 0.05, 0.015, side * 0.556, y, 0.476);
  }
  perim.box(M.r131Rubber, 0.003, 1.9, 0.003, 0, 1.065, 0.484);
  perim.cylinder(M.chrome, 0.012, 0.012, 0.006, -0.065, 0.91, 0.499, 12, Math.PI / 2); perim.pop();
  block('r131_schrank', 14.83, S - 0.24, 1.12, 0.47, 2.05);
  plane(M.r131Notes, 0.43, 0.86, 15.10, Y + 1.55, S - 0.493, Math.PI, perim);
  plane(M.r131NotesRight, 0.43, 0.65, 14.56, Y + 1.67, S - 0.493, Math.PI, perim);
  // Offene Papierkiste: der Innenraum und die einzelnen Seiten bleiben erkennbar.
  b.push(15.68, Y, S - 0.3);
  b.box(M.blueSteel, 0.43, 0.02, 0.38, 0, 0.01, 0);
  for (const x of [-0.208, 0.208]) b.box(M.blueSteel, 0.014, 0.29, 0.38, x, 0.155, 0);
  for (const z of [-0.183, 0.183]) b.box(M.blueSteel, 0.43, 0.28, 0.014, 0, 0.15, z);
  for (let y = 0.04; y < 0.28; y += 0.06) b.box(M.blueSteel, 0.44, 0.009, 0.018, 0, y, -0.192);
  b.box(M.paper, 0.29, 0.02, 0.21, 0, 0.045, 0.02, 0.04, 0.12);
  plane(M.r131Paper, 0.23, 0.1, 0, 0.14, -0.194, Math.PI); b.pop();
  block('r131_papierkiste', 15.68, S - 0.3, 0.45, 0.39, 0.3);
  perim.boxMinMax(M.red, 13.75, Y + 1.42, S - 0.11, 14.02, Y + 1.73, S - 0.012);
  plane(M.r131Extinguisher, 0.23, 0.27, 13.885, Y + 1.575, S - 0.112, Math.PI, perim);
  perim.boxMinMax(M.r131PVC, 13.38, Y + 1.39, S - 0.16, 13.68, Y + 1.77, S - 0.012);
  perim.box(M.paper, 0.15, 0.07, 0.012, 13.53, Y + 1.38, S - 0.12);
  perim.push(13.91, Y + 0.45, S - 0.1); addFireExtinguisher(perim, M, 0, 0, Math.PI); perim.pop();
  plane(M.fireSign, 0.15, 0.18, 13.885, Y + 2.13, S - 0.014, Math.PI, perim);
  const clock = createWallClock(M); clock.position.set(13.64, Y + 2.48, S - 0.012); clock.rotation.y = Math.PI; root.add(clock);
  // Becken sitzt auf der zum Raum weisenden Pfeilerseite, nicht auf der Tafelwand.
  plane(M.r131Tiles, 0.8, 0.92, W + 0.385, Y + 0.77, S - 0.4, Math.PI / 2);
  b.push(W + 0.39, Y, S - 0.4, Math.PI / 2); addDVSink(b, M); b.pop();
  block('r131_waschbecken', W + 0.62, S - 0.4, 0.4, 0.52, 0.91);

  // ------------------------------------------------------------ 18 Schülerplätze: 3×2 an der Flurwand, 4×3 am Fenster
  const rows = [
    ...[-0.3, 1.7, 3.7].map(z => ({ x: 13.68, z, width: 2.4, seats: 2 })),
    ...[-1.45, 0.3, 2.05, 3.8].map(z => ({ x: 17.5, z, width: 3.3, seats: 3, blue: z === 3.8 })),
  ];
  const chairs = [];
  for (const [rowIndex, row] of rows.entries()) {
    b.push(row.x, Y, row.z); addDVDesk(b, M, row); b.pop();
    deskCollision('r131_tisch_' + rowIndex, row.x, row.z, row.width, 0.75);
    for (let i = 0; i < row.seats; i++) {
      const x = row.x + (i - (row.seats - 1) / 2) * row.width / row.seats;
      // 10 cm einschieben; an Dreierplätzen seitlich an den Rechnerhaltern vorbeiführen.
      chairs.push({ x: x + (row.seats === 3 ? 0.08 : 0), z: row.z - (row.seats === 3 ? 0.42 : 0.52) + (i % 2) * 0.06, ry: (rowIndex % 3 - 1) * 0.06 });
      const towerX = row.x + (row.seats === 2 ? (i ? 1 : -1) * (row.width / 2 - 0.19) : (i - 1) * row.width / 3 - 0.31);
      C.add({ x: towerX, z: row.z + 0.025, w: 0.28, d: 0.49, bottom: Y + 0.12, top: Y + 0.57, tag: 'moebel', id: 'r131_rechner_' + rowIndex + '_' + i });
    }
  }
  // Die Tischkamera aus IMG_4799 steht am Reihenende auf dem Tisch, nicht im Mittelgang.
  b.push(16.08, Y + 0.77, 2.13); addStudioTripod(b, M, { height: 0.86, spread: 0.14, camera: true }); b.pop();
  anchor('r131_stativ', 'equipment', 'Tischkamera', 16.08, Y + 0.77, 2.13);

  // Lehrer-L: zwei Arbeitsflächen, Schubladen, Drucker und Dokumentenkamera (IMG_4808/4809).
  // Kompakter Druckeransatz statt der zu langen Sperre zur Tafelwand. Die 35 cm
  // vorgerückte Arbeitsfläche lässt hinter dem eingeschobenen Stuhl einen Laufweg.
  const teacherZ = 4.60, printerZ = teacherZ - 0.04;
  b.push(18.3, Y, teacherZ, Math.PI); addDVDesk(b, M, { width: 1.6, depth: 0.75, teacher: true }); b.pop();
  deskCollision('r131_lehrertisch', 18.3, teacherZ, 1.6, 0.75);
  b.push(17.12, Y, printerZ, Math.PI / 2); addDVDesk(b, M, { width: 0.8, depth: 0.75, teacher: true }); b.pop();
  deskCollision('r131_lehrertisch_2', 17.12, printerZ, 0.75, 0.8);
  b.push(18.55, Y, teacherZ); addDVWorkstation(b, M, { teacher: true }); b.pop();
  for (const x of [17.75, 18.99]) {
    b.box(M.r131PVC, 0.24, 0.58, 0.57, x, Y + 0.39, teacherZ + 0.03);
    for (let i = 0; i < 3; i++) {
      b.box(M.r131DeskEdge, 0.232, 0.003, 0.005, x, Y + 0.18 + i * 0.18, teacherZ + 0.319);
      b.box(M.handle, 0.09, 0.018, 0.022, x, Y + 0.285 + i * 0.18, teacherZ + 0.326);
    }
    block('r131_container_' + x, x, teacherZ + 0.03, 0.24, 0.57, 0.69);
  }
  b.push(17.12, Y + 0.76, printerZ + 0.11, -Math.PI / 2); addDVPrinter(b, M); b.pop();
  b.box(M.r131PVC, 0.21, 0.045, 0.28, 17.13, Y + 0.79, printerZ - 0.25);
  b.box(M.r131DeskEdge, 0.24, 0.027, 0.26, 18.96, Y + 0.775, teacherZ - 0.08);
  addCable(b, { ...M, podcastPlastic: M.r131PVC }, [[18.99, Y + 0.79, teacherZ - 0.12], [18.95, Y + 1.09, teacherZ - 0.25], [19.07, Y + 1.22, teacherZ - 0.25], [19.22, Y + 1.2, teacherZ - 0.17]], 0.014);
  b.box(M.r131Rubber, 0.08, 0.035, 0.1, 19.21, Y + 1.19, teacherZ - 0.15);
  for (let i = 0; i < 3; i++) b.box(i === 1 ? M.red : M.paper, 0.21, 0.009, 0.29, 17.9, Y + 0.79 + i * 0.011, teacherZ + 0.19, 0, i * 0.06);
  b.box(M.r131Rubber, 0.21, 0.018, 0.29, 17.91, Y + 0.825, teacherZ + 0.19, 0, 0.12);
  b.box(M.r131PVC, 0.043, 0.014, 0.11, 17.93, Y + 0.844, teacherZ + 0.18);
  b.rod(M.r131Plywood, [17.8, Y + 0.84, teacherZ + 0.09], [17.93, Y + 0.84, teacherZ + 0.24], 0.004, 6);
  b.box(M.r131Rubber, 0.26, 0.045, 0.3, 18.12, Y + 0.80, teacherZ - 0.07, 0, 0.13);
  b.cylinder(M.glass, 0.025, 0.038, 0.26, 18.23, Y + 0.9, teacherZ + 0.18, 12);
  b.cylinder(M.r131Rubber, 0.02, 0.02, 0.026, 18.23, Y + 1.043, teacherZ + 0.18, 12);
  b.box(M.cardboard, 0.48, 0.31, 0.36, 17.12, Y + 0.155, printerZ + 0.02);
  block('r131_karton', 17.12, printerZ + 0.02, 0.48, 0.36, 0.31);
  b.cylinder(M.r131Rubber, 0.12, 0.09, 0.29, 16.58, Y + 0.145, teacherZ + 0.05, 16);
  block('r131_papierkorb', 16.58, teacherZ + 0.05, 0.24, 0.24, 0.3);
  chairs.push({ x: 18.37, z: teacherZ + 0.40, ry: Math.PI, high: true });
  for (const [i, c] of chairs.entries()) {
    b.push(c.x, Y, c.z, c.ry || 0); addDVChair(b, M, c); b.pop();
    block('r131_stuhl_' + i, c.x, c.z, 0.46, 0.49, c.high ? 1.07 : 0.93, 'moebel', Y, c.ry || 0);
  }

  // ------------------------------------------------------------ Zwei durchgehende Lichtkanäle, Querband, Beamer
  for (const x of [14.0, 18.15]) {
    fixtures.box(M.r131PVC, 0.23, 0.025, S - N - 0.22, x, R.roof - 0.013, (N + S) / 2);
    for (const z of [-2.0, 0.2, 2.4, 4.6]) addCeilingLight(fixtures, { ...M, lightPanel: M.r131Light }, x, R.roof - 0.025, z, { length: 1.65, width: 0.19 });
  }
  fixtures.box(M.r131PVC, 4.38, 0.025, 0.23, 16.075, R.roof - 0.013, 5.15);
  addCeilingLight(fixtures, { ...M, lightPanel: M.r131Light }, 16.075, R.roof - 0.025, 5.15, { length: 2.0, width: 0.19, ry: Math.PI / 2 });
  for (const [x, z] of [[14.4, -0.8], [14.4, 3.9], [17.7, -0.8], [17.7, 3.9]]) {
    const l = new THREE.PointLight(0xfff6e8, 5.5, 0, 2); l.position.set(x, R.roof - 0.3, z); root.add(l); lights.push(l);
  }
  b.rod(M.r131Steel, [16.6, R.roof, 2.9], [16.6, R.roof - 0.32, 2.9], 0.018, 10);
  b.box(M.r131PVC, 0.34, 0.10, 0.27, 16.6, R.roof - 0.37, 2.9);
  b.cylinder(M.r131Rubber, 0.036, 0.036, 0.018, 16.69, R.roof - 0.37, 3.041, 14, Math.PI / 2);
  for (let i = 0; i < 8; i++) b.box(M.r131Rubber, 0.006, 0.045, 0.003, 16.47 + i * 0.018, R.roof - 0.37, 3.037);
  for (const [x, z] of [[15.4, -1.2], [16.6, 4.1]]) fixtures.cylinder(M.r131PVC, 0.055, 0.055, 0.03, x, R.roof - 0.015, z, 16);
  anchor('r131_beamer', 'equipment', 'Deckenbeamer', 16.6, R.roof - 0.37, 2.9);

  lighting.addCircuit('licht_131', { lights, panels: [M.r131Light], on: true,
    regions: [[W - 0.1, N - 0.1, E + R.facade / 2, S + 0.1, 1.44, R.roof + 0.08]] });   // oben Sekretariat (Flur 4)
  for (const z of [0.18, 4.46]) lighting.addDaylight(root, 'licht_131', { position: [E + 0.7, Y + 2.0, z], intensity: 14, distance: 8 });

  // Außenansicht (Vorplatz, Wohnhaus gegenüber) baut seit dem Vorplatz rooms/vorplatz.js.

  root.add(walls.build({ name: 'r131_waende' }), perim.build({ name: 'r131_wanddetails' }), b.build({ name: 'r131_ausstattung' }), fixtures.build({ name: 'r131_leuchten', castShadow: false }));
  // Erst nach dem Zusammenführen skalieren: zuvor wurden die Wandmeshes gar nicht erreicht.
  root.traverse(o => { if (o.isMesh && o.material === M.flur2Wall) metricBoxUV(o.geometry, 0.65); });
  anchor('raum_131', 'room', 'Raum 131 · Datenverarbeitung', (W + E) / 2, Y, (N + S) / 2);
  map.areas.push({ poly: [[W, N], [E, N], [E, S], [W, S]], fill: 'rgba(120,135,160,0.18)' });
  map.labels.push({ text: '131 · DV', x: (W + E) / 2, z: (N + S) / 2 });

  return { id: 'raum_131', name: 'Raum 131', root,
    bounds: { minX: W - 0.2, maxX: E + R.facade, minZ: N - 0.2, maxZ: S + 0.2, maxY: R.roof + 0.2 },
    areaName: (p) => (p.x >= W && p.x <= E && p.z >= N && p.z <= S && p.y > 1.4 && p.y < R.roof + 0.3 ? 'Raum 131 · Datenverarbeitung' : null) };

  // Tischplatte begehbar wie bei den anderen Räumen; Beine einzeln, damit man darunter kriechen kann.
  function deskCollision(id, x, z, w, d) {
    block(id, x, z, w, d, 0.06, 'tisch', Y + 0.7);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) C.addBox(x + sx * (w / 2 - 0.04) - 0.03, z + sz * (d / 2 - 0.04) - 0.03, x + sx * (w / 2 - 0.04) + 0.03, z + sz * (d / 2 - 0.04) + 0.03, Y, Y + 0.72, { tag: 'tisch', id });
    anchor(id, 'table', 'Computertisch', x, Y, z);
  }
}

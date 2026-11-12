// Raum 130: 28 Referenzen, Fotozuordnung und Schätzmaße in verification/RAUM130-ABGLEICH.md.
// Nördlich des Außentreppenflurs; 131 liegt gegenüber, NICHT unmittelbar an dieser Wand.
// Westwand am Eingang und Südwand bis x=17,98 gehören ausschließlich Flur 2.
import * as THREE from 'three';
import { PartBuilder, matrixFrom, metricBoxUV } from '../geometry.js';
import { addWall, addCeilingLight, addSwitchPlate, addRadiator, addFramedPicture,
  addUtilityCabinet, addFireExtinguisher } from '../objects.js';
import { addCable, addStudioTripod } from '../podcast-objects.js';
import { addDVDesk, addDVWorkstation, addDVChair, addDVWindow, addDVSink, addDVPrinter } from '../raum131-objects.js';
import { FLUR2 } from './flur2.js';

export const RAUM130 = {
  west: FLUR2.east + .2, east: 19.4, north: -16.05, south: FLUR2.exit.north - .2,
  y: FLUR2.y, roof: FLUR2.roof, ground: FLUR2.exit.y, facade: .45,
  doorZ: -8.25, eastWindows: [-14.65, -12.5, -10.35, -8.2], northWindows: [13.8, 18.0],
  winW: 1.3, winH: 2.08, sill: .93,
};

export function buildRaum130(ctx) {
  const { scene, collision: C, materials: M, registerObject, interactions, lighting, audio, map } = ctx;
  const R = RAUM130, { west: W, east: E, north: N, south: S, y: Y } = R;
  const root = new THREE.Group(); root.name = 'raum_130'; scene.add(root);
  const walls = new PartBuilder(), b = new PartBuilder(), fixtures = new PartBuilder(), lights = [];
  // Abweichende Beschriftung, schwarze Bildschirme und RB-Mauspads, ohne Materialien von 131 zu ändern.
  const dv = { ...M, r131Inventory: M.r130Inventory, r131Mousepad: M.r130Mousepad };
  const anchor = (id, type, name, x, y, z) => {
    const o = new THREE.Object3D(); o.position.set(x, y, z); root.add(o); registerObject(id, type, name, o);
  };
  const block = (id, x, z, w, d, h, bottom = Y, rot = 0, tag = 'moebel') => {
    C.add({ id, x, z, w, d, rot, bottom, top: bottom + h, tag });
    const wx = Math.abs(Math.cos(rot)) * w + Math.abs(Math.sin(rot)) * d;
    const dz = Math.abs(Math.sin(rot)) * w + Math.abs(Math.cos(rot)) * d;
    map.furniture.push([x - wx / 2, z - dz / 2, x + wx / 2, z + dz / 2]);
  };
  const wall = (a, c, openings = [], thickness = .2) => {
    const r = addWall(walls, M, { start: a, end: c, openings, thickness,
      height: R.roof - R.ground, y0: R.ground, material: M.flur2Wall, baseboard: false });
    r.colliders.forEach(v => C.add({ ...v, tag: 'wand' })); map.walls.push(...r.segments);
  };
  const surface = (material, x0, z0, x1, z1, y, down = false, tile = 1) => {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0); g.rotateX(down ? Math.PI / 2 : -Math.PI / 2);
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      const x = p.getX(i) + (x0 + x1) / 2, z = p.getZ(i) + (z0 + z1) / 2;
      uv.setXY(i, tile ? x / tile : (x - x0) / (x1 - x0), tile ? z / tile : 1 - (z - z0) / (z1 - z0));
    }
    const mesh = new THREE.Mesh(g, material); mesh.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    mesh.receiveShadow = true; root.add(mesh); return mesh;
  };
  const plane = (mat, w, h, x, y, z, ry = 0) => b.add(mat, new THREE.PlaneGeometry(w, h), matrixFrom(x, y, z, 0, ry));
  const picture = (mat, w, h, x, y, z, ry = 0, frame = M.r131Rubber) => {
    b.push(x, y, z, ry); addFramedPicture(b, M, mat, w, h, frame); b.pop();
  };

  // Hülle; kein zweiter Boden im Flur oder im vorhandenen Treppenraum.
  surface(M.r131Carpet, W, N, E, S, Y, false, .9);
  surface(M.flur2Wall, W, N, E, S, Y - .2, true, 2);
  surface(M.r131Ceiling, W, N, E, S, R.roof, true, null);
  surface(M.foyerRoof, W, N, E, S, R.roof + .17).castShadow = true;
  C.addBox(W, N, E, S, Y - .18, Y, { tag: 'boden', surface: 'carpet' });
  C.addBox(W, N, E, S, R.roof, R.roof + .18, { tag: 'decke' });
  // Fußboden innerhalb der Türlaibung, unter der vorhandenen 2-mm-Schwelle.
  C.addBox(FLUR2.east, R.doorZ - .55, W, R.doorZ + .55, Y - .18, Y, { tag: 'boden', surface: 'carpet' });
  wall([W, FLUR2.north], [W, N - R.facade]);
  const wy = Y + R.sill - R.ground;
  wall([W, N], [E + R.facade, N], R.northWindows.map(x => ({ u: x - W - R.winW / 2, w: R.winW, y: wy, h: R.winH })), R.facade);
  wall([E, N], [E, S], R.eastWindows.map(z => ({ u: z - N - R.winW / 2, w: R.winW, y: wy, h: R.winH })), R.facade);
  wall([E + R.facade, S], [FLUR2.exit.east, S]);
  // Unterzug und Pfeiler an der Innenwand (raum1/raum6/IMG_4831).
  b.boxMinMax(M.flur2Wall, W, R.roof - .3, N, W + .38, R.roof, S);
  for (const [z0, z1] of [[N, N + .4], [S - .8, S]]) {
    b.boxMinMax(M.flur2Wall, W, Y, z0, W + .34, R.roof - .3, z1);
    C.addBox(W, z0, W + .34, z1, Y, R.roof, { tag: 'wand' });
  }
  const skirt = (x0, z0, x1, z1) => b.boxMinMax(M.r131Carpet, x0, Y, z0, x1, Y + .07, z1);
  skirt(W + .34, N, E, N + .012); skirt(W + .34, S - .012, E, S); skirt(E - .012, N, E, S);
  skirt(W, N + .4, W + .012, R.doorZ - .56); skirt(W, R.doorZ + .56, W + .012, S - .8);

  // Vier Fenster zur Straßenfront und zwei zur Stirnseite; Jalousien fast ganz hochgezogen.
  for (const [side, axes] of [['east', R.eastWindows], ['north', R.northWindows]]) for (const [i, a] of axes.entries()) {
    const x = side === 'east' ? E : a, z = side === 'east' ? a : N, ry = side === 'east' ? -Math.PI / 2 : 0;
    b.push(x, Y + R.sill + R.winH / 2, z, ry);
    addDVWindow(b, dv, { width: R.winW, height: R.winH, blindDrop: side === 'north' ? .48 : .16 + i % 2 * .06 }); b.pop();
    // Geschlossene Scheiben sperren auch oberhalb der Brüstung, etwa beim Springen.
    C.add({ id: 'r130_fenster_' + side + i, x: x + (side === 'east' ? .24 : 0),
      z: z - (side === 'north' ? .24 : 0), w: R.winW, d: .085, rot: ry,
      bottom: Y + R.sill, top: Y + R.sill + R.winH, tag: 'fenster' });
    b.push(x, Y, z, ry);
    b.box(M.foyerWood, R.winW, .035, .23, 0, R.sill - .0145, -.115);
    addRadiator(b, M, { width: 1.04, height: .55, y0: .13, depth: .12 }); b.pop();
    block('r130_heizung_' + side + i, x + (side === 'east' ? -.12 : 0), z + (side === 'north' ? .12 : 0), 1.08, .20, .70, Y, ry);
  }
  b.boxMinMax(M.foyerWood, E - .28, Y + R.sill - .032, N, E, Y + R.sill + .003, S);
  b.boxMinMax(M.foyerWood, W + .34, Y + R.sill - .032, N, E - .28, Y + R.sill + .003, N + .28);
  b.boxMinMax(M.foyerWood, E - .055, Y + .77, N, E, Y + .9, S);
  b.boxMinMax(M.foyerWood, W + .34, Y + .77, N, E - .055, Y + .9, N + .055);
  b.boxMinMax(M.duct, E - .085, Y + .76, N + .38, E - .056, Y + .9, S - .2);
  for (let z = N + .65; z < S - .25; z += 1.05) for (const dz of [0, .09]) addSwitchPlate(b, M, E - .085, Y + .83, z + dz, -Math.PI / 2, true);
  for (const z of [-13.58, -9.28]) b.box(M.r131PVC, .16, .28, .22, E - .08, Y + 2.86, z);

  // Flurwand mit Korktafel, SQL-Anleitungen, Cloud-Plakat und Tastaturposter.
  b.boxMinMax(M.duct, W, Y + .95, N + .4, W + .06, Y + 1.07, R.doorZ - .63);
  for (let z = N + .8; z < R.doorZ - .7; z += .82) for (const dz of [0, .09]) addSwitchPlate(b, M, W + .06, Y + 1.01, z + dz, Math.PI / 2, true);
  picture(M.r130Cork, 2.55, 1.22, W + .014, Y + 1.73, -11.65, Math.PI / 2);
  // Lokale x-Richtung der Westwand zeigt nach Norden; linke Fotohälfte ist türseitig.
  plane(M.r131Notes, .46, .91, W + .057, Y + 1.78, -10.82, Math.PI / 2);
  plane(M.r131NotesRight, .46, .66, W + .057, Y + 1.9, -11.34, Math.PI / 2);
  plane(M.r130Cloud, .83, .55, W + .060, Y + 1.36, -11.75, Math.PI / 2);
  plane(M.r130Localhost, .24, .12, W + .064, Y + 1.70, -10.54, Math.PI / 2);
  plane(M.r130Delete, .23, .12, W + .064, Y + 2.08, -11.68, Math.PI / 2);
  picture(M.r131Keyboard, 1.76, .88, W + .014, Y + 1.71, -14.2, Math.PI / 2, M.r131PVC);
  plane(M.r130Sequence, 2.38, 2.05, 15.91, Y + 2.02, N + .014);
  // Netzwerkschrank, kein Klimagerät: dunkle Front, Einlegeböden und Kabel zum Kanal.
  b.push(W + .02, Y + 2.78, -7.9, Math.PI / 2);
  b.box(M.r131PVC, .68, .49, .39, 0, 0, .195);
  b.box(M.r131MonitorBack, .55, .36, .006, -.025, 0, .394);
  for (const y of [-.115, 0, .115]) b.box(M.r131DeskEdge, .46, .025, .012, -.02, y, .402);
  b.box(M.glass, .55, .36, .004, -.025, 0, .411); b.pop();
  // Leitung vollständig auf der Wand, außerhalb von Türöffnung und Fluchtplan.
  b.boxMinMax(M.duct, W + .06, Y + 1.08, -9.47, W + .08, Y + 2.69, -9.43);
  addCable(b, dv, [[W + .09, Y + 2.7, -8.17], [W + .22, Y + 2.5, -8.32], [W + .09, Y + 2.49, -9.45]], .008);
  picture(M.flur2Plan, .36, .5, W + .014, Y + 1.55, -9.12, Math.PI / 2, M.r131PVC);

  const sw = new PartBuilder();
  for (const y of [1.25, 1.16, 1.07]) addSwitchPlate(sw, M, 0, y, 0);
  addSwitchPlate(sw, M, 0, .98, 0, 0, true);
  const switchMesh = sw.build({ name: 'lichtschalter_130' });
  switchMesh.position.set(W + .001, Y, -7.55); switchMesh.rotation.y = Math.PI / 2; root.add(switchMesh);
  registerObject('lichtschalter_130', 'switch', 'Licht Raum 130', switchMesh);
  interactions.register(switchMesh, { id: 'lichtschalter_130', type: 'switch',
    label: () => `Licht Raum 130 ${lighting.isOn('licht_130') ? 'ausschalten' : 'einschalten'}`,
    onInteract: () => { lighting.toggle('licht_130'); audio.click(); } });
  plane(M.r130Number, .28, .14, W + .015, Y + 2.38, -7.55, Math.PI / 2);

  // Tafelwand und Waschecke. Freistehende Stellwand bleibt ein Möbelstück mit begehbaren Seiten.
  picture(M.r130Whiteboard, 2.36, 1.16, 17.45, Y + 1.36, S - .014, Math.PI, M.aluminium);
  b.box(M.r131PVC, 1.15, 1.65, .035, 17.45, Y + 1.25, S - .02);
  b.box(M.aluminium, 2.42, .03, .085, 17.45, Y + .765, S - .055);
  for (const x of [16.24, 18.66]) b.box(M.r131Rubber, .025, .18, .04, x, Y + 1.35, S - .04);
  b.box(M.paper, .13, .22, .02, 18.46, Y + 1.87, S - .045, .12, 0, -.2);
  plane(M.r131Pockets, .62, .78, 15.86, Y + 1.99, S - .017, Math.PI);
  b.push(14.84, Y, S - .005, Math.PI); addUtilityCabinet(b, dv, { width: 1.10, height: 2.10, depth: .45, material: M.r131PVC }); b.pop();
  block('r130_schrank', 14.84, S - .23, 1.10, .46, 2.1);
  // Sichtschutz mit hellem Filz und einer abgenutzten Stelle (IMG_4816/raum6).
  const screen = { x: 14.45, z: -7.83, ry: .10 };
  b.push(screen.x, Y, screen.z, screen.ry);
  b.box(M.r130Felt, 1.13, 1.73, .038, 0, 1.20, 0);
  for (const x of [-.59, .59]) {
    b.box(M.r131PVC, .045, 2.04, .045, x, 1.04, 0);
    b.box(M.r131PVC, .07, .035, .59, x, .035, 0);
  }
  for (const y of [.31, 2.09]) b.box(M.r131PVC, 1.22, .045, .045, 0, y, 0);
  for (const [x,y,r] of [[-.30,1.75,.04],[-.25,1.71,.026],[-.34,1.70,.028]])
    b.add(M.r130Wear, new THREE.CircleGeometry(r, 7), matrixFrom(x, y, -.020, 0, Math.PI));
  b.pop();
  block('r130_stellwand', screen.x, screen.z, 1.22, .065, 2.12, Y, screen.ry);
  for (const x of [-.59, .59]) block('r130_stellwand_fuss', screen.x + x * Math.cos(screen.ry), screen.z - x * Math.sin(screen.ry), .07, .59, .07, Y, screen.ry);
  anchor('r130_stellwand', 'furniture', 'Freistehende Stellwand', screen.x, Y, screen.z);
  b.push(15.6, Y, S - .28);
  b.box(M.blueSteel, .42, .02, .35, 0, .01, 0);
  for (const x of [-.203, .203]) b.box(M.blueSteel, .014, .27, .35, x, .145, 0);
  for (const z of [-.168, .168]) b.box(M.blueSteel, .42, .27, .014, 0, .145, z);
  b.box(M.paper, .29, .02, .21, 0, .04, 0); plane(M.r131Paper, .23, .1, 0, .14, -.18, Math.PI); b.pop();
  block('r130_papierkiste', 15.6, S - .28, .44, .37, .29);
  plane(M.r131Tiles, .78, .92, W + .345, Y + .77, S - .4, Math.PI / 2);
  b.push(W + .35, Y, S - .4, Math.PI / 2); addDVSink(b, dv); b.pop();
  block('r130_waschbecken', W + .58, S - .4, .40, .52, .91);
  b.box(M.red, .27, .31, .095, 13.74, Y + 1.57, S - .06);
  plane(M.r131Extinguisher, .23, .27, 13.74, Y + 1.57, S - .11, Math.PI);
  b.box(M.r131PVC, .30, .38, .15, 13.34, Y + 1.58, S - .085);
  b.box(M.paper, .15, .07, .012, 13.34, Y + 1.37, S - .13);
  b.push(13.82, Y + .45, S - .1); addFireExtinguisher(b, M, 0, 0, Math.PI); b.pop();
  plane(M.fireSign, .15, .18, 13.82, Y + 2.15, S - .014, Math.PI);
  b.cylinder(M.r131Rubber, .12, .09, .3, 13.37, Y + .15, S - .2, 16);
  block('r130_papierkorb', 13.37, S - .2, .24, .24, .3);

  // 16 Schülerplätze in zwei Blöcken à vier Zweierreihen (raum8/raum11/IMG_4831).
  const chairs = [];
  for (const [side, x] of [13.76, 17.95].entries()) for (const [row, z] of [-9.5, -11.2, -12.9, -14.6].entries()) {
    b.push(x, Y, z); addDVDesk(b, dv, { width: 2.4, pairedTowers: true, channelInset: .006 });
    b.box(M.r131DeskEdge, .002, .0015, .61, 0, .761, -.07); b.pop();
    deskCollision(`r130_tisch_${side}_${row}`, x, z, 2.4, .75);
    for (const dx of [-.6, .6]) chairs.push({ x: x + dx, z: z - .35, ry: (row % 2 ? -.03 : .025) });
    for (const dx of [-.155, .155]) C.add({ x: x + dx, z: z + .025, w: .28, d: .49, bottom: Y + .12, top: Y + .57, tag: 'moebel' });
  }
  b.push(14.72, Y + .77, -11.25); addStudioTripod(b, dv, { height: .86, spread: .13, camera: true }); b.pop();
  anchor('r130_stativ', 'equipment', 'Tischkamera', 14.72, Y + .77, -11.25);

  // Lehrerpult mit zwei Schubladencontainern und separatem Druckerwagen, kein langer Sperrtisch.
  const teacherX = 18.28, teacherZ = -8.05, cartX = 17.06;
  b.push(teacherX, Y, teacherZ, Math.PI); addDVDesk(b, dv, { width: 1.65, teacher: true, channelInset: .006 }); b.pop();
  deskCollision('r130_lehrertisch', teacherX, teacherZ, 1.65, .75);
  b.push(18.56, Y, teacherZ); addDVWorkstation(b, dv); b.pop();
  for (const x of [17.65, 18.91]) {
    b.box(M.r131PVC, .3, .57, .57, x, Y + .39, teacherZ + .04);
    for (let i = 0; i < 3; i++) {
      b.box(M.r131DeskEdge, .29, .003, .005, x, Y + .19 + i * .18, teacherZ + .328);
      b.box(M.handle, .11, .021, .022, x, Y + .285 + i * .18, teacherZ + .339);
    }
    block('r130_container_' + x, x, teacherZ + .04, .3, .57, .68);
  }
  b.push(cartX, Y, teacherZ);
  b.box(M.r131Desk, .77, .035, .76, 0, .745, 0);
  b.box(M.r131Desk, .66, .025, .64, 0, .22, 0);
  for (const x of [-.34, .34]) for (const z of [-.32, .32]) {
    b.cylinder(M.r131Steel, .023, .023, .66, x, .40, z, 10);
    b.cylinder(M.r131Rubber, .035, .035, .04, x, .037, z, 10, 0, 0, Math.PI / 2);
  }
  for (const z of [-.32, .32]) b.box(M.r131Steel, .68, .055, .035, 0, .69, z);
  b.box(M.paper, .3, .05, .23, -.12, .257, .05);
  b.box(M.r131Rubber, .18, .025, .13, .14, .248, -.08);
  b.pushMatrix(matrixFrom(0, .764, 0, 0, 0, 0, 1.15, 1.25, 1.15)); addDVPrinter(b, dv); b.pop(); b.pop();
  block('r130_druckerwagen', cartX, teacherZ, .77, .76, .78);
  anchor('r130_drucker', 'equipment', 'Druckerwagen', cartX, Y, teacherZ);
  // Dokumentenkamera und sichtbare Kleingeräte aus IMG_4821/4822.
  b.box(M.r131PVC, .19, .05, .24, 17.88, Y + .79, teacherZ - .04);
  addCable(b, { ...dv, podcastPlastic: M.r131PVC }, [[17.9, Y + .81, teacherZ - .1], [17.9, Y + 1.14, teacherZ - .17], [17.85, Y + 1.2, teacherZ - .16], [17.66, Y + 1.2, teacherZ -.1]], .014);
  b.box(M.r131PVC, .2, .05, .06, 17.72, Y + 1.2, teacherZ - .1);
  b.cylinder(M.r131Rubber, .023, .023, .04, 17.63, Y + 1.17, teacherZ - .1, 12);
  b.box(M.r131PVC, .043, .014, .1, 17.91, Y + .778, teacherZ + .17, 0, .15);
  b.box(M.r131Rubber, .19, .03, .095, 18.98, Y + .781, teacherZ - .16);
  b.cylinder(M.r130Spray, .026, .033, .22, 17.28, Y + .875, teacherZ + .2, 12);
  b.box(M.r131PVC, .08, .025, .025, 17.28, Y + 1.0, teacherZ + .2);
  chairs.push({ x: 18.45, z: teacherZ + .43, ry: Math.PI, high: true });
  chairs.push({ x: 17.05, z: -7.60, ry: Math.PI });
  for (const [i, c] of chairs.entries()) {
    b.push(c.x, Y, c.z, c.ry); addDVChair(b, dv, c); b.pop();
    block('r130_stuhl_' + i, c.x, c.z, .46, .49, c.high ? 1.07 : .93, Y, c.ry);
  }

  // Zwei Rasterlichtbänder, Querkanal, Beamer und Rauchmelder nach Deckenaufnahmen.
  for (const x of [14.0, 18.15]) {
    fixtures.box(M.r131PVC, .23, .025, S - N - .22, x, R.roof - .013, (N + S) / 2);
    for (const z of [-14.7, -12.5, -10.3, -8.1]) addCeilingLight(fixtures, { ...M, lightPanel: M.r130Light }, x, R.roof - .025, z, { length: 1.65, width: .19, panelInset: .004, louverDrop: .004 });
  }
  fixtures.box(M.r131PVC, 4.38, .025, .23, 16.075, R.roof - .013, S - .8);
  addCeilingLight(fixtures, { ...M, lightPanel: M.r130Light }, 16.075, R.roof - .025, S - .8, { length: 2.0, width: .19, ry: Math.PI / 2, panelInset: .004, louverDrop: .004 });
  for (const x of [14.4, 17.7]) for (const z of [-13.75, -8.85]) {
    const l = new THREE.PointLight(0xfff6e8, 5.5, 0, 2); l.position.set(x, R.roof - .3, z); root.add(l); lights.push(l);
  }
  b.rod(M.r131Steel, [16.6, R.roof, -9.7], [16.6, R.roof - .32, -9.7], .018, 10);
  b.box(M.r131PVC, .34, .10, .27, 16.6, R.roof - .37, -9.7);
  b.cylinder(M.r131Rubber, .036, .036, .018, 16.69, R.roof - .37, -9.559, 14, Math.PI / 2);
  for (let i = 0; i < 8; i++) b.box(M.r131Rubber, .006, .045, .003, 16.47 + i * .018, R.roof - .37, -9.563);
  for (const [x, z] of [[15.4, -14.0], [16.6, -8.5]]) fixtures.cylinder(M.r131PVC, .055, .055, .03, x, R.roof - .015, z, 16);
  anchor('r130_beamer', 'equipment', 'Deckenbeamer', 16.6, R.roof - .37, -9.7);
  lighting.addCircuit('licht_130', { lights, panels: [M.r130Light], on: true,
    regions: [[W - .1, N - R.facade / 2, E + R.facade / 2, S + .1, 1.44, R.roof + .08]] });   // oben Sekretariat (Flur 4)
  for (const z of [-13.7, -8.9]) lighting.addDaylight(root, 'licht_130', { position: [E + .7, Y + 2, z], intensity: 14, distance: 8 });
  lighting.addDaylight(root, 'licht_130', { position: [15.9, Y + 2, N - .7], intensity: 10, distance: 7 });

  // Ostseite (Vorplatz, Bucksgässle) baut rooms/vorplatz.js, die Nordseite (Schulgasse) rooms/schulgasse.js;
  // die frühere Straßenkulisse nördlich der Fassade ist dadurch ersetzt.

  root.add(walls.build({ name: 'r130_waende' }), b.build({ name: 'r130_ausstattung' }), fixtures.build({ name: 'r130_leuchten', castShadow: false }));
  root.traverse(o => { if (o.isMesh && o.material === M.flur2Wall) metricBoxUV(o.geometry, .65); });
  anchor('raum_130', 'room', 'Raum 130 · Datenverarbeitung', (W + E) / 2, Y, (N + S) / 2);
  map.areas.push({ poly: [[W, N], [E, N], [E, S], [W, S]], fill: 'rgba(120,135,160,0.18)' });
  map.labels.push({ text: '130 · DV', x: (W + E) / 2, z: (N + S) / 2 });
  return { id: 'raum_130', name: 'Raum 130', root,
    bounds: { minX: W - .2, maxX: E + R.facade, minZ: N - R.facade, maxZ: S + .2, maxY: R.roof + .2 },
    areaName: p => p.x >= W && p.x <= E && p.z >= N && p.z <= S && p.y > 1.4 && p.y < R.roof + .3 ? 'Raum 130 · Datenverarbeitung' : null };

  function deskCollision(id, x, z, w, d) {
    block(id, x, z, w, d, .06, Y + .70, 0, 'tisch');
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) C.add({ x: x + sx * (w / 2 - .055), z: z + sz * (d / 2 - .045), w: .05, d: .05, bottom: Y, top: Y + .72, id, tag: 'tisch' });
    anchor(id, 'table', 'Computertisch', x, Y, z);
  }
}

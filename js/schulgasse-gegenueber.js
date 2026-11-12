// Schulgasse, Gegenseite (Spiel-Norden): von West nach Ost Haus mit Betonsockel und Stütze, zwei Lebensbäume,
// gelbes Haus 14 mit Anbau, Weinkellerei Denkinger (gegenüber dem Eingang), weißes Haus mit grauem Band und
// Betonmäuerchen, Baustelle mit Absperrschranken, dahinter ein Wohnhaus, Makerei an der Kreuzung.
// Fotos 1–5, eingang4, Panorama-Draufsicht; alle Maße geschätzt (verification/SCHULGASSE-ABGLEICH.md).
// Nicht gebaut: Autos, Bagger, Personen, Satellitenschüsseln (vorübergehend bzw. nur angedeutet sichtbar).
import * as THREE from 'three';
import { matrixFrom } from './geometry.js';
import { SG, sgY } from './schulgasse-layout.js';

export function buildSchulgasseGegenueber({ houses: H, b, detail, C, M, plants, block, anchor, sign, map }) {
  const PI = Math.PI, base = -1.1;
  // Zweiseitiges Dreieck (Giebelfeld)
  const tri = (mat, p0, p1, p2) => {
    const g = new THREE.BufferGeometry(), pts = [...p0, ...p1, ...p2, ...p0, ...p2, ...p1];
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([p0[0] + p0[2], p0[1], p1[0] + p1[2], p1[1], p2[0] + p2[2], p2[1], p0[0] + p0[2], p0[1], p2[0] + p2[2], p2[1], p1[0] + p1[2], p1[1]].map(v => v / .9), 2));
    g.computeVertexNormals(); H.add(mat, g);
  };
  // Haus: Front z = zf zur Gasse (+z), Tiefe d. roof 'eaves' = Traufe zur Gasse (First in x), 'gable' = Giebel zur Gasse.
  function house({ id, name, x0, x1, zf, d = 9, eaves, ridge, roof = 'eaves', wall = M.vpHouse, roofMat = M.vpRoofTile, ov = .35, from = base }) {
    const zb = zf - d, xm = (x0 + x1) / 2, zm = (zf + zb) / 2;
    H.boxMinMax(wall, x0, from, zb, x1, eaves, zf);
    if (roof === 'eaves') {
      const run = zf + ov - zm, a = Math.atan2(ridge - eaves, run), len = Math.hypot(run, ridge - eaves) + .05;
      H.box(roofMat, x1 - x0 + 2 * ov, .14, len, xm, (eaves + ridge) / 2, (zf + ov + zm) / 2, a);
      H.box(roofMat, x1 - x0 + 2 * ov, .14, len, xm, (eaves + ridge) / 2, (zb - ov + zm) / 2, -a);
      for (const x of [x0, x1]) tri(wall, [x, eaves, zf], [x, eaves, zb], [x, ridge - .05, zm]);
      b.rod(M.hofCoping, [x0 - ov, ridge + .04, zm], [x1 + ov, ridge + .04, zm], .07, 8);
      b.rod(M.vpFlashing, [x0 - ov, eaves - .02, zf + ov - .05], [x1 + ov, eaves - .02, zf + ov - .05], .06, 8);
    } else {
      const run = xm - x0 + ov, a = Math.atan2(ridge - eaves, run), len = Math.hypot(run, ridge - eaves) + .05;
      H.box(roofMat, len, .14, d + 2 * ov, (x0 - ov + xm) / 2, (eaves + ridge) / 2, zm, 0, 0, a);
      H.box(roofMat, len, .14, d + 2 * ov, (x1 + ov + xm) / 2, (eaves + ridge) / 2, zm, 0, 0, -a);
      for (const z of [zf, zb]) tri(wall, [x0, eaves, z], [x1, eaves, z], [xm, ridge - .05, z]);
      b.rod(M.hofCoping, [xm, ridge + .04, zf + ov], [xm, ridge + .04, zb - ov], .07, 8);
    }
    C.addBox(x0, zb, x1, zf, base, eaves, { tag: 'wand', id });
    map.walls.push([x0, zf, x1, zf]);
    anchor(id, 'exterior', name, xm, sgY(xm), zf);
  }
  // Fenster auf einer Hauswand (blickt nach +z oder per ry), Unterkante y
  function win(x, y, z, w, h, { ry = 0, frame = M.vpFrame, glass = M.vpDarkGlass, cols = 2, sill = true, shutters = null } = {}) {
    detail.push(x, y, z, ry);
    detail.box(glass, w - .06, h - .06, .01, 0, h / 2, .006);
    for (const yy of [.03, h - .03]) detail.box(frame, w, .06, .05, 0, yy, .025);
    for (let i = 0; i <= cols; i++) detail.box(frame, .06, h, .05, -w / 2 + .03 + i * (w - .06) / cols, h / 2, .025);
    if (sill) detail.box(M.vpFrame, w + .1, .04, .12, 0, -.02, .06);
    if (shutters) for (const s of [-1, 1]) detail.box(shutters, w / 2, h, .03, s * (w * .75 + .02), h / 2, .02);
    detail.pop();
  }

  // ------------------------------------------------------------------ Haus mit Betonsockel (Westende)
  // „sicht auf eingangaußenbereich“, Foto 8: weißes Obergeschoss auf einer Eckstütze, Erdgeschoss Sichtbeton zurückgesetzt.
  {
    const x0 = -35.5, x1 = -28.0, zf = -24.6, zb = -32.6, top = 2.6;
    H.boxMinMax(M.vpHouse, x0, top, zb, x1, 8.2, zf);
    H.boxMinMax(M.sgConcreteWall, x0, base, zb, x1 - .6, top, zf - 1.4);
    b.boxMinMax(M.vpConcrete, x1 - .41, base, zf - .41, x1 - .01, top - .01, zf - .01);
    H.boxMinMax(M.vpHouse, x0, top - .25, zf - 1.4, x1, top, zf);   // Untersicht der Auskragung
    const run = 4.4, a = Math.atan2(2.4, run);
    H.box(M.vpRoofTile, x1 - x0 + .7, .14, Math.hypot(run, 2.4), (x0 + x1) / 2, 9.4, zf + .35 - run / 2, a);
    H.box(M.vpRoofTile, x1 - x0 + .7, .14, Math.hypot(run, 2.4), (x0 + x1) / 2, 9.4, zb - .35 + run / 2, -a);
    for (const x of [x0, x1]) tri(M.vpHouse, [x, 8.2, zf], [x, 8.2, zb], [x, 10.55, (zf + zb) / 2]);
    for (const x of [-29.4, -31.6, -33.8]) { win(x, 3.5, zf, 1.1, 1.3); win(x, 5.95, zf, 1.1, 1.3); }
    win(x1, 3.5, -27.0, 1.0, 1.3, { ry: PI / 2 });
    b.rod(M.vpFlashing, [x0 - .35, 8.18, zf + .3], [x1 + .35, 8.18, zf + .3], .06, 8);
    C.addBox(x0, zb, x1 - .6, zf - 1.4, base, 8.2, { tag: 'wand', id: 'schulgasse_haus_betonsockel' });
    block('schulgasse_haus_betonsockel_stuetze', x1 - .4, zf - .4, x1, zf, base, top);
    map.walls.push([x0, zf, x1, zf]);
    anchor('schulgasse_haus_betonsockel', 'exterior', 'Haus mit Betonsockel', (x0 + x1) / 2, sgY(-30), zf);
  }
  // Zwei Lebensbäume zwischen dem Haus und dem gelben Haus (Foto 8, „sicht auf eingangaußenbereich“)
  for (const [x, z, h] of [[-25.6, -25.6, 6.2], [-26.9, -26.3, 5.0]]) {
    const g = sgY(x);
    b.rod(M.hofBark, [x, g, z], [x, g + h * .85, z], .08, 6);
    for (let i = 0; i < 6; i++) plants.shrub(x, z, { y: g + .3 + i * h * .14, h: h * .2, w: 1.7 - i * .22, color: 0x46603a, n: 70 });
    C.addBox(x - .3, z - .3, x + .3, z + .3, g, g + h * .5, { tag: 'baum' });
  }
  // Parkverbot am Gehweg vor dem gelben Haus (Foto 8)
  { const x = -25.2, z = -24.25, g = sgY(x); b.rod(M.vpGalv, [x, g, z], [x, g + 2.5, z], .03, 8); sign(M.vpSignNoParking, .45, .45, x, g + 2.3, z + .035, 0, b);
    block('schulgasse_schildmast', x - .05, z - .05, x + .05, z + .05, g, g + 2.5, 'mast'); }

  // ------------------------------------------------------------------ Gelbes Haus 14 mit Anbau (Foto 5)
  house({ id: 'schulgasse_haus_14', name: 'Gelbes Haus Nr. 14', x0: -24.85, x1: -18.9, zf: -24.7, eaves: 5.4, ridge: 9.0, wall: M.sgYellow });
  house({ id: 'schulgasse_haus_14_anbau', name: 'Anbau Haus 14', x0: -18.88, x1: -16.42, zf: -24.7, eaves: 3.4, ridge: 5.3, wall: M.sgYellow });
  {
    const zf = -24.7, g = sgY(-21);
    H.boxMinMax(M.sgGreyBand, -24.87, base, zf, -16.4, g + .45, zf + .03);   // grauer Sockel
    for (const x of [-24.1, -23.0]) win(x, g + 1.0, zf, .95, 1.15, { frame: M.sgWhite });
    win(-21.6, g + 1.0, zf, 1.05, 1.15, { frame: M.sgWhite });
    for (const x of [-24.1, -23.0]) win(x, g + 3.4, zf, .85, 1.05, { frame: M.sgWhite });
    win(-20.4, g + 3.3, zf, 1.25, 1.2, { frame: M.sgWhite });
    // Hauseingang in einer Nische: Leibung, Tür, Stufe, Hausnummer
    H.boxMinMax(M.sgYellow, -20.4, base, zf, -20.32, g + 2.35, zf + .45);
    H.boxMinMax(M.sgYellow, -19.42, base, zf, -19.34, g + 2.35, zf + .45);
    H.boxMinMax(M.sgYellow, -20.4, g + 2.3, zf, -19.34, g + 2.38, zf + .45);
    detail.boxMinMax(M.vpDoorFrame, -20.3, g + .15, zf + .005, -19.44, g + 2.25, zf + .02);
    b.boxMinMax(M.vpStep, -20.45, g, zf, -19.3, g + .15, zf + .5);
    sign(M.sgHouse14, .16, .16, -19.2, g + 1.9, zf + .006, 0);
    // Anbau: graues Vordachband, Tür
    H.boxMinMax(M.sgGreyBand, -18.9, g + 2.35, zf, -16.42, g + 2.5, zf + .25);
    detail.boxMinMax(M.vpDoorFrame, -17.95, g + .05, zf + .005, -17.15, g + 2.05, zf + .02);
    H.boxMinMax(M.vpRoofTile, -22.7, 7.6, -29.4, -22.2, 9.9, -28.9);   // Kamin
  }

  // ------------------------------------------------------------------ Weinkellerei Denkinger (gegenüber dem Eingang)
  // Giebel zur Gasse, rauer Putz, großes Holztor mit zwei Rauten, Schild, Giebelfenster (Fotos 4, 5, Panorama).
  house({ id: 'schulgasse_weinkellerei', name: 'Weinkellerei Denkinger', x0: -16.35, x1: -11.85, zf: -25.45, d: 10, eaves: 4.3, ridge: 8.1, roof: 'gable', wall: M.sgRough, ov: .3 });
  {
    const zf = -25.45, g = sgY(-14), x0 = -15.35, x1 = -12.85, top = g + 2.85;
    H.boxMinMax(M.sgDoorWood, x0, g, zf - .1, x1, top, zf + .002);
    for (const [a, c, y0, y1] of [[x0 - .12, x0, g, top + .1], [x1, x1 + .12, g, top + .1], [x0 - .12, x1 + .12, top, top + .12]]) H.boxMinMax(M.sgDoorWood, a, y0, zf, c, y1, zf + .06);
    detail.boxMinMax(M.vpBin, (x0 + x1) / 2 - .02, g, zf + .002, (x0 + x1) / 2 + .02, top, zf + .02);
    for (const x of [x0 + .62, x1 - .62]) detail.add(M.sgDoorWood, new THREE.BoxGeometry(.42, .42, .04), matrixFrom(x, g + 1.95, zf + .03, 0, 0, PI / 4));
    for (const y of [g + .9, g + 1.75]) detail.boxMinMax(M.vpBin, x0 + .05, y, zf + .002, x1 - .05, y + .07, zf + .025);
    detail.boxMinMax(M.vpLampHead, (x0 + x1) / 2 + .05, g + 1.5, zf + .02, (x0 + x1) / 2 + .55, g + 1.62, zf + .05);   // Riegel
    sign(M.sgSignWein, 3.3, .52, -14.1, g + 3.55, zf + .006, 0);
    win(-14.1, g + 5.45, zf, .55, .5, { frame: M.sgDoorWood, cols: 1, sill: false });
    b.boxMinMax(M.vpStep, x0 - .2, g - .1, zf, x1 + .2, g + .03, zf + .45);
    for (const x of [-15.9, -15.6, -12.4, -12.1]) plants.shrub(x, zf + .55, { y: g, h: .22, w: .35, color: 0x6b8a45, n: 10 });
    b.rod(M.vpFlashing, [-11.95, g, zf + .12], [-11.95, 4.25, zf + .12], .045, 8);
  }
  // Holztor und blaue Tonne zwischen Kellerei und weißem Haus (Foto 5)
  { const g = sgY(-11.6), zf = -24.95;
    for (let x = -11.82; x < -11.36; x += .095) detail.boxMinMax(M.sgDoorWood, x, g, zf - .02, x + .08, g + 1.55, zf);
    b.cylinder(M.sgBarrel, .27, .27, .85, -11.6, g + .425, zf + .35, 16); }

  // ------------------------------------------------------------------ Weißes Haus mit grauem Band (Fotos 4, 5)
  house({ id: 'schulgasse_haus_weiss', name: 'Weißes Haus mit grauem Band', x0: -11.35, x1: -4.35, zf: -24.9, eaves: 5.7, ridge: 10.2, roof: 'gable', wall: M.sgWhite });
  {
    const zf = -24.9, g = sgY(-8);
    H.boxMinMax(M.sgGreyBand, -6.75, base, zf, -5.7, 5.7, zf + .04);
    H.boxMinMax(M.sgGreyBand, -11.37, base, zf, -4.33, g + .55, zf + .03);
    for (const x of [-10.2, -8.6]) { win(x, g + 1.2, zf, .9, 1.2, { frame: M.sgWhite, cols: 1 }); win(x, g + 3.6, zf, .9, 1.2, { frame: M.sgWhite, cols: 1 }); }
    win(-6.22, g + 1.2, zf + .04, .75, 1.2, { frame: M.sgWhite, cols: 1 }); win(-6.22, g + 3.6, zf + .04, .75, 1.2, { frame: M.sgWhite, cols: 1 });
    win(-7.85, g + 6.3, zf, .7, .9, { frame: M.sgWhite, cols: 1 });
    detail.boxMinMax(M.vpDoorFrame, -5.35, g + .35, zf + .005, -4.5, g + 2.4, zf + .02);
    for (const [y, dz] of [[.17, .9], [.34, .45]]) b.boxMinMax(M.vpStep, -5.55, g, zf, -4.36, g + y, zf + dz);
    // Betonmäuerchen an der Gasse
    b.boxMinMax(M.vpConcrete, -10.95, g - .1, SG.gutter - .3, -5.7, g + .52, SG.gutter);
    b.boxMinMax(M.vpConcrete, -10.95, g - .1, zf + .05, -10.75, g + .52, SG.gutter - .3);
    C.addBox(-10.95, SG.gutter - .3, -5.7, SG.gutter, g - .1, g + .52, { tag: 'mauer', id: 'schulgasse_mauerchen' });
    for (let x = -10.3; x < -6.2; x += .7) plants.shrub(x, -24.4, { y: g, h: .5, w: .6, color: 0x5e7a42, n: 18 });
  }

  // ------------------------------------------------------------------ Baustelle mit Absperrschranken, Haus dahinter
  {
    const z = -24.15, g = sgY(0);
    for (const [x0, x1] of [[-4.1, -2.0], [-1.9, .2], [.3, 2.4], [2.5, 3.4]]) {
      for (const y of [.25, .95]) detail.boxMinMax(M.sgBarrier, x0, g + y, z - .02, x1, g + y + .14, z + .02);
      for (const x of [x0 + .1, x1 - .1]) { b.boxMinMax(M.vpBollard, x - .02, g, z - .02, x + .02, g + 1.12, z + .02); b.boxMinMax(M.vpBollard, x - .03, g, z - .35, x + .03, g + .05, z + .35); }
    }
    C.addBox(-4.1, z - .1, 3.4, z + .1, g, g + 1.2, { tag: 'zaun', id: 'schulgasse_baustelle_absperrung' });
    b.add(M.sgDirt, new THREE.ConeGeometry(2.2, 1.3, 10), matrixFrom(-.6, g + .6, -27.8));
    anchor('schulgasse_baustelle', 'exterior', 'Baustelle (abgesperrt)', 0, g, -27);
  }
  house({ id: 'schulgasse_haus_hinter_baustelle', name: 'Wohnhaus hinter der Baustelle', x0: -3.6, x1: 3.2, zf: -31.5, d: 8, eaves: 6.0, ridge: 9.8, wall: M.vpHouse });
  for (const x of [-2.3, 0, 2.0]) { win(x, 1.2, -31.5, 1.0, 1.25, { frame: M.sgWhite }); win(x, 3.9, -31.5, 1.0, 1.25, { frame: M.sgWhite }); }

  // ------------------------------------------------------------------ Makerei (Kreuzung, Nordwest-Ecke)
  // Erdgeschoss weiß verputzt, Obergeschoss dunkle Holzschalung, steiles Ziegeldach mit drei Dachfenstern
  // (Foto 1, „rechts von schule“, Vorplatz-Kulisse Nord).
  {
    const x0 = SG.lot.x0, x1 = SG.lot.x1, zf = SG.lot.front, g = sgY(12), split = g + 2.7;
    house({ id: 'schulgasse_makerei', name: 'Makerei', x0, x1, zf, d: 9, eaves: g + 5.6, ridge: g + 11.2, wall: M.vpHouse });
    H.boxMinMax(M.sgWoodSiding, x0 - .04, split, zf - 9.04, x1 + .04, g + 5.59, zf + .04);
    for (const x of [6.5, 10.2, 13.8, 17.2]) win(x, g + .95, zf, .85, 1.0, { frame: M.sgWhite });
    detail.boxMinMax(M.vpDoorFrame, 19.6, g, zf + .005, 20.6, g + 2.15, zf + .02);
    for (const x of [7.5, 11.5, 15.5, 19.5]) win(x, split + 1.0, zf + .04, .7, .8, { frame: M.sgDoorWood, cols: 1, sill: false });
    const run = 4.5, a = Math.atan2(5.6, run + .35);
    for (const x of [8.5, 12.8, 17.1]) detail.add(M.vpDarkGlass, new THREE.BoxGeometry(.6, .05, .85), matrixFrom(x, g + 5.6 + 1.9 + .09 * Math.cos(a), zf + .35 - (run + .35) * .34 + .09 * Math.sin(a), a));
    H.boxMinMax(M.vpRoofTile, 14.6, g + 9.2, zf - 5.2, 15.2, g + 11.9, zf - 4.6);   // Kamin
  }
}

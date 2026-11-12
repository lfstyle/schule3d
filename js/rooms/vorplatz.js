// Vorplatz vor dem Eingang 130/131 an der Bucksgässle, über den Mauerweg mit dem Innenhof verbunden.
// 22 Fotos + 360°-Panorama in fotos/außenbereich Eingang; alle Maße geschätzt (PLANUNG 32,
// verification/VORPLATZ-ABGLEICH.md). Gegenüberliegendes Wohnhaus: vorplatz-gegenueber.js.
import * as THREE from 'three';
import { PartBuilder, matrixFrom, metricBoxUV } from '../geometry.js';
import { addWall } from '../objects.js';
import { createVegetation } from '../aussen-vegetation.js';
import { VP, wallZ, WALL_ROT, groundY, curbWest, curbEast, plazaEdge, houseX, archWest, archEast, VORPLATZ_REGIONS, inVorplatz } from '../vorplatz-layout.js';
import { buildGegenueber } from '../vorplatz-gegenueber.js';
import { buildGang } from '../vorplatz-gang.js';
import { buildFerneNord } from '../fernbebauung.js';

export function buildVorplatz({ scene, collision: C, materials: M, lighting, map, registerObject }) {
  const root = new THREE.Group(); root.name = 'vorplatz'; scene.add(root);
  const ground = new PartBuilder(), b = new PartBuilder(), facade = new PartBuilder(), rustica = new PartBuilder();
  const detail = new PartBuilder(), glass = new PartBuilder(), stone = new PartBuilder();
  // Baumkrone vor 130: keine Blätter in die Fassade.
  const plants = createVegetation(root, b, M, C, { hof: false, name: 'vorplatz', skip: (x, y, z, s) => x - s * .8 < VP.facade + .12 && z < VP.corner });
  const anchor = (id, type, name, x, y, z) => { const o = new THREE.Object3D(); o.position.set(x, y, z); root.add(o); registerObject(id, type, name, o); return o; };
  const block = (id, x0, z0, x1, z1, y0, y1, tag = 'wand') => C.addBox(x0, z0, x1, z1, y0, y1, { id, tag });
  const D = VP.door, dz = (D.z0 + D.z1) / 2, F = VP.facade, Y0 = -1.1;
  const quad = (builder, mat, pts) => {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(pts.length === 4 ? [0, 0, 1, 0, 1, 1, 0, 1] : [0, 0, 1, 0, .5, 1], 2));
    g.setIndex(pts.length === 4 ? [0, 1, 2, 0, 2, 3] : [0, 1, 2]); g.computeVertexNormals(); builder.add(mat, g);
  };
  const sign = (mat, w, h, x, y, z, ry, builder = detail) => builder.add(mat, new THREE.PlaneGeometry(w, h), matrixFrom(x, y, z, 0, ry));

  // ------------------------------------------------------------------ Boden
  // Streifen zwischen zwei Kanten x = left(z) … right(z); Höhe nach groundY, UVs in Metern.
  function strip(mat, left, right, z0, z1, tile, lift = 0, builder = ground) {
    const zs = new Set([z0, z1]);
    for (let z = Math.ceil(z0); z < z1; z++) zs.add(z);
    for (const k of [VP.zLow, VP.zHigh, -5, VP.houseNorth, VP.houseSouth]) if (k > z0 && k < z1) zs.add(k);
    const list = [...zs].sort((a, c) => a - c), pos = [], uv = [], idx = [];
    list.forEach((z, i) => {
      for (const x of [left(z), right(z)]) { pos.push(x, groundY(z) + lift, z); uv.push(x / tile, -z / tile); }
      if (i) { const a = (i - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); builder.add(mat, g);
  }
  const Z0 = -25.5, ZS = 11.4, ZT = 22, at = v => () => v, inner = z => curbWest(z) - VP.gutter;
  // Platz: dasselbe Verbundpflaster wie am Mauerweg (Fotos); Gehweg Granitplatten, Rinnen Kleinpflaster.
  // Westseite endet am Bordstein der Schulgasse (rooms/schulgasse.js), nördlich davon Asphalt der Kreuzung.
  const ZN = -19.6;
  strip(M.hofPaving, at(F), plazaEdge, ZN, ZS, 1.6);
  strip(M.vpSlab, plazaEdge, inner, ZN, ZS, 1.2);
  strip(M.vpSett, inner, curbWest, ZN, ZT, .8);
  strip(M.vpAsphalt, at(F), curbWest, Z0, ZN, 3);
  strip(M.vpAsphalt, curbWest, curbEast, Z0, ZT, 3);
  strip(M.vpSett, curbEast, z => curbEast(z) + .5, Z0, ZT, .8);
  const apron = z => curbEast(z) + .5;   // Vorfläche Wohnhaus: Granitpflaster (Panorama)
  strip(M.vpSett, apron, at(46), Z0, VP.houseNorth, .8);
  strip(M.vpSett, apron, z => houseX(z) + 3, VP.houseNorth, VP.houseSouth, .8);
  strip(M.vpSett, apron, z => Math.max(36.7, apron(z)), VP.houseSouth, ZT, .8);   // östlich davon: Gang (vorplatz-gang.js)
  const floorTag = { tag: 'boden', surface: 'tile', id: 'vorplatz_boden' };
  const XE = VP.gang.end;   // Boden bis zum Ende des Gangs hinter dem Wohnhaus
  C.addBox(F, Z0, XE, VP.zLow, VP.low - .3, VP.low, floorTag);
  C.add({ x: (F + XE) / 2, z: (VP.zLow + VP.zHigh) / 2, w: XE - F, d: VP.zHigh - VP.zLow, bottom: VP.low - .3, slope: { h0: VP.low, h1: VP.high }, ...floorTag });
  C.addBox(F, VP.zHigh, XE, ZT, VP.high - .3, VP.high, floorTag);
  map.areas.push({ poly: [[F, VP.north], [plazaEdge(VP.north), VP.north], [plazaEdge(9.4), 9.4], [28.7, wallZ(28.7)], [F, wallZ(F)]], fill: 'rgba(157,153,126,.22)' });
  map.areas.push({ poly: [[plazaEdge(-19.5), -19.5], [curbEast(-19.5), -19.5], [curbEast(9.4), 9.4], [plazaEdge(9.4), 9.4]], fill: 'rgba(110,112,116,.25)' });

  // ------------------------------------------------------------------ Schulfassade Ost (130/131)
  // Dünne Außenhaut vor den vorhandenen DV-Außenwänden (deren Außenseite trägt Innenputz) und darüber die
  // beiden Obergeschosse als Hülle. Öffnungen: Fenster 130/131, Nische des Ausgangs, obere Fensterreihen.
  const ops = [], uE = z => VP.corner - z;
  const opening = (zc, w, [sill, h]) => ops.push({ u: uE(zc + w / 2), w, y: sill - Y0, h });
  const axes = [...VP.win131, ...VP.win130];
  for (const zc of axes) for (const row of [VP.row1, VP.row2, VP.row3]) opening(zc, VP.winW, row);
  for (const row of [VP.row2, VP.row3]) opening(dz, 1.6, row);
  ops.push({ u: uE(D.z1), w: D.z1 - D.z0, y: 0, h: 4.9 - Y0 });
  const fw = addWall(facade, M, { start: [F + .02, VP.corner], end: [F + .02, VP.north], y0: Y0, height: VP.roof - Y0, thickness: .02, openings: ops, material: M.vpPlaster, baseboard: false });
  fw.colliders.forEach(c => C.add({ ...c, tag: 'fassade' })); map.walls.push(...fw.segments);
  // Obere Fenster: Laibung, hellgrauer Rahmen, Jalousien zu gut der Hälfte herab (Fotos).
  const upperWindow = (zc, w, [sill, h], blind = M.vpBlind, drop = .58) => {
    const x = F + .02, d = .2;
    facade.boxMinMax(M.vpPlaster, x - d, sill - .02, zc - w / 2, x, sill, zc + w / 2);
    facade.boxMinMax(M.vpPlaster, x - d, sill + h, zc - w / 2, x, sill + h + .02, zc + w / 2);
    for (const s of [-1, 1]) facade.boxMinMax(M.vpPlaster, x - d, sill, zc + s * w / 2 - (s > 0 ? .02 : 0), x, sill + h, zc + s * w / 2 + (s < 0 ? .02 : 0));
    const fx = x - .12;
    detail.boxMinMax(M.vpDarkGlass, fx - .03, sill + .005, zc - w / 2 + .02, fx - .02, sill + h - .005, zc + w / 2 - .02);
    for (const [y0, y1] of [[sill, sill + .06], [sill + h - .06, sill + h], [sill + h * .72 - .03, sill + h * .72 + .03]]) detail.boxMinMax(M.vpFrame, fx - .02, y0, zc - w / 2, fx + .04, y1, zc + w / 2);
    for (const z of [zc - w / 2, zc, zc + w / 2]) detail.boxMinMax(M.vpFrame, fx - .02, sill, z - .03, fx + .04, sill + h, z + .03);
    const yb = sill + h * (1 - drop);
    for (let y = yb + .003; y < sill + h - .08; y += .045) detail.boxMinMax(blind, fx - .019, y, zc - w / 2 + .05, fx - .009, y + .035, zc + w / 2 - .05);
    detail.boxMinMax(M.vpFrame, x - .003, sill - .05, zc - w / 2 - .04, x + .05, sill + .012, zc + w / 2 + .04);   // Außenfensterbank
  };
  for (const zc of axes) { upperWindow(zc, VP.winW, VP.row2); upperWindow(zc, VP.winW, VP.row3, M.vpBlind, .42); }
  upperWindow(dz, 1.6, VP.row2, M.vpBlindBrown, .92); upperWindow(dz, 1.6, VP.row3, M.vpBlind, .7);
  // Außenfensterbänke der DV-Räume
  for (const zc of axes) detail.boxMinMax(M.vpFrame, F + .015, VP.row1[0] - .05, zc - VP.winW / 2 - .04, F + .07, VP.row1[0], zc + VP.winW / 2 + .04);

  // Bossensockel mit Blechabdeckung; Eingangsrisalit mit Bossenpfeilern bis zur Traufe.
  const plinth = (z0, z1) => {
    rustica.boxMinMax(M.vpRustica, F + .02, Y0, z0, F + .1, VP.plinthTop, z1);
    b.boxMinMax(M.vpFlashing, F + .02, VP.plinthTop, z0, F + .14, VP.plinthTop + .05, z1);
    block('vorplatz_sockel', F, z0, F + .1, z1, Y0, VP.plinthTop, 'fassade');
  };
  plinth(VP.risalit.south[1], VP.corner); plinth(VP.north - .02, VP.risalit.north[0]);
  for (const [z0, z1] of [VP.risalit.south, VP.risalit.north]) {
    rustica.boxMinMax(M.vpRustica, F + .02, Y0, z0, F + .12, VP.roof, z1);
    block('vorplatz_risalit', F, z0, F + .12, z1, Y0, VP.roof, 'fassade');
  }
  // Nische vor der Außentür: Bossenputz an den Seiten, Untersicht oben, Schriftzug über der Tür.
  rustica.boxMinMax(M.vpRustica, D.x + .12, D.y, D.z1 - .015, F + .02, 4.9, D.z1);
  rustica.boxMinMax(M.vpRustica, D.x + .12, D.y, D.z0, F + .02, 4.9, D.z0 + .015);
  facade.boxMinMax(M.vpPlaster, D.x - .1, 4.88, D.z0 + .002, F + .02, 5.12, D.z1 - .002);
  sign(M.vpSchoolLetters, 2.1, .26, D.x + .126, D.y + 2.49, dz, Math.PI / 2);
  // Rauchfrei-Schild an der Laibung nahe dem Türrahmen, 30 × 20 cm auf 6 mm Trägerplatte (Schätzmaße).
  detail.boxMinMax(M.vpFrame, D.x + .32, D.y + 1.50, D.z1 - .021, D.x + .62, D.y + 1.70, D.z1 - .015);
  sign(M.vpSignSmoke, .30, .20, D.x + .47, D.y + 1.60, D.z1 - .0215, Math.PI);
  sign(M.vpSchoolLettersGrey, 2.7, .34, F + .022, 1.95, -10.75, Math.PI / 2);
  sign(M.vpSignPrivate, .44, .22, F + .102, groundY(8.9) + 1.95, 8.9, Math.PI / 2, b);
  // Kellerfenster mit roten Rahmen im Sockel (unter den Fensterachsen, Fotos) und Lüftungsgitter.
  const cellar = (zc, w = .78, h = .56) => {
    const y = groundY(zc) + .3, x = F + .1;
    b.boxMinMax(M.vpDarkGlass, x, y + .01, zc - w / 2 + .01, x + .004, y + h - .01, zc + w / 2 - .01);
    for (const [y0, y1, z0, z1] of [[y, y + .05, zc - w / 2, zc + w / 2], [y + h - .05, y + h, zc - w / 2, zc + w / 2], [y, y + h, zc - w / 2, zc - w / 2 + .05], [y, y + h, zc + w / 2 - .05, zc + w / 2], [y, y + h, zc - .02, zc + .02]])
      b.boxMinMax(M.vpRedFrame, x, y0, z0, x + .03, y1, z1);
    b.boxMinMax(M.vpFrame, x, y - .04, zc - w / 2 - .03, x + .06, y, zc + w / 2 + .03);
  };
  for (const zc of [0.18, -1.96, ...VP.win130]) cellar(zc);
  { const zc = 2.32, y = groundY(zc) + .55; b.boxMinMax(M.vpGrille, F + .1, y, zc - .38, F + .115, y + .5, zc + .38);
    for (let yy = y + .04; yy < y + .48; yy += .055) b.boxMinMax(M.vpFlashing, F + .115, yy, zc - .35, F + .125, yy + .02, zc + .35); }

  // Verteilerschrank vor 131 (Fotos „sicht zu Mauerweg“, „außen vor dem eingang“), zwei Kleinkästen vor 130.
  const cabinet = (id, z0, z1, h, d, name) => {
    const g = groundY((z0 + z1) / 2), x0 = F + .1;
    b.boxMinMax(M.vpCabinet, x0, g, z0, x0 + d, g + h, z1);
    b.boxMinMax(M.vpCabinet, x0 - .01, g + h, z0 - .02, x0 + d + .03, g + h + .03, z1 + .02);
    if (z1 - z0 > 1) detail.boxMinMax(M.vpFlashing, x0 + d, g + .08, (z0 + z1) / 2 - .006, x0 + d + .004, g + h - .04, (z0 + z1) / 2 + .006);
    detail.boxMinMax(M.vpFlashing, x0 + d, g + h * .55, (z0 + z1) / 2 + .1, x0 + d + .02, g + h * .55 + .12, (z0 + z1) / 2 + .13);
    block(id, x0, z0, x0 + d + .03, z1, g, g + h);
    anchor(id, 'utility', name, x0 + d / 2, g, (z0 + z1) / 2);
  };
  cabinet('vorplatz_verteilerschrank', 3.0, 4.5, 1.55, .45, 'Verteilerschrank');
  cabinet('vorplatz_kasten_1', -13.55, -13.1, .95, .3, 'Anschlusskasten');
  cabinet('vorplatz_kasten_2', -14.05, -13.65, .8, .3, 'Anschlusskasten');
  // Pflanzstreifen vor 131 bis zur Treppe: Betonkante, niedrige Sträucher (teils verblüht).
  { const z0 = -2.45, z1 = 2.95, x0 = F + .1, x1 = 20.62;
    strip(M.hofSoil, at(x0), at(x1 - .08), z0, z1, 1, .06, b);
    for (const [a, c] of [[[x1 - .08, z0], [x1, z1]], [[x0, z0 - .08], [x1, z0]]]) {
      const g = groundY((a[1] + c[1]) / 2); b.boxMinMax(M.vpConcrete, a[0], g - .05, a[1], c[0], g + .12, c[1]);
    }
    for (let z = z0 + .35, i = 0; z < z1 - .2; z += .72, i++) plants.shrub(20.3, z, { y: groundY(z) + .05, h: .6, w: .72, color: i % 2 ? 0x8a7a52 : 0x6c8a4c, vivid: i % 2 === 1, n: 45 });   // grün und verblüht
    C.add({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0, bottom: VP.low - .2, slope: { h0: groundY(z0) + .45, h1: groundY(z1) + .45 }, tag: 'beet' });
  }

  // ------------------------------------------------------------------ Nordseite 130 (Schulgasse)
  // Außenhaut wie Ostseite bis zur Westkante 130 (x = 12,22); 129, Kreismedienstelle und die Gasse
  // nach Westen baut rooms/schulgasse.js.
  { const ops2 = [], uN = x => F + .02 - x, W130 = 12.22;
    for (const xc of [13.8, 18.0]) for (const row of [VP.row1, VP.row2, VP.row3]) ops2.push({ u: uN(xc + VP.winW / 2), w: VP.winW, y: row[0] - Y0, h: row[1] });
    const nw = addWall(facade, M, { start: [F + .02, VP.north - .02], end: [W130, VP.north - .02], y0: Y0, height: VP.roof - Y0, thickness: .02, openings: ops2, material: M.vpPlaster, baseboard: false });
    nw.colliders.forEach(c => C.add({ ...c, tag: 'fassade' })); map.walls.push(...nw.segments);
    rustica.boxMinMax(M.vpRustica, W130, Y0, VP.north - .1, F + .1, VP.plinthTop, VP.north - .02);
    b.boxMinMax(M.vpFlashing, W130, VP.plinthTop, VP.north - .14, F + .14, VP.plinthTop + .05, VP.north - .02);
    for (const xc of [13.8, 18.0]) {
      detail.boxMinMax(M.vpFrame, xc - VP.winW / 2 - .04, VP.row1[0] - .05, VP.north - .09, xc + VP.winW / 2 + .04, VP.row1[0], VP.north - .015);
      for (const [row, drop] of [[VP.row2, .58], [VP.row3, .42]]) northWindow(xc, row, drop);
    }
  }
  function northWindow(xc, [sill, h], drop) {
    const z = VP.north - .02, w = VP.winW, d = .2;
    facade.boxMinMax(M.vpPlaster, xc - w / 2, sill - .02, z, xc + w / 2, sill, z + d);
    facade.boxMinMax(M.vpPlaster, xc - w / 2, sill + h, z, xc + w / 2, sill + h + .02, z + d);
    for (const s of [-1, 1]) facade.boxMinMax(M.vpPlaster, xc + s * w / 2 - (s > 0 ? .02 : 0), sill, z, xc + s * w / 2 + (s < 0 ? .02 : 0), sill + h, z + d);
    const fz = z + .12;
    detail.boxMinMax(M.vpDarkGlass, xc - w / 2 + .02, sill + .005, fz + .02, xc + w / 2 - .02, sill + h - .005, fz + .03);
    for (const [y0, y1] of [[sill, sill + .06], [sill + h - .06, sill + h], [sill + h * .72 - .03, sill + h * .72 + .03]]) detail.boxMinMax(M.vpFrame, xc - w / 2, y0, fz - .04, xc + w / 2, y1, fz + .02);
    for (const x of [xc - w / 2, xc, xc + w / 2]) detail.boxMinMax(M.vpFrame, x - .03, sill, fz - .04, x + .03, sill + h, fz + .02);
    for (let y = sill + h * (1 - drop) + .003; y < sill + h - .08; y += .045) detail.boxMinMax(M.vpBlind, xc - w / 2 + .05, y, fz + .009, xc + w / 2 - .05, y + .035, fz + .019);
    detail.boxMinMax(M.vpFrame, xc - w / 2 - .04, sill - .05, z - .05, xc + w / 2 + .04, sill + .012, z + .003);
  }
  // Dachrand: flache Dachhaut wie am Mauerweg (aussenbereich.js roofStrip), Rinne an der Traufe.
  facade.boxMinMax(M.hofRoof, 12.0, VP.roof + .05, VP.north - .3, 20.0, VP.roof + .18, 4.0);
  b.rod(M.hofCoping, [20.0, VP.roof - .02, VP.north - .3], [20.0, VP.roof - .02, 4.0], .075, 10);
  b.rod(M.hofCoping, [12.0, VP.roof - .02, VP.north - .3], [20.0, VP.roof - .02, VP.north - .3], .075, 10);

  // ------------------------------------------------------------------ Podest, Stufen, Vordach
  // Podest auf Höhe der Außentür (−0,45), drei Stufen à 16 cm / Auftritt 32 cm umlaufend (Fotos).
  b.boxMinMax(M.vpStep, D.x + .12, D.y - .2, D.z0, F + .02, D.y, D.z1);
  C.addBox(D.x + .12, D.z0, F + .02, D.z1, D.y - .2, D.y, { tag: 'boden', surface: 'tile', id: 'vorplatz_podest' });
  const steps = [[D.y, .6, .4], [D.y - .16, .92, .72], [D.y - .32, 1.24, 1.04]];
  for (const [top, ex, ez] of steps) {
    b.boxMinMax(M.vpStep, F + .02, VP.low - .12, -6.45 - ez, F + ex, top, -3.65 + ez);
    C.addBox(F, -6.45 - ez, F + ex, -3.65 + ez, VP.low - .12, top, { tag: 'treppe', surface: 'tile', id: 'vorplatz_stufen' });
  }
  for (const [top, ex, ez] of steps) b.boxMinMax(M.vpStep, F + ex - .03, top - .006, -6.45 - ez + .03, F + ex, top + .002, -3.65 + ez - .03);   // Kantenbetonung
  // Glasvordach: Satteldach, First quer zur Fassade, vier Stahlstützen auf Betonsockeln, vorn Giebeldreieck.
  const cz0 = -7.05, cz1 = -3.05, xR = 20.14, xF = 22.85, xe = 22.98, ye = 2.35, yr = 3.35;
  for (const [x, z] of [[xR, cz0], [xR, cz1], [xF, cz0], [xF, cz1]]) {
    const g = groundY(z), top = x === xR ? D.y + .85 : g + 1.1;
    b.boxMinMax(M.vpConcrete, x - .18, g - .1, z - .18, x + .18, top, z + .18);
    b.cylinder(M.vpSteel, .055, .055, ye - top, x, (top + ye) / 2, z, 12);
    block('vorplatz_vordach_stuetze', x - .18, z - .18, x + .18, z + .18, g - .1, ye + .1);
  }
  const bar = (a, c, w = .06, h = .1) => b.bar(M.vpSteel, a, c, w, h);
  for (const z of [cz0, cz1]) bar([F + .02, ye, z], [xe, ye, z], .07, .12);
  bar([xe, ye, cz0], [xe, ye, cz1], .07, .12); bar([F + .07, ye, cz0], [F + .07, ye, cz1], .07, .12);
  bar([F + .02, yr, dz], [xe, yr, dz], .07, .1);
  for (const x of [F + .07, 20.95, 21.95, xe]) for (const z of [cz0, cz1]) bar([x, ye, z], [x, yr, dz], .05, .08);
  bar([xe, ye, dz], [xe, yr, dz], .05, .06);
  for (const s of [-1, 1]) {
    bar([xe, ye, dz], [xe, (ye + yr) / 2, dz + s * 1.0], .04, .05);
    for (const x of [xR, xF]) bar([x, ye - .6, dz + s * 2], [x === xR ? x + .6 : x - .6, ye, dz + s * 2], .04, .05);
    bar([xF, ye - .6, dz + s * 2], [xF, ye, dz + s * 1.4], .04, .05);
  }
  for (const [za, zb] of [[cz0, dz], [cz1, dz]]) quad(glass, M.vpCanopyGlass, [[F + .02, ye + .07, za], [xe, ye + .07, za], [xe, yr + .06, zb], [F + .02, yr + .06, zb]]);
  quad(glass, M.vpCanopyGlass, [[xe, ye, cz0], [xe, ye, cz1], [xe, yr, dz]]);
  anchor('vorplatz_vordach', 'canopy', 'Glasvordach Eingang', 21.5, ye, dz);

  // ------------------------------------------------------------------ Baum, Laterne, Poller
  { const x = 22.0, z = -9.6, g = groundY(z);
    plants.tree(x, z, { height: 8.4, width: 5.4, base: g, color: 0xbdb24a, vivid: true });
    b.cylinder(M.vpGrate, .74, .74, .02, x, g + .006, z, 28);
    for (let i = 0; i < 18; i++) { const a = i * Math.PI / 9; b.box(M.vpSett, .2, .05, .12, x + Math.cos(a) * .84, g + .012, z + Math.sin(a) * .84, 0, -a + Math.PI / 2); }
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; b.rod(M.vpGalv, [x + Math.cos(a) * .36, g, z + Math.sin(a) * .36], [x + Math.cos(a) * .22, g + .5, z + Math.sin(a) * .22], .011, 6); b.rod(M.vpGalv, [x + Math.cos(a) * .22, g + .5, z + Math.sin(a) * .22], [x + Math.cos(a) * .22, g + 1.72, z + Math.sin(a) * .22], .011, 6); }
    for (const [y, r] of [[.5, .22], [1.05, .22], [1.7, .22]]) b.add(M.vpGalv, new THREE.TorusGeometry(r, .01, 5, 18), matrixFrom(x, g + y, z, Math.PI / 2));
    block('vorplatz_baumschutz', x - .3, z - .3, x + .3, z + .3, g, g + 1.75, 'baum');
    anchor('vorplatz_baum', 'exterior', 'Baum vor dem Eingang', x, g, z);
  }
  { const x = 23.9, z = -2.6, g = groundY(z);
    b.cylinder(M.vpBollard, .1, .14, .5, x, g + .25, z, 14);
    b.cylinder(M.vpBollard, .05, .068, 4.3, x, g + .5 + 2.15, z, 12);
    for (const [s, h] of [[-1, 5.0], [1, 4.75]]) {
      b.rod(M.vpBollard, [x, h - .45, z], [x, h - .05, z + s * .25], .03, 8);
      b.rod(M.vpBollard, [x, h - .05, z + s * .25], [x, h - .02, z + s * .55], .03, 8);
      b.rod(M.vpBollard, [x, h - .02, z + s * .55], [x, h - .14, z + s * .62], .025, 8);
      b.cylinder(M.vpLampHead, .05, .21, .22, x, h - .26, z + s * .62, 16);
      b.cylinder(M.hofLamp, .19, .19, .02, x, h - .37, z + s * .62, 16);
    }
    block('vorplatz_laterne', x - .14, z - .14, x + .14, z + .14, g, g + 4.5, 'mast');
    anchor('vorplatz_laterne', 'lamp', 'Straßenlaterne', x, g, z);
  }
  const bollard = (x, z) => {
    const g = groundY(z);
    b.cylinder(M.vpBollard, .085, .09, .12, x, g + .06, z, 12); b.cylinder(M.vpBollard, .052, .058, .72, x, g + .48, z, 12);
    for (const y of [.3, .62]) b.cylinder(M.vpBollard, .068, .068, .04, x, g + y, z, 12);
    b.cylinder(M.vpBollard, .065, .045, .08, x, g + .86, z, 12); b.add(M.vpBollard, new THREE.SphereGeometry(.06, 10, 7), matrixFrom(x, g + .94, z));
    block('vorplatz_poller', x - .08, z - .08, x + .08, z + .08, g, g + .98, 'poller');
  };
  for (let z = -19; z < 8.8; z += 2.8) if (Math.abs(z + 2.6) > .8) bollard(inner(z) - .25, z);

  // ------------------------------------------------------------------ Steinhaus und Torbogen
  // Fortsetzung der alten Mauer vom Mauerweg bis zum Torbogen: Steinhaus, Traufe 6,1 wie die Mauer,
  // Satteldach; kleine Fenster: unten vier, oben zwei an der Westhälfte (mauer.jpg). Lokal: x entlang der
  // Flucht, +z = vom Platz weg (Süden).
  const k = Math.hypot(1, .128), W0 = 19.8, W1 = archWest(), L = (W1 - W0) * k, HD = 6.5;
  const wallFrame = (builder, x0) => builder.push(x0, 0, wallZ(x0), WALL_ROT);
  const wpt = (x0, u, n) => [x0 + u / k + n * .128 / k, wallZ(x0) - u * .128 / k + n / k];   // Weltpunkt
  wallFrame(stone, W0);
  stone.add(M.hofStone, metricBoxUV(new THREE.BoxGeometry(L, 7.4, HD - .05), 3.2), matrixFrom(L / 2, 6.1 - 3.7, .05 + (HD - .05) / 2));
  // Fensterchen: dunkle Öffnung mit heller Steinrahmung
  const slit = (u, y, w, h) => {
    stone.box(M.vpDarkGlass, w, h, .02, u, y, .045);
    for (const [ww, hh, uu, yy] of [[w + .16, .08, u, y + h / 2 + .04], [w + .2, .09, u, y - h / 2 - .045], [.08, h, u - w / 2 - .04, y], [.08, h, u + w / 2 + .04, y]]) stone.box(M.hofOldPlaster, ww, hh, .04, uu, yy, .04);
  };
  for (const u of [2.0, 3.6]) slit(u, 4.75, .3, .5);
  for (const u of [1.9, 3.6, 5.1, 6.7]) slit(u, 2.6, .28, .46);
  // Dach: vorn und hinten, First mittig; Ostgiebel aus Stein.
  const roofSlope = (z0, z1, y0, y1) => { const len = Math.hypot(z1 - z0, y1 - y0), a = Math.atan2(y1 - y0, z1 - z0); stone.box(M.hofRoof, L + .05, .12, len, (L + .05) / 2, (y0 + y1) / 2, (z0 + z1) / 2, -a); };
  const ridge = 6.12 + (HD / 2 + .35) * Math.tan(THREE.MathUtils.degToRad(40));
  roofSlope(-.35, HD / 2, 6.12, ridge); roofSlope(HD + .2, HD / 2, 6.12, ridge);
  stone.rod(M.hofCoping, [0, ridge + .05, HD / 2], [L + .05, ridge + .05, HD / 2], .07, 8);
  stone.rod(M.hofCoping, [0, 6.08, -.33], [L + .05, 6.08, -.33], .06, 8);
  { const g = new THREE.BufferGeometry(), pts = [L, 6.1, .05, L, ridge - .1, HD / 2, L, 6.1, HD];
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 1, 1], 2)); g.computeVertexNormals(); stone.add(M.hofStone, g); }
  stone.pop();
  { const [cx, cz] = wpt(W0, L / 2, HD / 2); C.add({ x: cx, z: cz, w: L, d: HD, rot: WALL_ROT, bottom: -2, top: 7, tag: 'wand', id: 'vorplatz_steinhaus' }); }
  map.walls.push([W0, wallZ(W0), W1, wallZ(W1)]);
  // Efeubeet mit Betonkante vor dem Steinhaus, Blattwerk kurz vor dem Torbogen (Fotos).
  // Beet beginnt 1,6 m östlich der Ecke: Weg vom Mauerweg auf den Platz bleibt frei.
  { const u0 = 1.6, u1 = L - .1, depth = 1.2, yb = VP.high;
    wallFrame(b, W0);
    b.box(M.vpConcrete, u1 - u0, .2, .1, (u0 + u1) / 2, yb + .05, -depth);
    b.box(M.vpConcrete, .1, .2, depth, u0, yb + .05, -depth / 2);
    b.box(M.hofSoil, u1 - u0, .02, depth - .1, (u0 + u1) / 2, yb + .08, -depth / 2 + .05);
    b.pop();
    for (let u = u0 + .4; u < L - 3; u += .7) for (const n of [-.35, -.85]) { const [x, z] = wpt(W0, u + (n < -.5 ? .35 : 0), n); plants.shrub(x, z, { y: yb + .06, h: .42, w: .9, color: 0x4b6a36, n: 34 }); }
    for (const u of [1.6, 4.4, 6.3]) { const [x, z] = wpt(W0, u, -.04); plants.ivy(x, yb + .9, z, 1.6, 1.4, 0x56713f); }
    { const [x, z] = wpt(W0, L - 1.55, -1.02); plants.ivy(x, yb + .8, z, 2.6, 1.5, 0x5f8040); }
    const [cx, cz] = wpt(W0, (u0 + u1) / 2, -depth / 2);
    C.add({ x: cx, z: cz, w: u1 - u0, d: depth, rot: WALL_ROT, bottom: yb - .2, top: yb + .45, tag: 'beet', id: 'vorplatz_efeubeet' });
  }
  // Torbogen (Panorama, mauer.jpg, links mauertor/): Fensterpfeiler – Hauptbogen – Westpfeiler –
  // Fußgängerbogen – Endpfeiler, Tiefe 1,1 m, kleines Satteldach über der ganzen Breite.
  { const A = VP.arch, x0 = archWest(), gs = VP.high, top = A.top - gs, U = x => (x - x0) * k;
    const tu = U(archEast()), mu0 = U(A.x0), mu1 = U(A.x1), r = (mu1 - mu0) / 2, cu = mu0 + r;
    const pu0 = U(A.x0 - A.west - A.ped.w), pu1 = U(A.x0 - A.west), pr = (pu1 - pu0) / 2;
    const W = A.win, wu0 = mu1 + W.off, wu1 = wu0 + W.w;
    const shape = new THREE.Shape([new THREE.Vector2(0, -.8), new THREE.Vector2(tu, -.8), new THREE.Vector2(tu, top), new THREE.Vector2(0, top)]);
    const arch = (a, b, rad, spring) => { const h = new THREE.Path(); h.moveTo(a, -.8); h.lineTo(a, spring); h.absarc(a + rad, spring, rad, Math.PI, 0, true); h.lineTo(b, -.8); h.lineTo(a, -.8); shape.holes.push(h); };
    arch(mu0, mu1, r, A.spring); arch(pu0, pu1, pr, A.ped.spring);
    // Öffnung im Fensterpfeiler: Brüstung als Sitzbank, flacher Stichbogen oben (links von dem Mauertor.jpg)
    { const h = new THREE.Path(); h.moveTo(wu0, W.sill); h.lineTo(wu1, W.sill); h.lineTo(wu1, W.side); h.quadraticCurveTo((wu0 + wu1) / 2, 2 * W.top - W.side, wu0, W.side); h.lineTo(wu0, W.sill); shape.holes.push(h); }
    const geo = new THREE.ExtrudeGeometry(shape, { depth: A.depth, bevelEnabled: false, curveSegments: 18 });
    const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 3.2, uv.getY(i) / 3.2);
    stone.push(x0, gs, wallZ(x0), WALL_ROT); stone.add(M.hofStone, geo);
    // Dunkles Sockelband am Fensterpfeiler (Gangseite, Fotos), Satteldach über die ganze Breite
    stone.box(M.vpPierBand, tu - mu1 - .02, .28, .012, (mu1 + tu) / 2 + .01, .14, -.006);
    for (const s of [-1, 1]) { const len = Math.hypot(A.depth / 2 + .3, .5), a = Math.atan2(.5, A.depth / 2 + .3); stone.box(M.hofRoof, tu + .3, .1, len, tu / 2, top + .25, A.depth / 2 + s * (A.depth / 4 + .15), s * a); }
    stone.rod(M.hofCoping, [-.15, top + .52, A.depth / 2], [tu + .15, top + .52, A.depth / 2], .06, 8);
    { const g = new THREE.BufferGeometry(), d = A.depth, pts = [tu + .15, top + .02, -.3, tu + .15, top + .02, d + .3, tu + .15, top + .5, d / 2];   // Giebeldreieck Ostende
      g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, .5, .3], 2)); g.computeVertexNormals(); stone.add(M.hofRoof, g); }
    // Wandlaternen am Westpfeiler neben dem Bogen: Platzseite und Südseite (Panorama, sicht zu Eingang.jpg)
    for (const [z, dz] of [[0, -1], [A.depth, 1]]) {
      const lu = mu0 - .3;
      stone.rod(M.vpBollard, [lu, 4.3, z], [lu, 4.3, z + dz * .38], .02, 6);
      stone.rod(M.vpBollard, [lu, 4.3, z + dz * .38], [lu, 4.18, z + dz * .42], .015, 6);
      stone.cylinder(M.vpBollard, .04, .16, .2, lu, 4.08, z + dz * .42, 14);
      stone.cylinder(M.hofLamp, .14, .14, .02, lu, 3.97, z + dz * .42, 14);
    }
    stone.pop();
    const pier = (id, u0, u1) => { const [cx, cz] = wpt(x0, (u0 + u1) / 2, A.depth / 2); C.add({ x: cx, z: cz, w: u1 - u0, d: A.depth, rot: WALL_ROT, bottom: gs - .5, top: A.top + 1, tag: 'wand', id }); };
    pier('vorplatz_torbogen', 0, pu0); pier('vorplatz_torbogen', pu1, mu0); pier('vorplatz_torbogen', mu1, tu);
    // Durchgänge sind Spielgrenze (Straße jenseits nicht gebaut, Kulisse dahinter).
    for (const [u0, u1, h] of [[mu0, mu1, A.top], [pu0, pu1, gs + A.ped.spring + pr]]) {
      const [cx, cz] = wpt(x0, (u0 + u1) / 2, A.depth / 2); C.add({ x: cx, z: cz, w: u1 - u0, d: .2, rot: WALL_ROT, bottom: gs - .5, top: h, tag: 'grenze', id: 'vorplatz_grenze_torbogen' });
    }
    const wx = u => x0 + u / k;
    map.walls.push([x0, wallZ(x0), wx(pu0), wallZ(wx(pu0))], [wx(pu1), wallZ(wx(pu1)), A.x0, wallZ(A.x0)], [A.x1, wallZ(A.x1), archEast(), wallZ(archEast())]);
    anchor('vorplatz_torbogen', 'exterior', 'Torbogen', (A.x0 + A.x1) / 2, gs, wallZ((A.x0 + A.x1) / 2));
    anchor('vorplatz_fussgaengerbogen', 'exterior', 'Fußgängerbogen im Torbogen', wx((pu0 + pu1) / 2), gs, wallZ(wx((pu0 + pu1) / 2)));
    anchor('vorplatz_fensterpfeiler', 'exterior', 'Fensterpfeiler am Torbogen', wx((wu0 + wu1) / 2), gs, wallZ(wx((wu0 + wu1) / 2)));
    // Verkehrszeichen vor dem Westpfeiler (Blick vom Platz)
    const sx = A.x0 - .35, sz = wallZ(sx) - .45, g = groundY(sz);
    b.rod(M.vpGalv, [sx, g, sz], [sx, g + 3.2, sz], .03, 8);
    sign(M.vpSignTriangle, .7, .7, sx, g + 2.78, sz - .035, Math.PI, b);
    sign(M.vpSignEndZone, .62, .46, sx, g + 2.12, sz - .035, Math.PI, b);
    block('vorplatz_schildmast', sx - .05, sz - .05, sx + .05, sz + .05, g, g + 3.2, 'mast');
  }
  // Gittertor am Ende des Mauerwegs: geöffnet, liegt an der Steinmauer (Fotos aus beiden Richtungen).
  { const hx = 19.9, hz = wallZ(hx) - .1, g = VP.high, len = 1.45, rot = -Math.atan2(.128, -1);
    detail.push(hx, g, hz, rot);
    detail.rod(M.vpGalv, [0, 0, 0], [0, 1.92, 0], .04, 10);
    for (const x of [.08, len]) detail.rod(M.vpGalv, [x, .05, 0], [x, 1.8, 0], .022, 8);
    for (const y of [.05, 1.8]) detail.rod(M.vpGalv, [.08, y, 0], [len, y, 0], .022, 8);
    for (let x = .13; x < len; x += .05) detail.bar(M.vpGalv, [x, .07, 0], [x, 1.78, 0], .005, .005);
    for (let y = .25; y < 1.8; y += .2) for (const o of [-.008, .008]) detail.bar(M.vpGalv, [.08, y, o], [len, y, o], .005, .005);
    detail.box(M.vpFrame, .24, .3, .006, .5, 1.45, -.02);
    for (const y of [.25, .7, 1.35]) detail.box(M.vpGalv, .06, .05, .06, .02, y, 0);
    detail.pop();
    const cx = hx + Math.cos(rot) * len / 2, cz = hz - Math.sin(rot) * len / 2;
    C.add({ x: cx, z: cz, w: len, d: .06, rot, bottom: g, top: g + 1.85, tag: 'zaun', id: 'vorplatz_gittertor' });
    anchor('vorplatz_gittertor', 'gate', 'Gittertor zum Mauerweg (offen)', hx, g, hz);
  }

  // ------------------------------------------------------------------ Gegenüber, Kulissen, Grenzen
  buildGegenueber({ root, b, detail, facade, ground, C, M, plants, block, anchor, sign, quad, map });
  buildGang({ b, detail, facade, ground, glass, C, M, anchor, sign, quad, map });
  const backdrop = (mat, w, h, x, y, z, ry, u0 = 0) => {
    const geo = new THREE.PlaneGeometry(w, h);
    // Um 180° gedreht (Blick nach Süden): Bild sonst seitenverkehrt. u0: links beschnitten.
    { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) { const u = u0 + (1 - u0) * uv.getX(i); uv.setX(i, ry ? 1 - u : u); } }
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; m.userData.noAO = true; m.name = 'vorplatz_kulisse'; root.add(m);
    if (!lighting.exteriorMaterials.includes(mat)) lighting.exteriorMaterials.push(mat);
  };
  // Panorama-Umprojektion (assets/textures/vorplatz/QUELLEN.md): Durchblick Torbogen. Nach Norden (Bucksgässle hinter
  // der Kreuzung) stehen statt der früheren Fotokulisse gebaute Häuser (fernbebauung.js).
  backdrop(M.vpBackdropArch, 20, 11.55, 34, (-0.55 + 11) / 2, 22, Math.PI);
  buildFerneNord({ root, M });
  const barrier = (id, x0, z0, x1, z1) => { const len = Math.hypot(x1 - x0, z1 - z0); C.add({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: len, d: .2, rot: -Math.atan2(z1 - z0, x1 - x0), bottom: -2, top: 8, tag: 'grenze', id }); };
  barrier('vorplatz_grenze_nord', 27.4, -19.5, houseX(-19.5) + 2.6, -19.5);   // bis zur Arkaden-Rückwand; westlich davon Schulgasse

  // ------------------------------------------------------------------ Licht, Sichtbarkeit, Abschluss
  const circuit = lighting.addCircuit('licht_vorplatz', { lights: [], panels: [], regions: VORPLATZ_REGIONS, on: false }); circuit.roomId = 'vorplatz';
  // Öffnungen für Durchblick (Raum-Sichtbarkeit) und schwachen Lichtschein aus den Räumen.
  const portal = (id, room, center, normal, width, height, power = .12) => lighting.portals.add({ id, rooms: [room, 'licht_vorplatz'], center, normal, width, height, transmission: .5, power, range: 3 });
  portal('vorplatz_131_fenster', 'licht_131', [19.62, 3.5, 1.25], [1, 0], 7.75, 2.1);
  portal('vorplatz_130_fenster', 'licht_130', [19.62, 3.5, -11.425], [1, 0], 7.75, 2.1);
  portal('vorplatz_130_nordfenster', 'licht_130', [15.9, 3.5, -16.27], [0, -1], 5.5, 2.1);
  portal('vorplatz_flur2_ausgang', 'licht_flur2', [D.x, 1.9, dz], [1, 0], D.z1 - D.z0, 4.7, .15);
  // Mauerweg ↔ Vorplatz ohne Portal: gegenseitig in OWNERS (room-visibility.js), sonst würden vom Platz aus
  // auch Foyer, Flur 1 usw. (Besitzer des Hofs) mitgezeichnet.

  const plantStats = plants.build();
  root.add(ground.build({ name: 'vorplatz_boden', castShadow: false }), b.build({ name: 'vorplatz_ausstattung' }), stone.build({ name: 'vorplatz_steinhaus_torbogen' }),
    detail.build({ name: 'vorplatz_feindetails', castShadow: false }), glass.build({ name: 'vorplatz_glas', castShadow: false }));
  const facadeGroup = facade.build({ name: 'vorplatz_fassaden' }), rusticaGroup = rustica.build({ name: 'vorplatz_bossenputz' });
  facadeGroup.traverse(o => { if (o.isMesh && (o.material === M.vpPlaster || o.material === M.vpHouse)) metricBoxUV(o.geometry, .65); });
  rusticaGroup.traverse(o => { if (o.isMesh) metricBoxUV(o.geometry, .72); });
  root.add(facadeGroup, rusticaGroup);
  root.userData.vegetation = plantStats;
  map.labels.push({ text: 'Vorplatz', x: 21.8, z: 2 }, { text: 'Bucksgässle', x: 27.6, z: -10 });
  anchor('vorplatz', 'exterior', 'Vorplatz Eingang 130/131', 22, VP.low, 0);
  return { id: 'vorplatz', name: 'Vorplatz', root, regions: VORPLATZ_REGIONS,
    bounds: { minX: 3, maxX: 55, minZ: -26, maxZ: 24, minY: -3, maxY: 16 },
    areaName: p => {
      if (!inVorplatz(p)) return null;
      if (p.x < F) return p.z < VP.north ? 'Außenbereich · Schulgasse' : 'Eingang 130/131';
      if (p.x > houseX(VP.houseSouth) && p.z > VP.gang.north - .5 && p.z < VP.gang.rail + .2) return 'Außenbereich · Gang am Torbogen';
      return p.x > plazaEdge(p.z) ? 'Außenbereich · Bucksgässle' : 'Außenbereich · Vorplatz';
    } };
}

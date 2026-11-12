// Schulgasse an der Nordseite von 130, 129 und Future Lab bis zum Eingang „Kaufmännische Schule“ (rote Türen
// der Eingangshalle Flur 1) und der Arkade davor; an der Kreuzung mit der Bucksgässle an den Vorplatz angeschlossen.
// 21 Fotos + 360°-Panorama in fotos/schulgasse; alle Maße geschätzt (PLANUNG 33,
// verification/SCHULGASSE-ABGLEICH.md). Häuser gegenüber: schulgasse-gegenueber.js, Gassenende: fernbebauung.js.
import * as THREE from 'three';
import { PartBuilder, matrixFrom, metricBoxUV } from '../geometry.js';
import { addWall } from '../objects.js';
import { createVegetation } from '../aussen-vegetation.js';
import { VP } from '../vorplatz-layout.js';
import { SG, SG_BREAKS, sgY, SCHULGASSE_REGIONS, inSchulgasse } from '../schulgasse-layout.js';
import { buildSchulgasseGegenueber } from '../schulgasse-gegenueber.js';
import { buildFerneWest } from '../fernbebauung.js';

export function buildSchulgasse({ scene, collision: C, materials: M, lighting, map, registerObject }) {
  const root = new THREE.Group(); root.name = 'schulgasse'; scene.add(root);
  const ground = new PartBuilder(), b = new PartBuilder(), facade = new PartBuilder(), stripes = new PartBuilder(), rustica = new PartBuilder();
  const detail = new PartBuilder(), glass = new PartBuilder(), ceiling = new PartBuilder(), houses = new PartBuilder();
  const plants = createVegetation(root, b, M, C, { hof: false, name: 'schulgasse' });
  const anchor = (id, type, name, x, y, z) => { const o = new THREE.Object3D(); o.position.set(x, y, z); root.add(o); registerObject(id, type, name, o); return o; };
  const block = (id, x0, z0, x1, z1, y0, y1, tag = 'wand') => C.addBox(x0, z0, x1, z1, y0, y1, { id, tag });
  const sign = (mat, w, h, x, y, z, ry, builder = detail) => builder.add(mat, new THREE.PlaneGeometry(w, h), matrixFrom(x, y, z, 0, ry));
  const Y0 = -1.1, PI = Math.PI, P = SG.porchY, PL = SG.plazaY;
  const wall = (builder, o, tag = 'fassade') => {
    const r = addWall(builder, M, { thickness: .02, baseboard: false, ...o });
    if (tag) { r.colliders.forEach(c => C.add({ ...c, tag })); map.walls.push(...r.segments); }
    return r;
  };

  // ------------------------------------------------------------------ Boden
  // Streifen entlang der Gasse (x0 … x1, z0 < z1); Höhe nach sgY(x), UVs in Metern.
  function strip(builder, mat, x0, x1, z0, z1, tile, lift = 0, yAt = sgY) {
    const xs = [...new Set([x0, x1, ...SG_BREAKS.filter(v => v > x0 && v < x1)])].sort((a, c) => a - c), pos = [], uv = [], idx = [];
    xs.forEach((x, i) => {
      for (const z of [z0, z1]) { pos.push(x, yAt(x) + lift, z); uv.push(x / tile, -z / tile); }
      if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); builder.add(mat, g);
  }
  // Waagrechte Fläche aus Polygon [[x, z], …] in Höhe y (oben sichtbar, down: unten sichtbar).
  function hpoly(builder, mat, pts, y, tile, down = false) {
    const tris = THREE.ShapeUtils.triangulateShape(pts.map(p => new THREE.Vector2(p[0], p[1])), []), pos = [], uv = [];
    for (const t of tris) {
      let [a, c, d] = t.map(i => pts[i]);
      const cross = (c[1] - a[1]) * (d[0] - a[0]) - (c[0] - a[0]) * (d[1] - a[1]);
      if ((cross > 0) === down) [c, d] = [d, c];
      for (const q of [a, c, d]) { pos.push(q[0], y, q[1]); uv.push(q[0] / tile, -q[1] / tile); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); builder.add(mat, g);
  }
  const XW = -40, XE = 19.85;
  // Schulseite: graue Betonsteine am Hochbau, Pflaster vor dem Future Lab, Asphaltgehweg, Bordstein.
  strip(ground, M.sgSidePavers, SG.tallWest, XE, SG.pavers, SG.tallFront, 1.2, .004);
  strip(ground, M.sgPavers, SG.flStep, SG.tallWest, -18.0, SG.workFront, 1.6, .004);
  strip(ground, M.sgPavers, SG.canopyEast, SG.flStep, -18.0, SG.flFront, 1.6, .004);
  strip(ground, M.vpAsphalt, SG.tallWest, XE, SG.curb, SG.pavers, 3, .002);
  strip(ground, M.vpAsphalt, SG.canopyEast, SG.tallWest, SG.curb, -18.0, 3, .002);
  strip(ground, M.vpAsphalt, XW, SG.canopyEast, SG.curb, SG.plazaEdge, 3, .002);
  strip(ground, M.vpAsphalt, XW, SG.westEnd, SG.plazaEdge, -18.35, 3, .002);    // hinter der Arkade: Gehweg bis zur Hecke
  strip(ground, M.vpStep, XW, XE, SG.road0, SG.curb, 1, .004);                // Bordstein (Granit)
  strip(ground, M.vpAsphalt, XW, XE, SG.road1, SG.road0, 3);
  // Gegenseite: Rinne, schmaler Gehweg, Kleinpflaster vor den Häusern, Parkfläche vor der Makerei.
  strip(ground, M.vpSett, XW, XE, SG.gutter, SG.road1, .8, .003);
  strip(ground, M.vpAsphalt, XW, SG.lot.x0, SG.farWalk, SG.gutter, 3, .002);
  strip(ground, M.vpSett, XW, -4.35, -25.9, SG.farWalk, .8, .003);
  strip(ground, M.sgDirt, -4.35, SG.lot.x0, -31, SG.farWalk, 2, .01);
  strip(ground, M.vpAsphalt, SG.lot.x0, XE, SG.lot.front, SG.gutter, 3, .002);
  strip(ground, M.vpAsphalt, XE, SG.lot.x1, SG.lot.front, -25.5, 3, .002);
  const floorTag = { tag: 'boden', surface: 'tile', id: 'schulgasse_boden' }, gz0 = -31, gz1 = SG.tallFront;
  C.addBox(14, gz0, XE, gz1, VP.low - .3, VP.low, floorTag);
  C.add({ x: 2, z: (gz0 + gz1) / 2, w: gz1 - gz0, d: 24, rot: PI / 2, bottom: -1.3, slope: { h0: -.62, h1: VP.low }, ...floorTag });
  C.addBox(XW, gz0, -10, gz1, -.92, -.62, floorTag);

  // Platz unter dem Vordach (Betonpflaster, 14 cm über dem Gehweg), Granitkante an der Gasse.
  const plaza = [[SG.canopyEast, SG.flFront], [SG.flWestX(-17.1) - .02, SG.flFront], [SG.flWestX(SG.steps[2]), SG.steps[2]], [SG.wall122, SG.steps[2]],
    [SG.wall122, SG.ramp.wall], [SG.ramp.x1, SG.ramp.wall], [SG.ramp.x1, SG.arcadeBack], [SG.westEnd, SG.arcadeBack], [SG.westEnd, SG.plazaEdge], [SG.canopyEast, SG.plazaEdge]];
  hpoly(ground, M.sgPavers, plaza, PL, 1.6);
  b.boxMinMax(M.vpStep, SG.westEnd, -.95, SG.plazaEdge - .02, SG.canopyEast + .02, PL + .002, SG.plazaEdge + .15);
  b.boxMinMax(M.vpStep, SG.canopyEast - .15, -.95, SG.plazaEdge, SG.canopyEast + .02, PL + .002, SG.flFront);
  b.boxMinMax(M.vpStep, SG.westEnd - .02, -.95, SG.plazaEdge, SG.westEnd + .15, PL + .002, SG.arcadeBack);
  for (const [x0, z0, x1, z1] of [[SG.westEnd, SG.plazaEdge, SG.ramp.x1, SG.arcadeBack], [SG.ramp.x1, SG.plazaEdge, SG.wall122, SG.ramp.wall],
    [SG.wall122, SG.plazaEdge, -13.88, SG.steps[2]], [-13.88, SG.plazaEdge, SG.canopyEast, SG.flFront]]) C.addBox(x0, z0, x1, z1, -.95, PL, { ...floorTag, id: 'schulgasse_platz' });

  // ------------------------------------------------------------------ Hochbau 129 (wie Nordseite 130)
  // Außenhaut mit drei Fensterreihen, Bossensockel mit roten Kellerfenstern (Fotos „sicht auf schule2“, 2).
  const axes129 = [10.85, 8.7, 6.55, 4.4, 2.25];
  {
    const ops = [], uN = x => SG.x130 - x;
    for (const xc of axes129) for (const row of [VP.row1, VP.row2, VP.row3]) ops.push({ u: uN(xc + VP.winW / 2), w: VP.winW, y: row[0] - Y0, h: row[1] });
    wall(facade, { start: [SG.x130, SG.tallFront], end: [SG.tallWest, SG.tallFront], y0: Y0, height: VP.roof - Y0, openings: ops, material: M.vpPlaster });
    rustica.boxMinMax(M.vpRustica, SG.tallWest, Y0, SG.tallFront - .08, SG.x130, VP.plinthTop, SG.tallFront);
    b.boxMinMax(M.vpFlashing, SG.tallWest, VP.plinthTop, SG.tallFront - .12, SG.x130, VP.plinthTop + .05, SG.tallFront);
    for (const xc of axes129) {
      detail.boxMinMax(M.vpFrame, xc - VP.winW / 2 - .04, VP.row1[0] - .052, SG.tallFront - .07, xc + VP.winW / 2 + .04, VP.row1[0] - .002, SG.tallFront - .001);
      for (const [row, drop] of [[VP.row1, .3], [VP.row2, .58], [VP.row3, .42]]) win(xc, row[0], SG.tallFront, PI, VP.winW, row[1], { drop, sill: row !== VP.row1 });
      cellar(xc);
    }
    cellar(13.8);
    // Dachrand wie 130, Stirnwand über dem niedrigen Flügel
    facade.boxMinMax(M.hofRoof, SG.tallWest - .3, VP.roof + .05, SG.tallFront - .3, 12.0, VP.roof + .18, -13.35);
    b.rod(M.hofCoping, [SG.tallWest - .3, VP.roof - .02, SG.tallFront - .3], [12.0, VP.roof - .02, SG.tallFront - .3], .075, 10);
    facade.boxMinMax(M.vpPlaster, SG.tallWest - .02, SG.eaves - .3, SG.tallFront + .02, SG.tallWest + .02, VP.roof + .05, -13.35);
  }
  // Kleines Fenster mit rotem Rahmen im Sockel (Kreismedienstelle), Nordseite.
  function cellar(xc, w = .62, h = .5) {
    const y = sgY(xc) + .85, z = SG.tallFront - .08;
    b.boxMinMax(M.vpDarkGlass, xc - w / 2 + .01, y + .01, z - .004, xc + w / 2 - .01, y + h - .01, z);
    for (const [x0, y0, x1, y1] of [[xc - w / 2, y, xc + w / 2, y + .05], [xc - w / 2, y + h - .05, xc + w / 2, y + h], [xc - w / 2, y, xc - w / 2 + .05, y + h], [xc + w / 2 - .05, y, xc + w / 2, y + h]])
      b.boxMinMax(M.vpRedFrame, x0, y0, z - .03, x1, y1, z);
    b.boxMinMax(M.vpFrame, xc - w / 2 - .03, y - .04, z - .06, xc + w / 2 + .03, y, z);
  }
  // Fenster in einer Hülle: lokale +z = außen, Öffnung w × h ab Brüstung. Leibung, Glas, Rahmen, Jalousie, Bank.
  function win(x, y, z, ry, w, h, { d = .2, glassMat = M.vpDarkGlass, drop = .5, cols = 2, transom = .72, reveal = true, sill = true, frame = M.vpFrame, blind = M.vpBlind } = {}) {
    const B = detail; B.push(x, y, z, ry);
    if (reveal) {   // 2 mm hinter den Schnitt- und Außenflächen der Haut (sonst Flackern)
      const rd = d - .002, rz = -d / 2 - .001;
      B.box(M.vpPlaster, w, .02, rd, 0, -.012, rz); B.box(M.vpPlaster, w, .02, rd, 0, h + .012, rz);
      for (const s of [-1, 1]) B.box(M.vpPlaster, .02, h, rd, s * (w / 2 + .012), h / 2, rz);
    }
    const fz = -d + .1;
    B.box(glassMat, w - .04, h - .04, .01, 0, h / 2, fz - .03);
    for (const yy of [.03, h - .03, transom ? h * transom : null]) if (yy !== null) B.box(frame, w, .06, .06, 0, yy, fz);
    for (let i = 0; i <= cols; i++) B.box(frame, .06, h, .06, -w / 2 + .03 + i * (w - .06) / cols, h / 2, fz);
    if (drop > 0) B.box(blind, w - .1, h * drop, .012, 0, h - h * drop / 2 - .02, fz - .045);
    if (sill) B.box(M.vpFrame, w + .08, .05, .1, 0, -.027, .03);
    B.pop();
  }

  // ------------------------------------------------------------------ Kreismedienstelle (Sockel 130 Nord)
  // Rotes Fenster unter der Achse 18,0, Bullauge-Briefkasten, rote Glastür, Schriftzug (Fotos „sicht auf schule“, „…2“).
  {
    const z = VP.north - .1, g = sgY(17);
    b.boxMinMax(M.vpDarkGlass, 17.4, g + 1.12, z - .004, 18.6, g + 2.27, z);
    for (const [x0, y0, x1, y1] of [[17.37, g + 1.09, 18.63, g + 1.16], [17.37, g + 2.24, 18.63, g + 2.3], [17.37, g + 1.09, 17.44, g + 2.3], [18.56, g + 1.09, 18.63, g + 2.3], [17.97, g + 1.09, 18.03, g + 2.3]])
      b.boxMinMax(M.vpRedFrame, x0, y0, z - .035, x1, y1, z);
    b.boxMinMax(M.vpFrame, 17.34, g + 1.05, z - .07, 18.66, g + 1.09, z);
    b.add(M.vpGalv, new THREE.CylinderGeometry(.28, .28, .04, 28), matrixFrom(16.75, g + 1.45, z - .02, PI / 2));
    b.add(M.vpCabinet, new THREE.CylinderGeometry(.2, .2, .02, 24), matrixFrom(16.75, g + 1.45, z - .045, PI / 2));
    b.boxMinMax(M.vpBollard, 16.62, g + 1.5, z - .06, 16.88, g + 1.53, z - .04);
    // Schriftzug mittig über dem Bullauge, endet vor der Türnische (Text ca. 0,9 m breit)
    sign(M.sgLettersKreis, 1.25, .156, 16.75, g + 1.98, z - .006, PI);
    // Tür in einer Nische (Putzleibung): rotes Türblatt mit schmalem Glasstreifen und Fensterchen, Band an der
    // Briefkastenseite, Griff und graues Seitenlicht mit Aushängen zur Gasse hin (Fotos „sicht auf schule“, „…2“).
    const dx0 = 15.12, sx = 15.44, dx1 = 16.16, top = g + 2.2, rz = z - .16;
    for (const [x0, y0, x1, y1] of [[dx0 - .14, g, dx0, top + .14], [dx1, g, dx1 + .14, top + .14], [dx0, top, dx1, top + .14]])
      rustica.boxMinMax(M.vpRustica, x0, y0, rz, x1, y1, z);
    detail.boxMinMax(M.vpRedFrame, sx + .05, g + .02, z - .03, dx1 - .05, top - .05, z - .01);        // Türblatt
    detail.boxMinMax(M.vpDarkGlass, dx1 - .2, g + .35, z - .036, dx1 - .14, g + 1.55, z - .03);      // Glasstreifen
    detail.boxMinMax(M.vpDarkGlass, dx1 - .34, g + 1.62, z - .036, dx1 - .1, g + 1.92, z - .03);     // Fensterchen
    detail.boxMinMax(M.vpDarkGlass, dx0 + .05, g + .05, z - .02, sx - .03, top - .05, z - .012);     // Seitenlicht
    detail.boxMinMax(M.paper, dx0 + .1, g + 1.3, z - .024, sx - .08, g + 1.6, z - .021);
    for (const [x0, y0, x1, y1] of [[dx0, g, dx0 + .05, top], [sx - .03, g, sx + .05, top], [dx1 - .05, g, dx1, top], [dx0, top - .05, dx1, top], [dx0, g, sx, g + .05]])
      detail.boxMinMax(M.vpGalv, x0, y0, z - .045, x1, y1, z);
    detail.boxMinMax(M.vpStainless, sx + .1, g + .98, z - .09, sx + .13, g + 1.12, z - .045);
    detail.rod(M.vpStainless, [sx + .115, g + 1.05, z - .09], [sx + .27, g + 1.05, z - .09], .012, 8);
    b.boxMinMax(M.vpStep, dx0 - .14, g - .1, z - .4, dx1 + .14, g + .04, rz);
    block('schulgasse_kreismedienstelle_nische', dx0 - .14, rz, dx0, z, g, top);
    block('schulgasse_kreismedienstelle_nische', dx1, rz, dx1 + .14, z, g, top);
    anchor('schulgasse_kreismedienstelle_tuer', 'door', 'Tür Kreismedienstelle (geschlossen)', (dx0 + dx1) / 2, g, z);
    // Weißer Briefkasten mit Klingeltableau rechts der Tür; danach das Kellerfenster der Achse 13,8 (cellar)
    b.boxMinMax(M.sgWhite, 14.5, g + .95, z - .1, 14.86, g + 1.42, z);
    b.boxMinMax(M.vpDarkGlass, 14.55, g + 1.32, z - .102, 14.81, g + 1.34, z - .1);
    b.boxMinMax(M.vpGalv, 14.54, g + 1.5, z - .03, 14.82, g + 1.68, z);
    // Fallrohr an der Ecke
    b.cylinder(M.vpFlashing, .05, .05, VP.roof - g, 19.68, (VP.roof + g) / 2, VP.north - .12, 10);
  }
  // Mast an der Ecke 130: Doppelleuchte, Fahrtrichtung geradeaus/rechts, Halteverbot, Straßenschild „Schulgasse“.
  {
    // Zwei Schwanenhalsarme oben am Mast, glockenförmige Leuchten (eine höher); Schilder hängen vor dem Mast
    // und zeigen nach Norden zur Kreuzung (Fotos „sicht auf schule“). Höhen geschätzt.
    const x = 20.25, z = -17.15, g = VP.low, T = g + 5.0;
    b.cylinder(M.vpBollard, .09, .12, .45, x, g + .22, z, 12); b.cylinder(M.vpBollard, .045, .06, T - g - .45, x, (T + g + .45) / 2, z, 12);
    for (const [s, h] of [[-1, T + .3], [1, T + .1]]) {
      const pts = [[0, T - .1], [.04, h - .1], [.14, h + .1], [.3, h + .18], [.44, h + .1], [.5, h - .04]];
      for (let i = 1; i < pts.length; i++) b.rod(M.vpBollard, [x + s * pts[i - 1][0], pts[i - 1][1], z], [x + s * pts[i][0], pts[i][1], z], .028, 8);
      b.cylinder(M.vpLampHead, .05, .2, .26, x + s * .5, h - .17, z, 16); b.cylinder(M.hofLamp, .18, .18, .02, x + s * .5, h - .3, z, 16);
    }
    for (const [mat, d, y] of [[M.sgSignArrow, .6, g + 3.65], [M.vpSignNoParking, .5, g + 3.05]]) {
      sign(mat, d, d, x, y, z - .075, PI, b);
      b.add(M.vpGalv, new THREE.CylinderGeometry(d / 2 - .01, d / 2 - .01, .012, 24), matrixFrom(x, y, z - .066, PI / 2));   // Rückseite
    }
    b.boxMinMax(M.vpGalv, x - .45, g + 2.59, z - .07, x + .45, g + 2.81, z - .058);
    sign(M.sgStreetSchulgasse, .9, .22, x, g + 2.7, z - .072, PI, b); sign(M.sgStreetSchulgasse, .9, .22, x, g + 2.7, z - .056, 0, b);
    b.boxMinMax(M.vpBollard, x - .11, g + 1.9, z - .13, x + .11, g + 2.4, z - .045);   // schwarzer Kasten am Mast
    block('schulgasse_eckmast', x - .1, z - .14, x + .1, z + .1, g, T, 'mast');
    anchor('schulgasse_eckmast', 'lamp', 'Mast mit Straßenleuchte an der Ecke 130', x, g, z);
  }

  // ------------------------------------------------------------------ Niedriger Flügel: Future Lab 125/126
  // Erdgeschoss Bänderputz als Außenhaut vor den Future-Lab-Wänden (deren Fenster bleiben sichtbar),
  // Obergeschoss weiß mit Fenstern, Traufe 6,95 (Panorama, „sicht auf schule3“).
  {
    const H = SG.soffit - Y0, uA = x => SG.flStep - x, ops = [];
    for (const x of [-9.5, -6.8, -4.1]) ops.push({ u: uA(x + 1.16), w: 2.32, y: -.32 - Y0, h: 2.4 });
    for (let x = -12.8; x < -2.9; x += 1.4) ops.push({ u: uA(x + .25), w: .5, y: 2.68 - Y0, h: .47 });
    wall(stripes, { start: [SG.flStep, SG.flFront], end: [SG.flWestX(-17.1) - .02, SG.flFront], y0: Y0, height: H, openings: ops, material: M.sgStripes });
    // 4 mm vor der Außenfläche der Future-Lab-Wand (futurelab.js), sonst deckungsgleich (Flackern an der Ecke)
    wall(stripes, { start: [SG.flStep + .004, SG.workFront], end: [SG.flStep + .004, SG.flFront], y0: Y0, height: H, material: M.sgStripes });
    wall(stripes, { start: [SG.tallWest, SG.workFront], end: [SG.flStep, SG.workFront], y0: Y0, height: H, material: M.sgStripes,
      openings: [{ u: SG.tallWest - (-1.165 + 1.08), w: 2.16, y: .7 - Y0, h: 2.22 }] });
    // Schräge Westwand an der Vorhalle: Tür und vier Oberlichter wie futurelab.js (dort u ab Süden).
    const L = Math.hypot(.55, 5.68), wo = [];
    for (const c of [.65, 2.0, 3.35, 4.7]) wo.push({ u: L - c - .25, w: .5, y: 2.65 - Y0, h: .5 });
    wo.push({ u: L - 2.28, w: .56, y: .08 - Y0, h: 2.15 });
    wall(stripes, { start: [SG.flWestX(-17.1) - .022, -17.1], end: [SG.flWestX(-11.42) - .022, -11.42], y0: Y0, height: H, openings: wo, material: M.sgStripes }, null);
    stripes.boxMinMax(M.sgStripes, SG.flWestX(-17.1) - .04, Y0, SG.flFront, SG.flWestX(-17.1) + .24, SG.soffit, -17.08);   // Ecke
    const ry = Math.atan2(-.9953, .0964), lz = -15.6;
    sign(M.vpSchoolLetters, 2.0, .25, SG.flWestX(lz) - .028, 2.12, lz, ry);
    // Obergeschoss über dem Future Lab
    const U = SG.eaves - SG.soffit, uo = [];
    for (const x of [-7.6, -5.4, -3.2]) uo.push({ u: uA(x + .6), w: 1.2, y: 4.3 - SG.soffit, h: 1.5 });
    wall(facade, { start: [SG.flStep, SG.flFront], end: [SG.bay.sideEnd[0], SG.flFront], y0: SG.soffit, height: U, openings: uo, material: M.vpPlaster }, null);
    wall(facade, { start: [SG.flStep, SG.workFront], end: [SG.flStep, SG.flFront], y0: SG.soffit, height: U, material: M.vpPlaster }, null);
    wall(facade, { start: [SG.tallWest, SG.workFront], end: [SG.flStep, SG.workFront], y0: SG.soffit, height: U, material: M.vpPlaster,
      openings: [{ u: SG.tallWest - (-.9 + .6), w: 1.2, y: 4.3 - SG.soffit, h: 1.5 }] }, null);
    for (const x of [-7.6, -5.4, -3.2]) win(x, 4.3, SG.flFront, PI, 1.2, 1.5, { drop: .35 });
    win(-.9, 4.3, SG.workFront, PI, 1.2, 1.5, { drop: .6 });
    facade.boxMinMax(M.vpPlaster, SG.flWestX(-17.1), SG.soffit - .06, SG.flFront - .05, SG.flStep, SG.soffit + .1, SG.flFront);   // Gesims
  }

  // ------------------------------------------------------------------ Vorhalle, Stufen, Rampe
  // Boden der Vorhalle auf Höhe der Halle (0), drei Stufen à 16 cm zum Platz (Panorama, eingang2–4).
  const fx = z => SG.flWestX(z) - .02;
  hpoly(ground, M.sgPavers, [[SG.wall122, SG.hallFront], [fx(SG.hallFront), SG.hallFront], [fx(SG.steps[0]), SG.steps[0]], [SG.wall122, SG.steps[0]]], P + .003, 1.6);
  C.addBox(SG.wall122, SG.steps[0], -13.3, SG.hallFront, P - .5, P, { ...floorTag, id: 'schulgasse_vorhalle' });
  [[SG.steps[0], SG.steps[1], P - .16], [SG.steps[1], SG.steps[2], P - .32]].forEach(([za, zb, top]) => {
    b.boxMinMax(M.vpStep, SG.wall122, PL - .1, zb, fx(zb), top, za);
    b.boxMinMax(M.vpStep, SG.wall122, top - .006, zb, fx(zb), top + .002, zb + .03);   // Kantenbetonung
    C.addBox(SG.wall122, zb, fx(zb), za, PL - .1, top, { tag: 'treppe', surface: 'tile', id: 'schulgasse_stufen' });
  });
  b.boxMinMax(M.vpStep, SG.wall122, P - .16 - .006, SG.steps[0], fx(SG.steps[0]), P + .006, SG.steps[0] + .03);
  // Schwelle in der Wandstärke unter den roten Türen (Vorhalle bis Hallenboden, sonst Lücke zum Himmel)
  b.boxMinMax(M.vpStep, SG.wall122, P - .12, SG.hallFront, fx(SG.hallFront), P + .002, -11.215);
  C.addBox(SG.wall122, SG.hallFront - .01, -13.3, -11.2, P - .5, P, { ...floorTag, id: 'schulgasse_schwelle' });
  // Stirn unter dem oberen Rampenende neben der ersten Stufe schließen (Durchblick unter die Rampe)
  b.boxMinMax(M.vpStep, SG.ramp.x0 - .06, PL - .1, SG.ramp.z1, SG.ramp.x0 - .002, P + .001, SG.steps[0] + .01);
  // Rampe an der Fassade 122/121 nach Westen bis zum Platz, Betonbrüstung mit Stahlgeländer.
  {
    const R = SG.ramp, len = R.x0 - R.x1;
    const g = new THREE.BufferGeometry(), pts = [R.x0, P + .003, R.z0, R.x0, P + .003, R.z1, R.x1, PL + .003, R.z0, R.x1, PL + .003, R.z1];
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute([R.x0 / 1.6, 0, R.x0 / 1.6, .94, R.x1 / 1.6, 0, R.x1 / 1.6, .94], 2));
    g.setIndex([0, 1, 2, 1, 3, 2]); g.computeVertexNormals(); ground.add(M.sgPavers, g);
    C.add({ x: (R.x0 + R.x1) / 2, z: (R.z0 + R.z1) / 2, w: R.z0 - R.z1, d: len, rot: PI / 2, bottom: PL - .4, slope: { h0: PL, h1: P }, tag: 'boden', surface: 'tile', id: 'schulgasse_rampe' });
    // Brüstung: oben waagrecht (ca. 0,9 m über dem Rampenanfang), am Fuß auf Platzniveau
    const top = P + .5;
    b.boxMinMax(M.vpConcrete, R.x1, PL - .1, R.wall, R.x0, top, R.z1);
    b.boxMinMax(M.vpConcrete, R.x0 - .01, PL - .1, SG.steps[2], R.x0 + .3, top, R.z1);   // Wange an der Treppe
    C.addBox(R.x1, R.wall, R.x0 + .3, R.z1, PL - .1, top + .45, { tag: 'wand', id: 'schulgasse_rampe_bruestung' });
    for (let x = R.x0 - .2; x > R.x1; x -= 1.55) b.rod(M.vpSteel, [x, top, (R.z1 + R.wall) / 2], [x, top + .45, (R.z1 + R.wall) / 2], .022, 8);
    b.rod(M.vpSteel, [R.x0 - .05, top + .45, (R.z1 + R.wall) / 2], [R.x1 + .1, top + .45, (R.z1 + R.wall) / 2], .025, 8);
    // Handlauf an der Wand, der Rampe folgend
    b.rod(M.vpSteel, [R.x0, P + .9, R.z0 - .06], [R.x1, PL + .9, R.z0 - .06], .02, 8);
    anchor('schulgasse_rampe', 'exterior', 'Rampe am Eingang', (R.x0 + R.x1) / 2, PL, (R.z0 + R.z1) / 2);
  }

  // ------------------------------------------------------------------ Wände der Vorhalle und hinter der Arkade
  {
    const H = SG.soffit - Y0;
    // Ostwand 122: großes Fenster, zwei Briefkästen (eingang2, eingang4)
    wall(stripes, { start: [SG.wall122, SG.hallFront], end: [SG.wall122, SG.arcadeBack], y0: Y0, height: H, thickness: .25, material: M.sgStripes,
      openings: [{ u: 1.53, w: 1.65, y: .9 - Y0, h: 1.95 }] });
    win(SG.wall122, .9, -13.775, PI / 2, 1.65, 1.95, { d: .2, reveal: false, drop: 0, transom: .2, glassMat: M.vpDarkGlass, frame: M.vpGalv });
    for (const [z0, z1] of [[-11.95, -12.33], [-12.38, -12.76]]) {
      b.boxMinMax(M.vpFrame, SG.wall122, 1.05, z1, SG.wall122 + .13, 1.42, z0);
      b.boxMinMax(M.vpFlashing, SG.wall122 + .13, 1.3, z1 + .06, SG.wall122 + .135, 1.33, z0 - .06);
    }
    // Rückwand der Arkade: zwei Fenster über der Rampe, graue Stahltür (Treppenhaus), Fenster 120
    const uB = x => SG.wall122 - x, ops = [];
    for (const x of [-20.0, -21.75]) ops.push({ u: uB(x + .575), w: 1.15, y: 1.0 - Y0, h: 1.9 });
    ops.push({ u: uB(-25.6 + .5), w: 1.0, y: PL - Y0, h: 2.2 });
    for (const x of [-27.6, -29.4]) ops.push({ u: uB(x + .65), w: 1.3, y: 0 - Y0, h: 2.6 });
    wall(stripes, { start: [SG.wall122, SG.arcadeBack], end: [SG.westEnd, SG.arcadeBack], y0: Y0, height: H, thickness: .25, material: M.sgStripes, openings: ops });
    for (const x of [-20.0, -21.75]) win(x, 1.0, SG.arcadeBack, PI, 1.15, 1.9, { reveal: false, drop: .45, cols: 1, transom: .78, frame: M.vpGalv });
    for (const x of [-27.6, -29.4]) win(x, 0, SG.arcadeBack, PI, 1.3, 2.6, { reveal: false, drop: .3, cols: 2, transom: .78, frame: M.vpGalv });
    // Stahltür (geschlossen)
    detail.boxMinMax(M.sgSteelDoor, -26.08, PL, SG.arcadeBack + .08, -25.12, PL + 2.15, SG.arcadeBack + .12);
    detail.boxMinMax(M.vpStainless, -25.32, PL + 1.0, SG.arcadeBack + .02, -25.18, PL + 1.04, SG.arcadeBack + .08);
    for (const [x0, x1, y0, y1] of [[-26.12, -26.08, PL, PL + 2.2], [-25.12, -25.08, PL, PL + 2.2], [-26.12, -25.08, PL + 2.15, PL + 2.2]])
      detail.boxMinMax(M.vpGalv, x0, y0, SG.arcadeBack + .03, x1, y1, SG.arcadeBack + .12);
    anchor('schulgasse_treppenhaus_tuer', 'door', 'Stahltür Treppenhaus (geschlossen)', -25.6, PL, SG.arcadeBack);
    // Stirnwand im Westen (Erdgeschoss hinter der Arkade, Obergeschoss über ganzer Tiefe)
    wall(stripes, { start: [SG.westEnd, SG.arcadeBack], end: [SG.westEnd, -11.0], y0: Y0, height: H, thickness: .25, material: M.sgStripes });
  }

  // ------------------------------------------------------------------ Stützen, Untersicht, Obergeschoss
  for (const [x, kind] of SG.cols) {
    const z = SG.colZ, top = kind === 'big' ? 2.0 : kind === 'arc' ? 1.55 : .4, s = kind === 'big' ? .21 : kind === 'arc' ? .17 : .15;
    b.boxMinMax(M.vpConcrete, x - s, PL, z - s, x + s, top, z + s);
    b.cylinder(M.vpSteel, .055, .055, SG.soffit - top, x, (SG.soffit + top) / 2, z, 12);
    b.boxMinMax(M.vpSteel, x - .1, SG.soffit - .02, z - .1, x + .1, SG.soffit, z + .1);
    block('schulgasse_stuetze', x - s, z - s, x + s, z + s, PL, SG.soffit);
  }
  anchor('schulgasse_eingang', 'entrance', 'Eingang Kaufmännische Schule', -15.8, P, -13.5);
  // Untersicht: Deckenplatten über Vorhalle, Platz und Arkade, Einbauleuchten.
  const roofPoly = [[SG.canopyEast, SG.flFront], [SG.canopyEast, SG.upperFront], [SG.westEnd, SG.upperFront], [SG.westEnd, SG.arcadeBack],
    [SG.wall122, SG.arcadeBack], [SG.wall122, SG.hallFront], [fx(SG.hallFront), SG.hallFront], [fx(-17.1), -17.1], [fx(-17.1), SG.flFront]];
  hpoly(ceiling, M.sgCeiling, roofPoly, SG.soffit, 5, true);
  hpoly(facade, M.hofRoof, [[SG.canopyEast, SG.flFront], [SG.canopyEast, SG.upperFront], [SG.bay.x0, SG.upperFront], SG.bay.sideEnd], SG.slabTop, 2);
  // Stirn des Vordachs: 3 cm unter die Untersicht, 2 cm über die Dachfläche (keine deckungsgleichen Flächen)
  facade.boxMinMax(M.vpPlaster, SG.bay.x0, SG.soffit - .03, SG.upperFront, SG.canopyEast, SG.slabTop + .02, SG.upperFront + .25);
  facade.boxMinMax(M.vpPlaster, SG.canopyEast, SG.soffit - .03, SG.upperFront, SG.canopyEast + .25, SG.slabTop + .02, SG.flFront);
  for (const [x, z] of [[-16.0, -12.6], [-16.0, -14.7], [-11.2, -18.1], [-14.6, -17.6], [-17.2, -17.6], ...SG.upperWin.map(x => [x, -16.9])])
    detail.add(M.hofLamp, new THREE.CylinderGeometry(.11, .11, .015, 16), matrixFrom(x, SG.soffit - .006, z));
  // Obergeschoss: Front über den Stützen, Rundbau mit Fensterband und bordeauxrotem Band (Panorama).
  {
    const U = SG.eaves - SG.soffit, uU = x => SG.bay.x0 - x, ops = [{ u: uU(-12.75), w: 5.7, y: 4.1 - SG.soffit, h: 1.65 }];
    const upperXs = SG.upperWin;
    for (const x of upperXs) ops.push({ u: uU(x + .65), w: 1.3, y: 4.3 - SG.soffit, h: 1.6 });
    // Unterkante 3 cm unter der Untersicht (Sturz), sonst deckungsgleich mit den Deckenplatten
    const D = .03; for (const o of ops) o.y += D;
    wall(facade, { start: [SG.bay.x0, SG.upperFront], end: [SG.westEnd, SG.upperFront], y0: SG.soffit - D, height: U + D, thickness: .25, openings: ops, material: M.vpPlaster }, null);
    for (const x of upperXs) win(x, 4.3, SG.upperFront, PI, 1.3, 1.6, { reveal: false, drop: .5 });
    detail.boxMinMax(M.sgBordeaux, SG.bay.x1, SG.slabTop + .03, SG.upperFront - .025, SG.bay.x0 + .02, SG.slabTop + .3, SG.upperFront);
    // Fensterband (durchsichtig) mit Raum dahinter: Boden, Decke, Wände
    const x0 = -18.45, x1 = -12.75, y0 = 4.1, y1 = 5.75, z = SG.upperFront + .12;
    glass.boxMinMax(M.sgGlass, x0, y0, z - .005, x1, y1, z + .005);
    for (let i = 0; i <= 5; i++) detail.boxMinMax(M.vpFrame, x0 + i * (x1 - x0) / 5 - .03, y0, z - .04, x0 + i * (x1 - x0) / 5 + .03, y1, z + .03);
    for (const y of [y0, y1 - .04, y0 + 1.2]) detail.boxMinMax(M.vpFrame, x0 + .003, y, z - .04, x1 - .003, y + .05, z + .03);
    const zi = -15.2;
    facade.boxMinMax(M.vpStep, x0, SG.slabTop - .01, SG.upperFront + .25, x1, SG.slabTop, zi);
    facade.boxMinMax(M.sgInterior, x0, SG.eaves - .5, SG.upperFront + .25, x1, SG.eaves - .45, zi);
    facade.boxMinMax(M.sgInterior, x0, SG.slabTop, zi, x1, SG.eaves - .45, zi + .05);
    facade.boxMinMax(M.sgInterior, x0 - .05, SG.slabTop, SG.upperFront + .25, x0, SG.eaves - .45, zi);
    facade.boxMinMax(M.sgInterior, x1, SG.slabTop, SG.upperFront + .25, x1 + .05, SG.eaves - .45, zi);
    for (const x of [-17.3, -15.6, -13.9]) detail.boxMinMax(M.hofLamp, x - .6, SG.eaves - .52, -17.6, x + .6, SG.eaves - .5, -17.3);
    // Schräge Seite des Rundbaus mit zwei linsenförmigen Fenstern und grauem Schriftzug („sicht auf schule3“)
    const [ex, ez] = SG.bay.sideEnd, side = wall(facade, { start: [ex, ez], end: [SG.bay.x0, SG.upperFront], y0: SG.soffit - .03, height: U + .03, thickness: .25, material: M.vpPlaster }, null);
    const sry = Math.atan2(side.normal[0], side.normal[1]), at = u => [ex + side.dir[0] * u + side.normal[0] * .012, ez + side.dir[1] * u + side.normal[1] * .012];
    for (const u of [1.25, 2.6]) {
      const [lx, lz] = at(u);
      detail.add(M.vpDarkGlass, new THREE.CircleGeometry(.42, 24).scale(1, .5, 1), matrixFrom(lx, 5.15, lz, 0, sry));
      detail.add(M.vpFrame, new THREE.RingGeometry(.42, .48, 24).scale(1, .5, 1), matrixFrom(lx + side.normal[0] * .004, 5.15, lz + side.normal[1] * .004, 0, sry));
    }
    { const [lx, lz] = at(1.95); sign(M.vpSchoolLettersGrey, 2.4, .3, lx, 4.2, lz, sry); }
    // Stirnwand West und Wandleuchten
    facade.boxMinMax(M.vpPlaster, SG.westEnd - .25, SG.soffit, SG.upperFront, SG.westEnd, SG.eaves, -11.0);
    for (const x of [-22.0, -27.8, -9.6]) {
      const z = x > -10 ? SG.flFront : SG.upperFront, s = -1, y = 4.95;
      detail.rod(M.vpBollard, [x, y + .3, z], [x, y + .3, z + s * .42], .018, 6);
      detail.rod(M.vpBollard, [x, y + .3, z + s * .42], [x, y + .18, z + s * .46], .014, 6);
      detail.cylinder(M.vpBollard, .04, .17, .2, x, y + .08, z + s * .46, 14); detail.cylinder(M.hofLamp, .15, .15, .02, x, y - .03, z + s * .46, 14);
    }
  }
  // Dach: Traufe folgt der Fassade (Rundbau, Future-Lab-Flügel), steigt nach Süden an; Rinne an der Traufe.
  {
    const ov = .5, eavesLine = [[SG.westEnd - ov, SG.upperFront - ov], [SG.bay.x0 + .2, SG.upperFront - ov], [SG.bay.sideEnd[0] + .2, SG.flFront - ov],
      [SG.flStep + ov, SG.flFront - ov], [SG.flStep + ov, SG.workFront - ov], [SG.tallWest, SG.workFront - ov]];
    const pos = [], idx = [];
    eavesLine.forEach(([x, z], i) => {
      pos.push(x, SG.eaves, z, x, SG.ridge, SG.ridgeZ);
      if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(pos.flatMap((v, i) => i % 3 === 1 ? [] : [v / 2]), 2)); g.setIndex(idx); g.computeVertexNormals();
    facade.add(M.sgRoofMetal, g);
    for (let i = 1; i < eavesLine.length; i++) b.rod(M.vpFlashing, [eavesLine[i - 1][0], SG.eaves - .05, eavesLine[i - 1][1]], [eavesLine[i][0], SG.eaves - .05, eavesLine[i][1]], .07, 8);
    // Untersicht des Dachüberstands
    hpoly(facade, M.vpPlaster, [...eavesLine, [SG.tallWest, SG.workFront], [SG.flStep, SG.workFront], [SG.flStep, SG.flFront], SG.bay.sideEnd, [SG.bay.x0, SG.upperFront], [SG.westEnd, SG.upperFront]], SG.eaves - .02, 2, true);
    for (const [x, z] of [[SG.bay.sideEnd[0] + .1, SG.flFront - .1], [-2.6, SG.flFront - .1]]) b.cylinder(M.vpFlashing, .045, .045, SG.eaves - sgY(x) - .1, x, (SG.eaves + sgY(x)) / 2, z, 10);
  }

  // ------------------------------------------------------------------ Westende: Tor, Hecke, Schilder
  // „sicht auf eingangaußenbereich“: Betonpfosten mit Gittertor und dreieckigem Stahlrahmen, Feuerdornhecke,
  // Mülleimer mit orangem Deckel, Mast mit „Zitronengässle“ und Sammelplatz-Schild.
  {
    const z = -18.25, g = sgY(-32);
    for (const x of [-30.95, -32.45]) { b.boxMinMax(M.vpConcrete, x - .18, g, z - .18, x + .18, g + 2.25, z + .18); }
    for (let x = -31.13 - .1; x > -32.27; x -= .12) detail.rod(M.vpGalv, [x, g + .1, z], [x, g + 1.95, z], .012, 5);
    for (const y of [.15, 1.95]) detail.rod(M.vpGalv, [-31.13, g + y, z], [-32.27, g + y, z], .02, 6);
    for (const [a, c] of [[[-30.95, g + 2.25, z], [-31.7, g + 3.55, z]], [[-32.45, g + 2.25, z], [-31.7, g + 3.55, z]], [[-30.95, g + 2.25, z], [-32.45, g + 2.25, z]]]) detail.bar(M.vpSteel, a, c, .06, .08);
    anchor('schulgasse_tor_west', 'gate', 'Tor am Westende der Arkade (geschlossen)', -31.7, g, z);
    for (let x = -32.9; x > -39; x -= .62) plants.shrub(x, -18.0, { y: g, h: 1.35, w: 1.0, color: 0x4f6a35, n: 60 });
    b.boxMinMax(M.hofHedge, -39.2, g, -18.5, -32.7, g + 1.15, -17.5);
    const sx = -32.75, sz = -18.95;
    b.rod(M.vpGalv, [sx, g, sz], [sx, g + 3.1, sz], .035, 8);
    sign(M.sgStreetZitronen, 1.05, .22, sx, g + 2.9, sz - .04, 0, b); sign(M.sgStreetZitronen, 1.05, .22, sx, g + 2.9, sz + .04, PI, b);
    sign(M.sgSignAssembly, .38, .29, sx + .04, g + 2.45, sz, PI / 2, b);
    b.cylinder(M.vpGalv, .22, .2, .7, sx + .1, g + .75, sz + .32, 14); b.cylinder(M.sgBinLid, .23, .23, .1, sx + .1, g + 1.15, sz + .32, 14);
    anchor('schulgasse_zitronengaessle', 'sign', 'Straßenschild Zitronengässle', sx, g, sz);
  }

  // ------------------------------------------------------------------ Gegenüber, Kulisse, Grenzen
  buildSchulgasseGegenueber({ root, houses, b, detail, ground, C, M, plants, block, anchor, sign, map });
  // Ende der Gasse: gebaute Fernbebauung statt Fotokulisse (fernbebauung.js)
  buildFerneWest({ root, M, plants });
  const barrier = (id, x0, z0, x1, z1) => { const len = Math.hypot(x1 - x0, z1 - z0); C.add({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: len, d: .2, rot: -Math.atan2(z1 - z0, x1 - x0), bottom: -2, top: 8, tag: 'grenze', id }); };
  const Bd = SG.bound;
  barrier('schulgasse_grenze_west', Bd.west, SG.arcadeBack, Bd.west, Bd.north);
  barrier('schulgasse_grenze_nord', Bd.west, Bd.north, SG.lot.x0, Bd.north);
  barrier('schulgasse_grenze_parkplatz', SG.lot.x0, Bd.north, SG.lot.x0, SG.lot.front + .2);
  barrier('schulgasse_grenze_makerei', 14.0, SG.lot.front + .2, 14.0, -25.2);
  barrier('schulgasse_grenze_makerei', 14.0, -25.2, SG.lot.x1, -25.2);
  barrier('schulgasse_grenze_kreuzung', SG.lot.x1, -25.2, SG.lot.x1, -22.6);
  barrier('schulgasse_grenze_kreuzung', SG.lot.x1, -22.6, 27.4, -22.6);
  barrier('schulgasse_grenze_kreuzung', 27.4, -22.6, 27.4, -19.5);

  // ------------------------------------------------------------------ Licht, Sichtbarkeit, Abschluss
  const circuit = lighting.addCircuit('licht_schulgasse', { lights: [], panels: [], regions: SCHULGASSE_REGIONS, on: false }); circuit.roomId = 'schulgasse';
  const portal = (id, room, center, normal, width, height, power = .12) => lighting.portals.add({ id, rooms: [room, 'licht_schulgasse'], center, normal, width, height, transmission: .5, power, range: 3 });
  portal('schulgasse_eingang', 'licht_flur1', [-15.8, 3.2, -11.32], [0, -1], 5.6, 6.4, .15);
  portal('schulgasse_futurelab_nord', 'licht_futurelab', [-8.25, 1.4, -17.22], [0, -1], 11.2, 3.6);
  portal('schulgasse_futurelab_west', 'licht_futurelab', [-13.6, 1.6, -14.26], [-1, 0], 5.8, 3.2);
  portal('schulgasse_werkstatt', 'licht_futurelab', [-1.17, 1.8, -16.42], [0, -1], 2.3, 2.3);
  portal('schulgasse_130_nordfenster', 'licht_130', [15.9, 3.5, -16.27], [0, -1], 5.5, 2.1);
  // Von der Kreuzung aus: Fenster 130/131 und Außentür Flur 2 an der Bucksgässle (wie beim Vorplatz)
  portal('schulgasse_130_fenster', 'licht_130', [19.62, 3.5, -11.425], [1, 0], 7.75, 2.1);
  portal('schulgasse_131_fenster', 'licht_131', [19.62, 3.5, 1.25], [1, 0], 7.75, 2.1);
  portal('schulgasse_flur2_ausgang', 'licht_flur2', [VP.door.x, 1.9, (VP.door.z0 + VP.door.z1) / 2], [1, 0], VP.door.z1 - VP.door.z0, 4.7, .15);

  map.areas.push({ poly: [[XW + 8, SG.curb], [XE, SG.curb], [XE, SG.road1 - .3], [XW + 8, SG.road1 - .3]], fill: 'rgba(110,112,116,.25)' });
  map.areas.push({ poly: [[XW + 8, SG.curb], [XE, SG.curb], [XE, SG.tallFront], [SG.tallWest, SG.tallFront], [SG.tallWest, SG.workFront], [SG.flStep, SG.workFront], [SG.flStep, SG.flFront], [SG.canopyEast, SG.flFront], [SG.canopyEast, SG.plazaEdge], [XW + 8, SG.plazaEdge]], fill: 'rgba(157,153,126,.22)' });
  map.areas.push({ poly: plaza, fill: 'rgba(157,153,126,.3)' });
  map.areas.push({ poly: [[SG.wall122, SG.hallFront], [fx(SG.hallFront), SG.hallFront], [fx(SG.steps[0]), SG.steps[0]], [SG.wall122, SG.steps[0]]], fill: 'rgba(157,153,126,.3)' });
  map.labels.push({ text: 'Schulgasse', x: -2, z: -21.6 }, { text: 'Eingang', x: -16.0, z: -13.6 });

  const plantStats = plants.build();
  root.add(ground.build({ name: 'schulgasse_boden', castShadow: false }), b.build({ name: 'schulgasse_ausstattung' }),
    detail.build({ name: 'schulgasse_feindetails', castShadow: false }), glass.build({ name: 'schulgasse_glas', castShadow: false }),
    ceiling.build({ name: 'schulgasse_untersicht', castShadow: false }));
  const groups = [facade.build({ name: 'schulgasse_fassaden' }), stripes.build({ name: 'schulgasse_baenderputz' }), rustica.build({ name: 'schulgasse_bossenputz' }), houses.build({ name: 'schulgasse_haeuser' })];
  groups[0].traverse(o => { if (o.isMesh && o.material === M.vpPlaster) metricBoxUV(o.geometry, .65); });
  groups[1].traverse(o => { if (o.isMesh) metricBoxUV(o.geometry, .66); });
  groups[2].traverse(o => { if (o.isMesh) metricBoxUV(o.geometry, .72); });
  groups[3].traverse(o => { if (o.isMesh && ![M.vpRoofTile, M.hofRoof].includes(o.material)) metricBoxUV(o.geometry, o.material === M.sgDoorWood || o.material === M.sgWoodSiding ? 2 : .9); });
  root.add(...groups);
  root.userData.vegetation = plantStats;
  anchor('schulgasse', 'exterior', 'Schulgasse', 0, sgY(0), -21.5);
  return { id: 'schulgasse', name: 'Schulgasse', root, regions: SCHULGASSE_REGIONS,
    bounds: { minX: -40, maxX: 37.5, minZ: -40, maxZ: -11, minY: -3, maxY: 14 },
    areaName: p => {
      if (!inSchulgasse(p)) return null;
      if (p.z > SG.steps[0] && p.x > SG.wall122 && p.x < -13) return 'Eingang Kaufmännische Schule';
      if (p.z > SG.upperFront && p.x < SG.canopyEast && p.x > SG.westEnd) return 'Außenbereich · Arkade am Eingang';
      if (p.x > XE) return 'Außenbereich · Kreuzung Bucksgässle';
      return 'Außenbereich · Schulgasse';
    } };
}

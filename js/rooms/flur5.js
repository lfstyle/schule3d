// Flur 5 (Aufenthaltsbereich über Flur 3), Treppenauge mit Glasoberlicht und oberer Gang 314–319.
// 30 einzeln geprüfte Fotos + Nutzerskizze; Schätzmaße und Zuordnung: verification/FLUR5-ABGLEICH.md.
// Der Lauf Flur 4 → Flur 5 bleibt in flur3.js (dort war er bisher nur Untersicht).
import * as THREE from 'three';
import { PartBuilder, matrixFrom, metricBoxUV } from '../geometry.js';
import { addWall, addWindow, Door, createDoubleDoor, addHighTable, addHighSeat, addCeilingLight,
  addSwitchPlate, addTrashBin, createWallClock } from '../objects.js';
import { addPottedTree, addPentSkylight, addParapet, addGalleryRailing, addHallPcDesk, addShellChair,
  addSnakePlant, addRoundWallLamp, addSanitizer, addHoseCabinet } from '../flur5-objects.js';
import { FLUR3 } from '../flur3-layout.js';
import { FLUR5, OBEN, FLUR5_WINDOWS } from '../flur5-layout.js';

// Gemeinsame Bauhelfer beider Bereiche (gleiche Wände, Decken, Türen, Schilder).
function kit(ctx, root, Y, roofY) {
  const { collision: C, materials: M, registerObject, interactions, lighting, audio, map } = ctx;
  const walls = new PartBuilder(), b = new PartBuilder(), fixtures = new PartBuilder();
  const plane = (mat, w, h, x, y, z, ry = 0) => b.add(mat, new THREE.PlaneGeometry(w, h), matrixFrom(x, y, z, 0, ry));
  const anchor = (id, type, name, x, y, z, obj = null) => {
    const o = obj ?? new THREE.Object3D(); if (!obj) { o.position.set(x, y, z); root.add(o); }
    registerObject(id, type, name, o); return o;
  };
  function surface(mat, x0, z0, x1, z1, y, down = false, tile = 1) {
    const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0); geo.rotateX(down ? Math.PI / 2 : -Math.PI / 2);
    geo.translate((x0 + x1) / 2, y, (z0 + z1) / 2); metricBoxUV(geo, tile);
    const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; root.add(m); return m;
  }
  function floor(x0, z0, x1, z1, y = Y) { surface(M.flur3Floor, x0, z0, x1, z1, y, false, 2); C.addBox(x0, z0, x1, z1, y - .12, y, { tag: 'boden', surface: 'lino' }); }
  // Rasterdecke mit roten Akustikplatten (Fotos 6, 9, 11, oben 4); red(i, j) wählt die roten Felder.
  function ceiling(x0, z0, x1, z1, y, red) {
    surface(M.ceilingPlain, x0, z0, x1, z1, y, true, .6); surface(M.foyerRoof, x0, z0, x1, z1, y + .12).castShadow = true;
    C.addBox(x0, z0, x1, z1, y, y + .13, { tag: 'decke' });
    for (let x = x0 + .625; x < x1 - .05; x += .625) b.box(M.aluminium, .012, .014, z1 - z0, x, y - .009, (z0 + z1) / 2);
    for (let z = z0 + .625; z < z1 - .05; z += .625) b.box(M.aluminium, x1 - x0, .014, .012, (x0 + x1) / 2, y - .009, z);
    for (let i = 0; i < Math.floor((x1 - x0) / .625); i++) for (let j = 0; j < Math.floor((z1 - z0) / .625); j++)
      if (red(i, j)) b.box(M.flur4Red, .60, .008, .60, x0 + (i + .5) * .625, y - .022, z0 + (j + .5) * .625);
  }
  // Wand nach UEBERGABE-Konvention (Raum links von start → end); grauer Sockelstreifen 0,92 m.
  function wall(a, d, openings = [], { y0 = Y, top = roofY, thickness = .22, dado = true, onMap = true, base = null } = {}) {
    const r = addWall(walls, { ...M, baseboard: M.flur3Skirt }, { start: a, end: d, openings, y0, height: top - y0, thickness, material: M.flur3Wall, baseboard: y0 === Y });
    r.colliders.forEach(c => C.add({ ...c, tag: 'wand' })); if (onMap) map.walls.push(...r.segments);
    if (dado) {
      // base(u): Bodenhöhe entlang der Wand (Treppen); Öffnungen bis unter die Sockelhöhe bleiben frei.
      const pts = [], n = 24, low = u => (base ? base(u) : y0) - y0;
      b.push(a[0], y0, a[1], r.rot);
      let u = 0;
      for (const o of [...openings.filter(o => o.y < .9).sort((p, q) => p.u - q.u), { u: r.length, w: 0 }]) {
        // 2 mm hinter den Enden der Sockelleiste, sonst liegen deren Stirnflächen in einer Ebene (Flackern).
        const u0 = u + .002, u1 = o.u - .002;
        if (u1 > u0 + .01) {
          if (!base) b.box(M.flur2Dado, u1 - u0, .92, .012, (u0 + u1) / 2, .46, .008);
          else {
            pts.length = 0;
            for (let k = 0; k <= n; k++) { const t = u0 + (u1 - u0) * k / n; pts.push(new THREE.Vector2(t, low(t))); }
            for (let k = n; k >= 0; k--) { const t = u0 + (u1 - u0) * k / n; pts.push(new THREE.Vector2(t, low(t) + .92)); }
            const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: .012, bevelEnabled: false }); g.translate(0, 0, .002);
            b.add(M.flur2Dado, g);
          }
        }
        u = o.u + o.w;
      }
      b.pop();
    }
    return r;
  }
  function sign(mat, x, z, ry = 0, w = .22, h = .19, y = 1.6, yBase = Y) {
    b.push(x, yBase + y, z, ry); plane(mat, w, h, 0, 0, .025);
    for (const xx of [-w / 2 + .016, w / 2 - .016]) for (const yy of [-h / 2 + .016, h / 2 - .016]) b.cylinder(M.chrome, .007, .007, .012, xx, yy, .03, 8, Math.PI / 2);
    b.pop();
  }
  // Geschlossene Holztür ohne Raum dahinter; Gruppe auf der Wandlinie, +z (ry) zeigt in den Gang.
  function door(id, name, x, z, ry, { frame = M.flur3Frame, knob = false } = {}) {
    const d = new Door({ ...M, glass: M.flur4Milk }, { id, width: 1.02, openingWidth: 1.14, openingHeight: 2.25, leafHeight: 2.18, transom: false, knob,
      frontMaterial: M.flur3Wood, backMaterial: M.flur3Wood, leafMaterial: M.flur3Wood, frameMaterial: frame, wallThickness: .22 });
    d.group.position.set(x, Y, z); d.group.rotation.y = ry; root.add(d.group);
    C.add({ x, z, w: 1.14, d: .22, rot: ry, bottom: Y, top: Y + 2.25, tag: 'tuer', id });
    anchor(id, 'door', name, x, Y, z, d.group);
    return d;
  }
  function lightSwitch(id, circuitId, label, x, z, ry, y = 1.05) {
    const sb = new PartBuilder(); addSwitchPlate(sb, M, 0, 0, 0); const s = sb.build({ name: id });
    s.position.set(x, Y + y, z); s.rotation.y = ry; root.add(s); anchor(id, 'switch', label + ': Licht', 0, 0, 0, s);
    interactions.register(s, { id, type: 'switch', label: () => `${label}: Licht ${lighting.isOn(circuitId) ? 'ausschalten' : 'einschalten'}`, onInteract: () => { lighting.toggle(circuitId); audio.click(); } });
  }
  function trash(x, z) {
    b.pushMatrix(matrixFrom(x, Y, z, 0, 0, 0, .9, 1.5, .9)); addTrashBin(b, { ...M, binBag: M.flur2Red }, 0, 0); b.pop();
    C.addBox(x - .18, z - .18, x + .18, z + .18, Y, Y + .75, { tag: 'muell' });
  }
  function finish(name) {
    root.add(walls.build({ name: name + '_waende' }), b.build({ name: name + '_ausstattung' }), fixtures.build({ name: name + '_leuchten', castShadow: false }));
    root.traverse(o => { if (o.isMesh && o.material === M.flur3Wall) metricBoxUV(o.geometry, .65); if (o.isMesh && o.material === M.foyerPhotoStair) metricBoxUV(o.geometry, .48); });
  }
  return { C, M, walls, b, fixtures, plane, anchor, surface, floor, ceiling, wall, sign, door, lightSwitch, trash, finish };
}

export function buildFlur5(ctx) {
  const { scene, lighting, map } = ctx;
  const F = FLUR5, Y = F.y, root = new THREE.Group(); root.name = 'flur_5'; scene.add(root);
  const { C, M, walls, b, fixtures, plane, anchor, surface, floor, ceiling, wall, sign, door, lightSwitch, trash, finish } = kit(ctx, root, Y, F.roof);
  const [DN, DS] = F.divider;   // Trennwand zwischen den Läufen, Nord-/Südfläche
  const going = (F.stairEnd - F.stairStart) / F.steps, rise = (OBEN.y - Y) / F.steps;
  // Vorderkantenlinie des Laufs nach oben (Sockel/Handlauf folgen ihr).
  // Höhe der Glasunterkante über dem Treppenauge (Pultdach, fällt nach Westen zu Flur 5 ab).
  const sky = x => F.skyLow + (F.skyHigh - F.skyLow) * (x - F.east) / (F.stairEnd - F.east);
  const stairLine = x => x < F.stairStart ? Y : Math.min(OBEN.y + rise, Y + rise + (x - F.stairStart) / going * rise);

  // ---------------------------------------------------------------- Boden, Decken
  floor(F.west, F.north, F.east, F.south);
  floor(F.podX, F.podN, F.east, F.north);                         // Podest vor dem Lauf nach oben
  surface(M.flur3Floor, F.east, F.flightSouth, F.east + .22, F.voidSouth, Y, false, 2);   // Galeriekante über dem Bestandswandkopf
  C.addBox(F.east, F.flightSouth, F.east + .22, F.voidSouth, Y - .12, Y, { tag: 'boden', surface: 'lino' });
  // Rote Platten in schrägen Reihen (6.jpg, 9.jpg, 11.jpg).
  ceiling(F.west, F.north, F.east, F.south, F.roof, (i, j) => (i * 2 + j) % 5 === 0);
  ceiling(F.podX, F.podN, F.stairEnd, DN, F.hallRoof, (i, j) => (i + j) % 3 === 1);   // über Podest und Lauf nach oben (4.jpg)
  // Graublaue Linoleumlinie als Raute um die Sitzgruppen (9.jpg, 11.jpg, 12.jpg).
  {const pts = [[-1.4, -2.05], [1.4, -3.75], [4.2, -2.05], [1.4, -.35]];
    for (let i = 0; i < 4; i++) {
      const [x0, z0] = pts[i], [x1, z1] = pts[(i + 1) % 4], len = Math.hypot(x1 - x0, z1 - z0);
      b.add(M.flur3Inlay, new THREE.PlaneGeometry(len, .04), matrixFrom((x0 + x1) / 2, Y + .002, (z0 + z1) / 2, -Math.PI / 2, 0, Math.atan2(-(z1 - z0), x1 - x0)));
    }}

  // ---------------------------------------------------------------- Wände Flur 5
  // Nordwand: 312 mit dunklem Oberlichtband, Bild, Mülleimer, Brandmelder und Lichtschalter (6.jpg, 7.jpg, 13.jpg).
  wall([F.west, F.north], [F.podX - .003, F.north], [{ u: .897, w: 1.14, y: 0, h: 2.25 }, { u: .197, w: 4.0, y: 2.36, h: .52 }]);
  b.push(-3.0, Y + 2.62, F.north); addWindow(b, M, { w: 4.0, h: .52, inset: .11, frame: M.flur3Frame, glass: M.flur5DarkGlass, rows: [{ f: 1, cols: [.26, .22, .52] }], sill: false }); b.pop();
  door('flur5_312', '312 · geschlossen', -3.73, F.north, 0);
  sign(M.flur5Room312, -2.98, F.north, 0);
  plane(M.flur5ArtSplash, 1.0, .75, -2.05, Y + 1.55, F.north + .02);
  b.box(M.steelBlack, 1.0, .75, .02, -2.05, Y + 1.55, F.north + .004);
  trash(.4, F.north + .3);
  b.box(M.red, .13, .13, .06, 2.62, Y + 1.42, F.north + .04); plane(M.fireAlarmFace, .115, .115, 2.62, Y + 1.42, F.north + .072);
  lightSwitch('lichtschalter_flur5', 'licht_flur5', 'Flur 5', 2.35, F.north + .003, 0);
  // Westwand: geschlossene Holz-Doppeltür zum weiterführenden Gang (dahinter keine Fotos), PC-Platz, Uhr, grünes Bild.
  wall([F.west, F.south], [F.west, F.north], [{ u: 4.12, w: 2.0, y: 0, h: 2.85 }]);
  const pair = createDoubleDoor({ ...M, foyerWood: M.flur3Wood, glass: M.flur4Milk }, { width: 2, height: 2.85, leafHeight: 2.15 });
  pair.group.position.set(F.west, Y, -5.15); pair.group.rotation.y = Math.PI / 2; root.add(pair.group);
  for (const leaf of pair.leaves) { const p = new THREE.Mesh(new THREE.PlaneGeometry(.3, .45), M.flur5Poster); p.position.set(leaf.centerX - leaf.dir * .18, 1.62, .029); leaf.pivot.add(p); }
  C.addBox(F.west - .15, -6.15, F.west + .07, -4.15, Y, Y + 2.85, { tag: 'tuer', id: 'flur5_doppeltuer' });
  b.boxMinMax(M.panelGrey, F.west - .4, Y - .5, -6.15, F.west - .38, Y + 2.85, -4.15);   // blickdicht hinter den Flügelfugen (Gang nicht gebaut)
  anchor('flur5_doppeltuer', 'door', 'Weiterer Gang · vorerst geschlossen', F.west, Y, -5.15, pair.group);
  b.push(F.west + .37, Y, -2.4, Math.PI / 2); addHallPcDesk(b, M, { length: 2.6, depth: .7, screens: 4 }); b.pop();
  C.add({ x: F.west + .37, z: -2.4, w: 2.6, d: .7, rot: Math.PI / 2, bottom: Y, top: Y + 1.25, tag: 'tisch', id: 'flur5_pc_tisch' });
  anchor('flur5_pc_tisch', 'computer', 'PC-Arbeitsplätze', F.west + .37, Y, -2.4);
  for (const z of [-1.85, -2.95]) { b.push(F.west + 1.05, Y, z, -Math.PI / 2); addShellChair(b, M); b.pop(); C.addBox(F.west + .8, z - .25, F.west + 1.3, z + .25, Y, Y + .86, { tag: 'stuhl' }); }
  const clock = createWallClock(M); clock.position.set(F.west + .005, Y + 2.38, -2.95); clock.rotation.y = Math.PI / 2; root.add(clock);
  plane(M.flur5ArtGreen, 1.0, .75, F.west + .02, Y + 1.72, -1.95, Math.PI / 2);
  b.box(M.steelBlack, .02, .75, 1.0, F.west + .004, Y + 1.72, -1.95);
  plane(M.paper, .22, .14, F.west + .012, Y + 1.62, -2.6, Math.PI / 2); b.box(M.red, .003, .025, .22, F.west + .014, Y + 1.675, -2.6);
  // Südwand: Fensterachsen der vorhandenen Hoffassade, Holzhandlauf je Fenster; östlich zwei gerahmte Drucke.
  // Beginnt 2 cm vor dem östlichen Wandstück (keine überlappenden Sockelleisten in der Ecke).
  wall([F.east - .02, F.south], [F.west, F.south], FLUR5_WINDOWS.map(([a, d]) => ({ u: F.east - .02 - d, w: d - a, y: .06, h: 2.0 })), { thickness: .044 });
  for (const [a, d] of FLUR5_WINDOWS) {
    b.rod(M.handrailWood, [a + .03, Y + .93, F.south - .07], [d - .03, Y + .93, F.south - .07], .024, 10);
    for (const x of [a + .08, d - .08]) b.box(M.aluminium, .02, .03, .07, x, Y + .93, F.south - .035);
    C.addBox(a, F.south - .06, d, F.south + .2, Y, F.roof, { tag: 'fenster' });
  }
  M.flur5Prints.forEach((mat, i) => {
    const x = [3.0, 1.45][i], w = [.66, .78][i], h = [.98, 1.15][i];
    b.box(M.frameWhite, w + .05, h + .05, .03, x, Y + 1.72, F.south - .015);
    plane(mat, w, h, x, Y + 1.72, F.south - .036, Math.PI);
  });
  addSnake(-4.85, -.42, 3); addSnake(-1.01, -.36, 9);
  function addSnake(x, z, seed) { b.push(x, Y, z); addSnakePlant(b, M, { seed }); b.pop(); C.addBox(x - .18, z - .18, x + .18, z + .18, Y, Y + .5, { tag: 'pflanze' }); }
  // Ostkante: Wandstück südlich des Treppenauges, Geländer über dem Auge, Baum an der Galerie (1.jpg, 9.jpg, 10.jpg).
  wall([F.east - .003, F.voidSouth + .003], [F.east - .003, F.south + .044]);   // Enden 3 mm hinter der Bestandswand bzw. in der Fassade
  b.push(F.east + .12, Y, F.flightSouth, -Math.PI / 2); addGalleryRailing(b, M, { length: F.voidSouth - F.flightSouth, spacing: .9 }); b.pop();
  C.addBox(F.east + .02, F.flightSouth, F.east + .16, F.voidSouth, Y, Y + 1.4, { tag: 'gelaender', id: 'flur5_galerie' });
  addPottedTree(root, b, M, 4.95, Y, -2.45, { height: 2.85, crown: 1.05 });
  C.addBox(4.57, -2.83, 5.33, -2.07, Y, Y + .75, { tag: 'pflanze', id: 'flur5_baum' });
  anchor('flur5_baum', 'decoration', 'Baum an der Galerie', 4.95, Y, -2.45);

  // Zwei Reihen Hochtische mit Bänken und Würfelhockern (8.jpg, 9.jpg, 11.jpg, 12.jpg).
  const seatColors = [M.stoolGreen, M.stoolBrown, M.flur3BlueSeat];
  [[.9, -.95], [3.15, -.95], [.9, -3.5], [3.15, -3.5]].forEach(([x, z], i) => {
    b.push(x, Y, z); addHighTable(b, M, { length: 1.9, depth: .7, height: 1.07 }); b.pop();
    C.addBox(x - .95, z - .35, x + .95, z + .35, Y + .96, Y + 1.07, { tag: 'tisch', id: 'flur5_hochtisch_' + i });
    for (const sx of [-.88, .88]) for (const sz of [-.29, .29]) C.addBox(x + sx - .025, z + sz - .025, x + sx + .025, z + sz + .025, Y, Y + 1.05, { tag: 'tisch' });
    const benchSide = z > -2 ? 1 : -1;   // lange Bank zur Fensterseite bzw. zum Gang
    seat(x, z + benchSide * .62, 1.7, i % 2 ? M.flur3BlueSeat : M.stoolGreen);
    [-.6, 0, .6].forEach((dx, k) => seat(x + dx, z - benchSide * .62, .42, seatColors[(i + k) % 3]));
    map.furniture.push([x - .95, z - .84, x + .95, z + .84]);
    anchor('flur5_hochtisch_' + i, 'table', 'Hochtisch', x, Y, z);
  });
  function seat(x, z, len, mat) { b.push(x, Y, z); addHighSeat(b, M, { length: len, depth: .42, material: mat }); b.pop(); C.addBox(x - len / 2, z - .21, x + len / 2, z + .21, Y, Y + .74, { tag: 'stuhl' }); }

  // ---------------------------------------------------------------- Podest mit 313 und Lauf nach oben
  // Podest-Westwand mit 313, Wegweiser, Desinfektionsspender, Notausgangszeichen (1.jpg, 3.jpg, 13.jpg).
  wall([F.podX, F.north], [F.podX, F.podN], [{ u: 1.21, w: 1.14, y: 0, h: 2.25 }], { top: F.hallRoof });
  door('flur5_313', '313 · Putzraum geschlossen', F.podX, -8.63, Math.PI / 2);
  sign(M.flur5Room313, F.podX, -7.86, Math.PI / 2);
  sign(M.flur5WaySign, F.podX, -7.45, Math.PI / 2, .62, .13, 2.02);
  b.push(F.podX, Y + 1.25, -7.12, Math.PI / 2); addSanitizer(b, M); b.pop();
  b.box(M.flur3Frame, .07, .17, .36, F.podX + .035, Y + 2.48, -8.63);
  plane(M.foyerExit_left, .32, .15, F.podX + .075, Y + 2.48, -8.63, Math.PI / 2);
  // Nordwand von Podest und Lauf bis zum oberen Gang; Sockel und Handlauf folgen der Treppe.
  const north = wall([F.podX, F.podN], [F.stairEnd - .003, F.podN], [], { top: F.hallRoof, base: u => stairLine(F.podX + u) });
  handrail(F.podN + .07, F.stairStart, F.stairEnd);
  b.push(3.95, Y + 2.95, F.podN); addRoundWallLamp(b, M, M.flur5Light); b.pop();
  b.push(7.4, OBEN.y + 2.2, F.podN); addRoundWallLamp(b, M, M.flur5Light); b.pop();
  // Kante zwischen niedriger Flurdecke und hohem Podest (Unterzug, 13.jpg/14.jpg).
  wall([5.38, F.north], [F.podX + .003, F.north], [], { y0: F.roof - .2, top: F.hallRoof, dado: false, onMap: false });
  // Lauf: 13 Steigungen à ca. 15 cm, drei Antrittsstufen verbreitern sich zum Flur (2.jpg).
  for (let i = 0; i < F.steps; i++) {
    const x = F.stairStart + i * going, top = Y + (i + 1) * rise, z1 = i < 3 ? DN + (3 - i) * .15 : DN;
    b.boxMinMax(M.foyerPhotoStair, x, Y - .02, F.podN, x + going, top, z1);
    b.box(M.aluminium, .03, .005, z1 - F.podN - .02, x + .015, top + .003, (F.podN + z1) / 2);
    C.add({ x: x + going / 2, z: (F.podN + z1) / 2, w: z1 - F.podN, d: going, rot: Math.PI / 2, bottom: Y - .1, slope: { h0: Y + i * rise, h1: top }, tag: 'treppe', surface: 'rubber', id: 'flur5_treppe_oben' });
  }
  anchor('flur5_treppe_oben', 'stairs', 'Treppe nach oben (314 – 319)', F.stairStart, Y, (F.podN + DN) / 2);

  // ---------------------------------------------------------------- Treppenauge
  // Trennwand zwischen den Läufen oberhalb des Bestands (bis 8,65 m in flur3.js), große Öffnung mit
  // schräger Brüstung zum Lauf nach oben (2.jpg, 4.jpg, 14.jpg, 15.jpg). Kollision über die volle Höhe.
  {const sill = x => stairLine(x) + 1.0, x0 = 6.05, x1 = 7.95;
    // Oben bis zur Decke des Laufs (12,6 m), zum oberen Gang hin bis über die Glasoberkante.
    const xk = F.east + (12.55 - F.skyLow) / (F.skyHigh - F.skyLow) * (F.stairEnd - F.east);
    const shape = new THREE.Shape([new THREE.Vector2(F.east, FLUR3.stairRoof), new THREE.Vector2(F.stairEnd, FLUR3.stairRoof), new THREE.Vector2(F.stairEnd, F.skyHigh + .05), new THREE.Vector2(xk, 12.6), new THREE.Vector2(F.east, 12.6)]);
    shape.holes.push(new THREE.Path([new THREE.Vector2(x0, sill(x0)), new THREE.Vector2(x1, sill(x1)), new THREE.Vector2(x1, 11.9), new THREE.Vector2(x0, 11.9)]));
    const g = new THREE.ExtrudeGeometry(shape, { depth: DS - DN, bevelEnabled: false }); g.translate(0, 0, DN); walls.add(M.flur3Wall, g);
    C.addBox(F.east, DN, F.stairEnd, DS, FLUR3.stairRoof, 12.6, { tag: 'wand' });
    handrail(DN - .07, F.stairStart + 3 * going, F.stairEnd, -1);
    // Sockelstreifen der Trennwand zum Lauf nach oben (nur unterhalb der Öffnung sichtbar).
    const pts = []; for (let k = 0; k <= 16; k++) { const x = F.east + (F.stairEnd - F.east) * k / 16; pts.push(new THREE.Vector2(x, stairLine(x))); }
    for (let k = 16; k >= 0; k--) { const x = F.east + (F.stairEnd - F.east) * k / 16; pts.push(new THREE.Vector2(x, stairLine(x) + .92)); }
    const dg = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: .012, bevelEnabled: false }); dg.translate(0, 0, DN - .014); b.add(M.flur2Dado, dg);
  }
  // Wände des Treppenauges über dem Bestand bis zum Oberlicht.
  wall([F.east, F.voidSouth], [F.east, F.north], [], { y0: F.roof - .2, top: sky(F.east) + .05, dado: false, onMap: false });
  wall([F.stairEnd, -6.75], [F.stairEnd, F.voidSouth], [], { y0: OBEN.roof - .2, top: sky(F.stairEnd) + .05, dado: false, onMap: false });
  // Südwand des Auges als Trapez unter der Dachschräge.
  {const xe = F.stairEnd - .003, shape = new THREE.Shape([new THREE.Vector2(F.east, FLUR3.stairRoof), new THREE.Vector2(xe, FLUR3.stairRoof), new THREE.Vector2(xe, sky(xe) + .05), new THREE.Vector2(F.east, sky(F.east) + .05)]);
    const g = new THREE.ExtrudeGeometry(shape, { depth: .22, bevelEnabled: false }); g.translate(0, 0, F.voidSouth); walls.add(M.flur3Wall, g);}
  addPentSkylight(b, M, { x0: F.east, x1: F.stairEnd, z0: F.north, z1: F.voidSouth, y0: F.skyLow, y1: F.skyHigh, bays: 6 });
  anchor('flur5_oberlicht', 'decoration', 'Glas-Pultoberlicht über dem Treppenhaus', (F.east + F.stairEnd) / 2, F.skyLow, (F.north + F.voidSouth) / 2);

  // Notausgangszeichen hängend am Austritt der Treppe von Flur 4 (1.jpg, 2.jpg).
  {const x = 4.55, z = -5.3;
    for (const s of [-1, 1]) b.rod(M.aluminium, [x, F.roof, z + s * .09], [x, F.roof - .3, z + s * .09], .004, 6);
    b.box(M.flur3Frame, .06, .18, .35, x, F.roof - .39, z); plane(M.foyerExit_left, .32, .15, x + .032, F.roof - .39, z, Math.PI / 2); plane(M.foyerExit_right, .32, .15, x - .032, F.roof - .39, z, -Math.PI / 2);}

  // ---------------------------------------------------------------- Licht
  for (const x of [-3.7, -1.0, 1.7, 4.0]) for (const z of [-5.1, -1.9]) addCeilingLight(fixtures, { ...M, lightPanel: M.flur5Light }, x, F.roof, z, { length: 1.25, width: .15, ry: Math.PI / 2 });
  for (const x of [6.25, 7.6]) addCeilingLight(fixtures, { ...M, lightPanel: M.flur5Light }, x, F.hallRoof - .025, -8.22, { length: .59, width: .59 });
  const lights = [];
  for (const [x, y, z] of [[-3.2, F.roof - .34, -3.4], [.3, F.roof - .34, -3.4], [3.6, F.roof - .34, -3.6], [4.6, Y + 3.3, -8.1]]) {
    const l = new THREE.PointLight(0xfff3df, 16, 7.5, 2); l.position.set(x, y, z); root.add(l); lights.push(l);
  }
  for (const x of [-1.6, -3.9]) lighting.addDaylight(root, 'licht_flur5', { position: [x, Y + 1.7, F.south + .6], intensity: 12, distance: 8 });
  lighting.addDaylight(root, 'licht_flur5', { position: [(F.east + F.stairEnd) / 2, F.skyHigh + .4, -3.9], intensity: 22, distance: 13 });
  lighting.addCircuit('licht_flur5', { lights, panels: [M.flur5Light], regions: [
    [F.west - .11, F.north - .11, F.east, F.south + .04, Y - .08, F.roof + .08],
    [F.podX - .11, F.podN - .11, F.east, F.north, Y - .08, F.hallRoof + .08],
    [F.east, F.podN - .11, F.stairEnd, (DN + DS) / 2, Y - .08, F.hallRoof + .08],
    [F.east, (DN + DS) / 2, F.stairEnd, F.voidSouth + .11, FLUR3.stairRoof, F.skyHigh + .1],
  ] });
  // Öffnungen zu Flur 3/4 (Lauf und Galerie) und zum oberen Gang; Licht und Raum-Sichtbarkeit.
  lighting.portals.add({ id: 'flur5_lauf_flur4', rooms: ['licht_flur3', 'licht_flur5'], normal: [-1, 0], center: [F.east, Y + 1.35, (F.north + F.flightSouth) / 2], width: F.flightSouth - F.north, height: 2.7, power: .25, range: 4 });
  lighting.portals.add({ id: 'flur5_galerie', rooms: ['licht_flur3', 'licht_flur5'], normal: [-1, 0], center: [F.east, Y + .6, (F.flightSouth + F.voidSouth) / 2], width: F.voidSouth - F.flightSouth, height: 3.6, power: .2, range: 4 });
  // Fenster zum Hof: schwacher Lichtschein und Sichtbarkeit in beide Richtungen.
  lighting.portals.add({ id: 'flur5_fenster_hof', rooms: ['licht_hof', 'licht_flur5'], normal: [0, -1], center: [-2.76, Y + 1.06, F.south + .03], width: 4.48, height: 2.0, transmission: .35, power: .18, range: 4 });
  // Waagrechte Grenze im Treppenauge (8,65 m) als drei schmale Sichtportale, ohne Lichtbeitrag.
  for (const [i, x] of [6.05, 6.95, 7.85].entries())
    lighting.portals.add({ id: 'flur5_auge_' + i, rooms: ['licht_flur3', 'licht_flur5'], normal: [1, 0], center: [x, FLUR3.stairRoof, (F.north + F.voidSouth) / 2], width: F.voidSouth - F.north, height: .7, transmission: 0 });

  // ---------------------------------------------------------------- Karte, Bereiche
  map.areas.push({ poly: [[F.west, F.north], [F.east, F.north], [F.east, F.south], [F.west, F.south]], fill: 'rgba(174,113,143,.30)' },
    { poly: [[F.podX, F.podN], [F.stairStart, F.podN], [F.stairStart, F.north], [F.podX, F.north]], fill: 'rgba(174,113,143,.30)' },
    { poly: [[F.stairStart, F.podN], [F.stairEnd, F.podN], [F.stairEnd, DN], [F.stairStart, DN]], fill: 'rgba(120,145,175,.35)' },
    { poly: [[F.east, DS], [F.stairEnd, DS], [F.stairEnd, F.flightSouth], [F.east, F.flightSouth]], fill: 'rgba(120,145,175,.35)' });
  map.walls.push([F.east, F.flightSouth, F.east, F.voidSouth], [F.east, F.flightSouth, F.stairEnd, F.flightSouth]);
  map.labels.push({ text: 'Flur 5', x: -1.6, z: -4.6 }, { text: '313', x: 3.6, z: -8.5 }, { text: '312', x: -3.73, z: -6.3 },
    { text: '↑ 314 – 319', x: 6.6, z: -8.2 }, { text: '↓ Flur 4', x: 6.9, z: -5.2 });
  finish('flur5');
  const on = (p, x0, z0, x1, z1) => p.x >= x0 && p.x <= x1 && p.z >= z0 && p.z <= z1;
  return { id: 'flur_5', name: 'Flur 5', root, mapFloor: 2,
    bounds: { minX: F.west - .22, maxX: F.stairEnd, minZ: F.podN - .22, maxZ: .05, minY: Y - .2, maxY: F.skyHigh + .1 },
    areaName(p) {
      if (on(p, F.east, F.north, F.stairEnd, F.flightSouth) && p.y > FLUR3.upper - .1 && p.y < Y + .3) return 'Treppe · Flur 4 ↔ Flur 5';
      if (on(p, F.stairStart, F.podN, F.stairEnd, DN) && p.y > Y + .05 && p.y < OBEN.y - .02) return 'Treppe · Flur 5 ↔ 314 – 319';
      if (p.y < Y - .15 || p.y > Y + 1) return null;
      if (on(p, F.podX, F.podN, F.east, F.north)) return 'Flur 5 · Treppenpodest (313)';
      if (on(p, F.west, F.north, F.east + .25, F.south)) return p.x < -2.5 ? 'Flur 5 · PC-Plätze' : 'Flur 5 · Aufenthaltsbereich';
      return null;
    } };

  function handrail(z, xa, xb, side = 1) {
    b.rod(M.handrailWood, [xa, stairLine(xa) + .9, z], [xb, stairLine(xb) + .9, z], .028, 12);
    for (let x = xa + .3; x < xb; x += 1.1) b.bar(M.aluminium, [x, stairLine(x) + .83, z], [x, stairLine(x) + .83, z - side * .065], .015, .015);
  }
}

export function buildOben(ctx) {
  const { scene, lighting, map } = ctx;
  const O = OBEN, Y = O.y, root = new THREE.Group(); root.name = 'oben'; scene.add(root);
  const { C, M, walls, b, fixtures, plane, anchor, surface, floor, ceiling, wall, sign, door, lightSwitch, trash, finish } = kit(ctx, root, Y, O.roof);
  const V = FLUR5.voidSouth;
  floor(O.west, O.north, O.east, O.south);
  // Je zwei rote Platten quer zur Gangmitte (oben 1.jpg, oben 4.jpg).
  ceiling(O.west, O.north, O.east, O.south, O.roof, (i, j) => (i === 2 || i === 3) && j % 3 === 1);
  // Nordende mit 314, Druckknopfmelder, Schalter (oben tür.jpg, oben 2.jpg).
  wall([O.west, O.north], [O.east, O.north], [{ u: .88, w: 1.14, y: 0, h: 2.25 }]);
  door('oben_314', '314 · geschlossen', 9.75, O.north, 0, { frame: M.flur4Red });
  sign(M.flur5Room314, 9.0, O.north, 0);
  b.box(M.flur4Orange, .13, .13, .05, 8.68, Y + 1.38, O.north + .035);
  b.box(M.switchWhite, .4, .95, .012, 8.6, Y + 1.98, O.north + .007);
  lightSwitch('lichtschalter_oben', 'licht_oben', 'Oberer Gang', 9.05, O.north + .003, 0, 1.13);
  addSwitchPlate(b, M, 9.05, Y + 1.04, O.north + .003, 0, true);   // Steckdose unter dem Schalter (oben tür.jpg)
  // Ostwand: 315, 316 (Knauf, graue Zarge), 317, Wandhydrant am Ende (oben 2.jpg, oben 4.jpg, oben tür 2–7.jpg).
  wall([O.east, O.north], [O.east, O.south], [{ u: .58, w: 1.14, y: 0, h: 2.25 }, { u: 3.73, w: 1.14, y: 0, h: 2.25 }, { u: 8.33, w: 1.14, y: 0, h: 2.25 }]);
  door('oben_315', '315 · Klassenraum geschlossen', O.east, -8.75, -Math.PI / 2, { frame: M.flur4Red });
  door('oben_316', '316 · geschlossen', O.east, -5.6, -Math.PI / 2, { knob: true });
  door('oben_317', '317 · geschlossen', O.east, -1.0, -Math.PI / 2, { frame: M.flur4Red });
  sign(M.flur5Room315, O.east, -7.98, -Math.PI / 2);
  sign(M.flur5Room316, O.east, -6.38, -Math.PI / 2);
  b.push(O.east, Y + 1.05, -6.38, -Math.PI / 2); addSwitchPlate(b, M, 0, 0, .003); b.pop();
  sign(M.flur5Room317, O.east, -1.78, -Math.PI / 2);
  trash(O.east - .28, -2.8);
  b.push(O.east, Y + 1.45, .85, -Math.PI / 2); addHoseCabinet(b, M); b.pop();
  C.addBox(O.east - .14, .47, O.east, 1.23, Y, Y + 1.95, { tag: 'schrank' }); anchor('oben_wandhydrant', 'decoration', 'Wandhydrant', O.east, Y + 1.45, .85);
  // Südende mit 318 und grauer Revisionsklappe (oben tür 7.jpg).
  wall([O.east, O.south], [O.west, O.south], [{ u: .66, w: 1.14, y: 0, h: 2.25 }]);
  door('oben_318', '318 · geschlossen', 10.37, O.south, Math.PI);
  sign(M.flur5Room318, 9.66, O.south, Math.PI);
  b.box(M.panelGrey, .55, .5, .012, 9.2, Y + 1.2, O.south - .02);
  // Westseite südlich der Brüstung mit 319 (Nutzerskizze; nur angeschnitten auf oben tür 7.jpg).
  wall([O.west, O.south], [O.west, V + .003], [{ u: .48, w: 1.14, y: 0, h: 2.25 }]);
  door('oben_319', '319 · geschlossen', O.west, .35, Math.PI / 2, { frame: M.flur4Red });
  sign(M.flur5Room319, O.west, -.4, Math.PI / 2);
  wall([O.west, FLUR5.podN - .003], [O.west, O.north]);   // Wandstück nördlich der Ankunft der Treppe
  // Brüstung über dem Treppenauge: reicht von der Deckenkante über Flur 4 bis 1 m über den Gangboden,
  // Holzhandlauf auf Konsolen, langer Röhrenheizkörper gangseitig (sicht von oben auf flur5.jpg, oben 1/2/4.jpg).
  const pLen = V - (-6.75);
  b.push(O.west + .25, Y, V, Math.PI / 2); addParapet(b, M, { length: pLen, bottom: FLUR3.stairRoof + .005 - Y, radiator: { width: 4.6, height: .6 } }); b.pop();
  C.addBox(O.west, -6.75, O.west + .25, V, FLUR3.stairRoof, Y + 1.35, { tag: 'bruestung', id: 'oben_bruestung' });
  C.addBox(O.west + .25, -6.1, O.west + .48, -1.5, Y, Y + .75, { tag: 'heizkoerper' });
  anchor('oben_bruestung', 'decoration', 'Brüstung mit Heizkörper', O.west, Y, (V - 6.75) / 2);
  // Stütze am Nordende der Brüstung (oben 1.jpg, oben 2.jpg).
  walls.boxMinMax(M.flur3Wall, O.west, FLUR3.stairRoof + .005, FLUR5.divider[0], O.west + .3, O.roof, -6.75);
  b.boxMinMax(M.flur2Dado, O.west + .3, Y, FLUR5.divider[0] + .002, O.west + .312, Y + .92, -6.752);
  C.addBox(O.west, FLUR5.divider[0], O.west + .3, -6.75, Y, O.roof, { tag: 'wand' });

  for (const z of [-8.4, -5.6, -2.8, 0]) addCeilingLight(fixtures, { ...M, lightPanel: M.obenLight }, 9.95, O.roof, z, { length: 1.25, width: .15 });
  const lights = [];
  for (const z of [-6.6, -1.2]) { const l = new THREE.PointLight(0xfff3df, 15, 7, 2); l.position.set(9.95, O.roof - .34, z); root.add(l); lights.push(l); }
  lighting.addCircuit('licht_oben', { lights, panels: [M.obenLight], regions: [[O.west, O.north - .11, O.east + .11, O.south + .11, Y - .08, O.roof + .08]] });
  lighting.portals.add({ id: 'oben_bruestung_auge', rooms: ['licht_flur5', 'licht_oben'], normal: [1, 0], center: [O.west, Y + 1.5, (V - 6.75) / 2], width: V + 6.75, height: 3.0, power: .2, range: 4 });
  lighting.portals.add({ id: 'oben_treppe', rooms: ['licht_flur5', 'licht_oben'], normal: [1, 0], center: [O.west, Y + 1.5, (FLUR5.podN + FLUR5.divider[0]) / 2], width: FLUR5.divider[0] - FLUR5.podN, height: 3.0, power: .25, range: 4 });

  map.areas.push({ poly: [[O.west, O.north], [O.east, O.north], [O.east, O.south], [O.west, O.south]], fill: 'rgba(174,113,143,.30)' });
  map.labels.push({ text: 'Gang 314 – 319', x: 10.0, z: -4.2 });
  finish('oben');
  return { id: 'oben', name: 'Oberer Gang 314 – 319', root, mapFloor: 2,
    bounds: { minX: O.west, maxX: O.east + .22, minZ: O.north - .22, maxZ: O.south + .22, minY: FLUR3.stairRoof, maxY: O.roof + .13 },
    areaName: p => p.x >= O.west && p.x <= O.east && p.z >= O.north && p.z <= O.south && p.y > Y - .15 && p.y < Y + 1 ? 'Oberer Gang · 314 – 319' : null };
}

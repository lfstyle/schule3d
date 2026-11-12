// Gang links neben dem Torbogen (fotos/außenbereich eingang/links mauertor/): zwischen der Südseite des
// Wohnhauses gegenüber und dem Fensterpfeiler nach Osten, bis unter das dunkle Vordach am Hausende und ein
// Stück nach Norden hinter das Haus. Rechts Geländer auf Betonpfosten über der Tiefgaragen-Abfahrt („TG“),
// dahinter ein Haus mit Terrasse, dunklem Blendband und gelbem Rautenschild; am Ende Stufen hinab unter ein
// Glasdach. Alle Maße geschätzt (verification/VORPLATZ-ABGLEICH.md). Wohnhaus-Südseite: vorplatz-gegenueber.js.
import * as THREE from 'three';
import { VP, groundY, houseX, archEast } from './vorplatz-layout.js';

export function buildGang({ b, detail, facade, ground, glass, C, M, anchor, sign, quad, map }) {
  const G = VP.gang, xs = houseX(VP.houseSouth), xe = archEast();
  // Hausflucht Süd (wie der Wohnhaus-Abschnitt 0,07 geneigt), Südostecke, Rückseite nach Norden
  const n = Math.hypot(1, .07), houseZ = x => VP.houseSouth - .07 * (x - xs);
  const se = [xs + 11 / n, VP.houseSouth - 11 * .07 / n], backX = z => se[0] - .07 * (se[1] - z);
  const gy = groundY(G.rail);   // Gangniveau am Geländer

  // Fläche aus einem einfachen Polygon (x, z), Höhe yAt(x, z) muss je Polygon eben sein; UVs in Metern.
  const surface = (builder, mat, pts, tile, yAt) => {
    const tris = THREE.ShapeUtils.triangulateShape(pts.map(([x, z]) => new THREE.Vector2(x, z)), []);
    const idx = [];
    for (const [a, c, d] of tris) {
      const [ax, az] = pts[a], [cx, cz] = pts[c], [dx, dz] = pts[d];
      idx.push(...((cz - az) * (dx - ax) - (cx - ax) * (dz - az) > 0 ? [a, c, d] : [a, d, c]));   // Normale nach oben
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts.flatMap(([x, z]) => [x, yAt(x, z), z]), 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(pts.flatMap(([x, z]) => [x / tile, -z / tile]), 2));
    g.setIndex(idx); g.computeVertexNormals(); builder.add(mat, g);
  };
  const onGround = (x, z) => groundY(z);

  // ------------------------------------------------------------------ Boden
  // Vorn großes Granitpflaster, ab der Haustür helle Granitplatten (Fotos).
  const x0 = 36.7, xm = G.slabs, xn = backX(G.north);
  surface(ground, M.vpSett, [[x0, houseZ(x0)], [xm, houseZ(xm)], [xm, G.rail], [x0, G.rail]], 1.3, onGround);
  surface(ground, M.vpSlab, [[xm, houseZ(xm)], se, [xn, G.north], [G.end, G.north], [G.end, G.rail], [xm, G.rail]], 1.2, onGround);
  map.areas.push({ poly: [[xs, VP.houseSouth], se, [xn, G.north], [G.end, G.north], [G.end, G.rail], [xe, G.rail]], fill: 'rgba(157,153,126,.22)' });

  // ------------------------------------------------------------------ Geländer über der Tiefgaragen-Abfahrt
  // Abfahrt fällt vom Torbogen nach Osten; Stützmauer unter dem Gang, Betonpfosten mit Stabgeländer.
  const XR = 54, rampY = x => Math.max(-.55 - .16 * (x - xe), -2.55), xf = xe + 2 / .16, zr = G.rail + .25, zb = 11.0;
  const byX = (x, z) => rampY(x);
  surface(ground, M.vpAsphalt, [[x0, zr], [40.5, zr], [40.5, 22], [37.55, 22], [x0, 18.6]], 3, byX);   // bis an den Gehweg jenseits des Bogens
  surface(ground, M.vpAsphalt, [[40.5, zr], [xf, zr], [xf, zb], [40.5, zb]], 3, byX);
  surface(ground, M.vpAsphalt, [[xf, zr], [XR, zr], [XR, zb], [xf, zb]], 3, byX);
  for (let x = xe; x < XR - .01; x += 1.5) {
    const x1 = Math.min(x + 1.5, XR);
    b.boxMinMax(M.vpConcrete, x, rampY(x1) - .1, G.rail, x1, gy + .22, zr);
  }
  for (let x = xe + .15; x < XR; x += 1.85) {
    b.boxMinMax(M.vpConcrete, x - .12, gy + .2, G.rail + .01, x + .12, gy + 1.05, zr - .01);
    const x1 = Math.min(x + 1.85, XR) - .12;
    if (x1 - x < .4) continue;
    b.bar(M.vpGalv, [x + .12, gy + .98, G.rail + .125], [x1, gy + .98, G.rail + .125], .05, .04);
    b.bar(M.vpGalv, [x + .12, gy + .3, G.rail + .125], [x1, gy + .3, G.rail + .125], .04, .03);
    for (let xx = x + .24; xx < x1 - .05; xx += .12) detail.bar(M.vpGalv, [xx, gy + .3, G.rail + .125], [xx, gy + .98, G.rail + .125], .015, .015);
  }
  C.add({ x: (xe + XR) / 2, z: G.rail + .125, w: XR - xe, d: .25, bottom: gy - .5, top: gy + 1.1, tag: 'zaun', id: 'vorplatz_gang_gelaender' });
  map.walls.push([xe, G.rail, G.end, G.rail]);
  // Grauer Kasten am Geländerende (links von dem Mauertor2.jpg)
  b.boxMinMax(M.vpCabinet, 47.2, gy, G.rail - .55, 47.95, gy + 1.15, G.rail - .02);
  b.boxMinMax(M.vpCabinet, 47.18, gy + 1.15, G.rail - .57, 47.97, gy + 1.18, G.rail);
  detail.boxMinMax(M.vpFrame, 47.45, gy + .7, G.rail - .555, 47.7, gy + .95, G.rail - .55);
  C.addBox(47.2, G.rail - .55, 47.95, G.rail, gy, gy + 1.2, { tag: 'wand', id: 'vorplatz_gang_kasten' });
  // Unsichtbare Sperre am Ende des Großpflasters (x = 42, Übergang zu den Platten): ab hier kein Durchgang weiter nach Osten.
  C.addBox(G.slabs - .05, houseZ(G.slabs) - .3, G.slabs + .05, G.rail + .15, -3, 8, { tag: 'grenze', id: 'vorplatz_gang_sperre' });

  // ------------------------------------------------------------------ Haus hinter dem Gang (Süden)
  // Untergeschoss an der Abfahrt, darüber Terrasse mit Geländer, dunkles Blendband mit gelbem Rautenschild,
  // Obergeschoss, Satteldach mit Kamin (links von dem Mauertor2/3.jpg).
  { const hx0 = 40.5, hx1 = 53.5, hz1 = 17.5, ft = .05, eave = 5.6, ridge = 8.0, zc = (zb + hz1) / 2;
    facade.boxMinMax(M.vpHouse, hx0, -2.6, zb, hx1, eave, hz1);
    b.boxMinMax(M.vpConcrete, hx0 - .01, -2.62, zb - .01, hx1 + .01, ft - .1, zb + .2);
    sign(M.vpSignTG, .8, .4, 45.6, -1.15, zb - .015, 0, detail);
    b.boxMinMax(M.vpConcrete, 43.0, ft - .2, zb - 1.1, hx1, ft, zb);   // Terrasse
    for (let x = 43.1; x < hx1; x += 1.6) b.boxMinMax(M.vpGalv, x - .025, ft, zb - 1.08, x + .025, ft + 1.0, zb - 1.03);
    b.bar(M.vpGalv, [43.05, ft + 1.0, zb - 1.055], [hx1, ft + 1.0, zb - 1.055], .05, .04);
    for (let x = 43.2; x < hx1; x += .13) detail.bar(M.vpGalv, [x, ft + .08, zb - 1.055], [x, ft + .98, zb - 1.055], .012, .012);
    for (let x = 43.6; x < hx1 - 1; x += 2.2) {   // Fenster und Türen zur Terrasse
      detail.boxMinMax(M.vpDarkGlass, x + .03, ft + .02, zb - .012, x + 1.77, ft + 2.25, zb - .008);
      for (const [a, c] of [[x, x + .06], [x + 1.74, x + 1.8], [x + .87, x + .93]]) detail.boxMinMax(M.vpFrame, a, ft, zb - .03, c, ft + 2.3, zb - .005);
      detail.boxMinMax(M.vpFrame, x, ft + 2.25, zb - .03, x + 1.8, ft + 2.31, zb - .005);
    }
    b.boxMinMax(M.vpDoorFrame, 43.0, 2.55, zb - .7, hx1, 3.15, zb);   // Blendband
    sign(M.vpSignDiamond, .75, .75, 44.4, 2.85, zb - .705, 0, detail);
    sign(M.vpSignDiamond, .5, .5, 42.995, 2.85, zb - .35, -Math.PI / 2, detail);
    for (const x of [44.6, 47.4, 50.2]) {   // Obergeschoss
      detail.boxMinMax(M.vpDarkGlass, x + .03, 3.7, zb - .009, x + 1.17, 4.95, zb - .006);
      for (const [a, c, y0, y1] of [[x, x + 1.2, 3.65, 3.72], [x, x + 1.2, 4.93, 5.0], [x, x + .06, 3.65, 5.0], [x + 1.14, x + 1.2, 3.65, 5.0]]) detail.boxMinMax(M.vpFrame, a, y0, zb - .03, c, y1, zb - .003);
    }
    for (const s of [-1, 1]) {
      const run = (hz1 - zb) / 2 + .5, rise = (ridge - eave) * run / ((hz1 - zb) / 2), a = Math.atan2(rise, run);
      b.box(M.vpRoofTile, hx1 - hx0 + .6, .14, Math.hypot(run, rise), (hx0 + hx1) / 2, eave - (rise - (ridge - eave)) + rise / 2 + .07, zc + s * run / 2, s * a);
    }
    quad(facade, M.vpHouse, [[hx0, eave, zb], [hx0, eave, hz1], [hx0, ridge, zc]]);
    facade.boxMinMax(M.hofOldPlaster, 45.2, ridge - 1.2, zc - .9, 45.75, ridge + .9, zc - .35);   // Kamin
    C.addBox(hx0, zb - 1.1, hx1, hz1, -3, eave, { tag: 'wand', id: 'vorplatz_haus_tg' });
    anchor('vorplatz_haus_tg', 'exterior', 'Haus mit gelbem Rautenschild (hinter dem Gang)', (hx0 + hx1) / 2, -.55, zb);
  }

  // ------------------------------------------------------------------ Vordach am Hausende, Stufen, Glasdach
  // Dunkles Flachdach über dem Gang am Hausende, weißer Pfeiler an der Hausecke (links von dem Mauertor3.jpg).
  { const cx0 = xs + 8.6, cx1 = 48.45, cz1 = 7.9, yb = gy + 2.55;
    b.boxMinMax(M.vpDoorFrame, cx0, yb, houseZ(cx0) - .02, cx1, yb + .45, cz1);
    detail.boxMinMax(M.vpFrame, cx0 + .2, yb - .005, houseZ(cx0) + .2, cx1 - .2, yb, cz1 - .2);
    for (const x of [cx0 + 1, cx0 + 2.3, cx1 - .9]) detail.boxMinMax(M.hofLamp, x - .06, yb - .012, 6.9, x + .06, yb - .005, 7.02);
    const px = se[0] + .2, pz = se[1] + .25;
    facade.boxMinMax(M.vpHouse, px - .2, gy - .1, pz - .2, px + .2, yb, pz + .2);
    C.addBox(px - .2, pz - .2, px + .2, pz + .2, gy - .5, yb, { tag: 'wand', id: 'vorplatz_gang_pfeiler' });
    anchor('vorplatz_gang_vordach', 'canopy', 'Vordach am Gang', (cx0 + cx1) / 2, yb, 6.9);
  }
  // Stufen hinab (nicht begehbar, Spielgrenze am oberen Rand) und Podest unter einem Glas-Satteldach.
  { const sz0 = 4.0, sz1 = 7.3, low = gy - .64;
    for (let i = 0; i < 4; i++) b.boxMinMax(M.vpStep, G.end + i * .3, low - .2, sz0, G.end + i * .3 + .3, gy - (i + 1) * .16, sz1);
    surface(ground, M.vpSlab, [[G.end, -3], [XR, -3], [XR, G.rail], [G.end + 1.2, G.rail], [G.end + 1.2, sz1], [G.end, sz1]], 1.2, () => low);
    b.boxMinMax(M.vpConcrete, G.end, low - .1, -3, G.end + .15, gy + .03, sz0);   // Kante zum tieferen Podest
    b.boxMinMax(M.vpConcrete, G.end, low - .1, sz1, G.end + 1.2, gy, G.rail);
    b.rod(M.vpGalv, [G.end, gy + .9, sz1 + .05], [G.end + 1.2, low + .9, sz1 + .05], .02, 8);
    for (const x of [G.end + .05, G.end + 1.15]) b.rod(M.vpGalv, [x, groundY(sz1) - (x - G.end) / .3 * .16, sz1 + .05], [x, gy + .9 - (x - G.end) / 1.2 * .64, sz1 + .05], .02, 8);
    const gx0 = 50.2, gx1 = 53.4, gz0 = 3.6, gz1 = 7.6, ge = low + 2.4, gr = low + 3.1, gm = (gz0 + gz1) / 2;
    for (const x of [gx0, gx1]) for (const z of [gz0, gz1]) b.cylinder(M.vpFrame, .05, .05, ge - low, x, (low + ge) / 2, z, 10);
    for (const z of [gz0, gz1]) b.bar(M.vpFrame, [gx0 - .2, ge, z], [gx1 + .2, ge, z], .06, .1);
    b.bar(M.vpFrame, [gx0 - .2, gr, gm], [gx1 + .2, gr, gm], .06, .08);
    for (const x of [gx0 - .2, (gx0 + gx1) / 2, gx1 + .2]) for (const z of [gz0, gz1]) b.bar(M.vpFrame, [x, ge, z], [x, gr, gm], .04, .06);
    for (const [za, zc] of [[gz0, gm], [gz1, gm]]) quad(glass, M.vpCanopyGlass, [[gx0 - .2, ge + .05, za], [gx1 + .2, ge + .05, za], [gx1 + .2, gr + .04, zc], [gx0 - .2, gr + .04, zc]]);
  }
  // Sichtabschluss im Osten und Norden: schlichte, niedrige Hüllen mit Fenstern (keine Fotos dieser Seiten;
  // am Gangende ist auf den Fotos über dem Glasdach Himmel zu sehen).
  { const top = 3.6, lowY = gy - .64;
    surface(ground, M.vpSlab, [[backX(-3), -3], [G.end, -3], [G.end, G.north], [backX(G.north), G.north]], 1.2, onGround);
    facade.boxMinMax(M.vpHouse, XR, lowY - .3, -3.4, XR + 4, top, zb);
    facade.boxMinMax(M.vpHouse, backX(-3) - .3, lowY - .3, -3.4, XR, top, -3);
    b.boxMinMax(M.vpFlashing, XR - .1, top, -3.5, XR + 4, top + .1, zb);
    b.boxMinMax(M.vpFlashing, backX(-3) - .3, top, -3.5, XR, top + .1, -2.9);
    for (const z of [-1.2, 1.8, 6.4, 9.2]) detail.boxMinMax(M.vpDarkGlass, XR - .006, lowY + 1.0, z - .6, XR - .002, lowY + 2.3, z + .6);
    for (const x of [49.3, 52.0]) detail.boxMinMax(M.vpDarkGlass, x - .6, lowY + 1.0, -2.996, x + .6, lowY + 2.3, -2.992);
  }

  // ------------------------------------------------------------------ Spielgrenzen
  const barrier = (id, ax, az, bx, bz) => { const len = Math.hypot(bx - ax, bz - az); C.add({ x: (ax + bx) / 2, z: (az + bz) / 2, w: len, d: .2, rot: -Math.atan2(bz - az, bx - ax), bottom: -3, top: 8, tag: 'grenze', id }); };
  barrier('vorplatz_grenze_gang_ost', G.end + .1, G.north - .2, G.end + .1, G.rail);
  barrier('vorplatz_grenze_gang_nord', xn - .5, G.north - .1, G.end + .2, G.north - .1);
  anchor('vorplatz_gang', 'exterior', 'Gang am Torbogen', (xe + G.end) / 2, gy, (houseZ(42) + G.rail) / 2);
}
